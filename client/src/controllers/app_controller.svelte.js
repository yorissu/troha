
/**
 * The habit board's brain: builds the models and controllers, connects them, and
 * loads the account's data. board.svelte (the board's look) makes one while it's
 * set up, and fills in `views` as its components appear.
 *
 * Each controller looks after its own part, including what it does every second
 * or on every touch (it subscribes to services/clock and services/idle itself, and
 * stops when the board goes). This one only does what's about the whole board:
 * which view is shown, a new day, catching up with other devices after a while
 * without a touch, and the license running out while the page is open. (Going back
 * to Today after a while without a touch: idle_return_controller.svelte.js.)
 */

import { onDestroy } from 'svelte';
import { config } from '../config.js';
import { weekdayNames } from '../core/dates.js';
import { ServerLost } from '../models/api.js';
import { HabitStore } from '../models/habit_store.svelte.js';
import { HiddenLock } from '../models/hidden_lock.svelte.js';
import { clock } from '../services/clock.svelte.js';
import { idle } from '../services/idle.js';
import { toast } from '../services/toast.svelte.js';
import { sheets } from '../components/base/sheet_host.js';
import { AccountController } from './account_controller.svelte.js';
import { CelebrationController } from './celebration_controller.js';
import { HabitController } from './habit_controller.svelte.js';
import { HiddenController } from './hidden_controller.svelte.js';
import { IdleReturnController } from './idle_return_controller.svelte.js';
import { LicenseNoticeController } from './license_notice_controller.js';
import { PlayfulController } from './playful_controller.js';
import { ScreenController } from './screen_controller.svelte.js';
import { SettingsController } from './settings_controller.js';
import { ThemeController } from './theme_controller.js';
import { TourController } from './tour_controller.js';

const HOME = 'today'; // the view the board starts on, and comes back to

export class AppController {
	/** The view on screen: 'today', 'calendar', 'manage', 'notices', 'account' or 'settings'. */
	view = $state(HOME);
	/** True once the data has loaded (until then the board shows nothing but the frame). */
	ready = $state(false);

	dayNames = weekdayNames(config.locale, 'short');
	store;
	lock;
	habits;
	hidden;
	theme;
	screen;
	settings;
	accountActions;
	tour;
	idleReturn;

	#account;
	#lastRefresh = 0;
	#lastLicenseCheck = 0;
	#stopped = false;

	/**
	 * Made while the board is set up (its controllers stop with the board).
	 * @param {object} options
	 * @param {import('../models/account.svelte.js').Account} options.account
	 * @param {() => HTMLElement} options.stage The stage element (screen care moves it a pixel or two now and then).
	 * @param {object} options.views Filled in by board.svelte (bind:this): the components the controllers use.
	 */
	constructor({ account, stage, views }) {
		this.#account = account;

		this.store = new HabitStore({ onSaveError: (error) => this.#saveFailed(error) });
		this.lock = new HiddenLock({ store: this.store, onChange: (unlocked) => this.#lockChanged(unlocked) });
		const playful = new PlayfulController({ playful: config.playful, views });
		const celebrations = new CelebrationController({ store: this.store, config, views, playful });
		this.theme = new ThemeController({ store: this.store });
		this.screen = new ScreenController({ store: this.store, stage, screen: config.screen });
		this.settings = new SettingsController({
			store: this.store,
			views,
			onTimeRangeChange: () => {
				this.theme.apply();
				this.screen.apply();
			},
		});
		this.hidden = new HiddenController({ lock: this.lock, account, views, timing: config.timing });
		const requireUnlock = (origin, then, onCancel) => this.hidden.requireUnlock(origin, then, onCancel);
		this.habits = new HabitController({
			store: this.store,
			lock: this.lock,
			config,
			dayNames: this.dayNames,
			views,
			requireUnlock,
			onDone: () => celebrations.done(),
		});
		this.accountActions = new AccountController({ account, lock: this.lock, store: this.store, views });
		this.tour = new TourController({
			app: {
				showView: (view) => this.showView(view),
				lock: this.lock,
				requireUnlock,
				views,
			},
		});

		this.idleReturn = new IdleReturnController({
			home: HOME,
			afterMs: config.timing.idleReturnMs,
			currentView: () => (this.ready ? this.view : null),
			show: (view) => this.showView(view),
		});
		new LicenseNoticeController({ account, locale: config.locale });

		onDestroy(() => { this.#stopped = true; });
		onDestroy(clock.onTick(() => {
			this.#catchUp();
			this.#checkLicense();
		}));
		onDestroy(clock.onDayChange(() => this.#newDay()));
	}

	/**
	 * Loads the data (retrying if the server can't read it), then starts. Without a
	 * running license there's no data to load: only the Account view, to renew it.
	 */
	async start() {
		this.accountActions.loadPrices();
		if (!this.#account.licensed) {
			this.showView('account');
			this.#greet();
			return;
		}
		this.lock.know(this.#account.me);
		try {
			await this.lock.startLocked(this.#account.me.unlocked); // a reload starts with hidden habits locked
			await this.store.load();
		} catch (error) {
			if (error instanceof ServerLost || this.#stopped) return; // the server-down pop-up takes over
			console.error(error);
			toast.show("Can't read your habits. Retrying…", { sticky: true });
			setTimeout(() => this.start(), config.timing.loadRetryMs);
			return;
		}
		if (this.#stopped) return;
		toast.hide();
		this.theme.apply();
		this.screen.apply();
		if (this.store.syncDay(clock.day)) this.store.save();
		this.ready = true;
		this.showView(HOME);
		this.#greet();
		this.#lastRefresh = performance.now();
	}

	showView(view) {
		this.view = view;
	}

	/** Says what the account left to say (e.g. "Welcome!" after signing up), once. */
	#greet() {
		if (!this.#account.greeting) return;
		toast.show(this.#account.greeting, { duration: 'long' });
		this.#account.greeting = null;
	}

	/** A new day starts on Today, tour or not. */
	#newDay() {
		if (!this.ready) return;
		this.tour.stop();
		sheets.close();
		this.habits.startDay();
		this.showView(HOME);
	}

	/** After a while without a touch (as long as before going back to Today): catch up with other devices. */
	#catchUp() {
		const { idleReturnMs } = config.timing;
		if (!this.ready || idle.idleMs <= idleReturnMs || performance.now() - this.#lastRefresh <= idleReturnMs) return;
		this.#refresh();
	}

	/**
	 * Once the license's end has passed (by this device's clock), asks the server, at most
	 * once a minute: if it agrees, the account says so, and the page reloads into the
	 * Account view. (Not ended here by itself: a clock that runs fast would reload it in a loop.)
	 */
	#checkLicense() {
		const until = this.#account.me?.license?.validUntil;
		if (!until || clock.now.getTime() < until * 1000 || performance.now() - this.#lastLicenseCheck < 60 * 1000) return;
		this.#lastLicenseCheck = performance.now();
		this.#account.check();
	}

	/** Catches up with changes made on other devices meanwhile. */
	async #refresh() {
		this.#lastRefresh = performance.now();
		try {
			if (await this.store.refresh() && this.store.syncDay(clock.day)) this.store.save();
			this.theme.apply();
			this.screen.apply();
		} catch (error) {
			if (!(error instanceof ServerLost)) console.error(error);
		}
	}

	#saveFailed(error) {
		if (['lost', 'signed-out', 'license'].includes(error.reason)) return; // said elsewhere (the server-down pop-up, or a new screen)
		if (error.reason === 'conflict' || error.reason === 'locked') {
			toast.show('Changed on another device. Catching up…', { sticky: true });
			setTimeout(() => location.reload(), 1500);
			return;
		}
		toast.show("Couldn't save. Try again in a moment", { duration: 'long' });
	}

	#lockChanged(unlocked) {
		if (unlocked) {
			idle.touch(); // a fresh minute after unlocking
			return;
		}
		sheets.close(); // nothing hidden stays open
		this.habits.locked();
	}
}
