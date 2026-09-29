
/**
 * The app: builds the models, views and controllers, connects them, loads the
 * data and runs the clock. This is the one place where everything is wired up.
 */

import { config } from '../config.js';
import { Clock } from '../core/clock.js';
import { IdleTimer } from '../core/idle_timer.js';
import { weekdayNames } from '../core/dates.js';
import { h } from '../core/dom.js';
import { dataFileName, FILE_NAME } from '../models/api.js';
import { CHOICES } from '../models/settings.js';
import { messages } from '../messages.js';
import { say } from '../core/text.js';
import { HabitStore } from '../models/habit_store.js';
import { PrivateNames } from '../models/private_names.js';
import { Session } from '../models/session.js';
import { Sidebar } from '../views/frame/sidebar/sidebar.js';
import { ThemeButton } from '../views/controls/theme_button/theme_button.js';
import { BrightnessButton } from '../views/controls/brightness_button/brightness_button.js';
import { ScreenButton } from '../views/controls/screen_button/screen_button.js';
import { Header } from '../views/frame/header/header.js';
import { LockButton } from '../views/controls/lock_button/lock_button.js';
import { TodayView } from '../views/pages/today_view/today_view.js';
import { CalendarView } from '../views/pages/calendar_view/calendar_view.js';
import { ManageView } from '../views/pages/manage_view/manage_view.js';
import { SettingsView } from '../views/pages/settings_view/settings_view.js';
import { SheetHost } from '../views/base/sheet/sheet.js';
import { HabitEditor } from '../views/sheets/habit_editor/habit_editor.js';
import { ConfirmSheet } from '../views/sheets/confirm_sheet/confirm_sheet.js';
import { PinPad } from '../views/sheets/pin_pad/pin_pad.js';
import { DatePicker } from '../views/sheets/date_picker/date_picker.js';
import { TimePicker } from '../views/sheets/time_picker/time_picker.js';
import { FilePicker } from '../views/sheets/file_picker/file_picker.js';
import { OnScreenKeyboard } from '../views/overlays/on_screen_keyboard/on_screen_keyboard.js';
import { Toast } from '../views/overlays/toast/toast.js';
import { Confetti } from '../views/overlays/confetti/confetti.js';
import { NightShade } from '../views/overlays/night_shade/night_shade.js';
import { HabitController } from './habit_controller.js';
import { SessionController } from './session_controller.js';
import { ThemeController } from './theme_controller.js';
import { ScreenController } from './screen_controller.js';
import { SettingsController } from './settings_controller.js';

const SWITCHED_HASH = '#switched'; // set just before reloading onto another data file

export class AppController {
	#stage;
	#clock = new Clock();
	#idle = new IdleTimer();
	#privateNames = new PrivateNames();
	#toast = new Toast();
	#store;
	#session;
	#sheets = new SheetHost();
	#habits;
	#sessions;
	#theme;
	#screen;
	#settings;
	#header;
	#view = 'today';

	/** @param {HTMLElement} stage The fixed 1920×1080 stage element. */
	constructor(stage) {
		this.#stage = stage;
		this.#store = new HabitStore({
			privateNames: this.#privateNames,
			onSaveError: (error) => this.#toast.show(error.reason === 'other-file'
				? 'Another data file is in use now. Reload the page to see it.'
				: "Couldn't save. Is server.py running?"),
		});
		this.#session = new Session({ store: this.#store, privateNames: this.#privateNames, pinConfig: config.pin });
		this.#build();
	}

	/** Loads the data (retrying until the server answers), then starts. */
	async start() {
		try {
			await this.#store.load();
		} catch (error) {
			console.error(error);
			this.#toast.show("Can't load your habits. Is server.py running? Retrying…", { sticky: true });
			setTimeout(() => this.start(), config.timing.loadRetryMs);
			return;
		}
		this.#toast.hide();
		if (location.hash === SWITCHED_HASH) {
			history.replaceState(null, '', location.pathname + location.search); // keeps ?kiosk
			this.#toast.show(`Now using “${dataFileName()}”`, { duration: config.toastMs.normal });
		}
		this.#settings.applyMotion();
		this.#theme.apply();
		this.#screen.apply();
		this.#screen.useBacklight(); // switches over once the server has answered
		this.#sessions.start();
		if (this.#store.syncDay(this.#clock.day)) this.#store.save();
		this.#showView('today');

		this.#clock.addEventListener('tick', (event) => this.#tick(event.detail.now));
		this.#idle.addEventListener('activity', () => this.#habits.tick()); // refill the Clear timer at once
		this.#clock.addEventListener('daychange', () => {
			this.#sheets.close();
			this.#habits.startDay();
			this.#showView('today');
		});
		this.#clock.start();
		document.addEventListener('contextmenu', (event) => event.preventDefault()); // no long-press menu
	}

	/** Creates every view and controller, and puts the views on the stage. */
	#build() {
		const dayNames = weekdayNames(config.locale, 'short');
		const sheets = this.#sheets;

		// Views
		const themeButton = new ThemeButton({ onTap: () => this.#theme.next() });
		const brightnessButton = new BrightnessButton({ onTap: () => this.#screen.nextBrightness() });
		const screenButton = new ScreenButton({ onTap: () => this.#screen.nextScreen() });
		const sidebar = new Sidebar({
			locale: config.locale,
			buttons: [themeButton, brightnessButton, screenButton],
			playful: config.playful,
			onTickle: () => today.tickle(),
		});
		const lockButton = new LockButton({ onTap: (element) => this.#sessions.tapLockButton(element) });
		this.#header = new Header({
			lockButton,
			onNavigate: (view) => this.#showView(view),
			onAdd: (element) => this.#habits.add(element),
		});
		const today = new TodayView({ layout: config.today, onCardTap: (card) => this.#habits.tapCard(card) });
		const calendar = new CalendarView({
			locale: config.locale,
			dayNames,
			source: {
				today: () => this.#clock.day,
				entry: (day) => this.#store.entry(day),
				streak: () => this.#store.streak(this.#clock.day),
			},
			onClearTap: () => this.#habits.toggleClear(),
			onDayTap: (day, cell) => this.#habits.clearDay(day, cell),
			playful: config.playful,
			heyRemarks: messages.hey,
		});
		const manage = new ManageView({ onRowTap: (id, row) => this.#habits.tapRow(id, row) });
		const settingsView = new SettingsView({
			locale: config.locale,
			onPickRangeTime: (range, which, element) => this.#settings.pickRangeTime(range, which, element),
			onSyncClock: () => this.#settings.syncTapped(),
			onPickDate: (element) => this.#settings.pickDate(element),
			onPickTime: (element) => this.#settings.pickTime(element),
			onPickFile: (element) => this.#settings.pickFile(element),
			motionChoices: CHOICES.motion,
			onPickMotion: (choice) => this.#settings.pickMotion(choice),
		});
		const keyboard = new OnScreenKeyboard();
		const datePicker = new DatePicker(sheets, { locale: config.locale, dayNames });
		const timePicker = new TimePicker(sheets, { minuteStep: config.timePicker.minuteStep });
		const filePicker = new FilePicker(sheets, { keyboard, fileName: FILE_NAME });
		const editor = new HabitEditor(sheets, {
			locale: config.locale,
			dayNames,
			colors: config.colors,
			repeatChoices: config.editor.repeatChoices,
			nameMaxLength: config.editor.nameMaxLength,
			keyboard,
			datePicker,
			today: () => this.#clock.day,
			canChoosePrivate: () => this.#session.loggedIn,
			onAdd: (fields) => this.#habits.added(fields),
			onChange: (habit, fields) => this.#habits.changed(habit, fields),
			onDelete: (habit, element) => this.#habits.askDelete(habit, element),
			onNeedLogin: (element) => this.#sessions.requireLogin(element, () => editor.choosePrivate(element)),
		});
		const confirm = new ConfirmSheet(sheets);
		const logoutConfirm = new ConfirmSheet(sheets);
		const pinPad = new PinPad(sheets, {
			session: this.#session,
			limits: config.pin,
			remarks: { wrongPin: messages.wrongPin, niceTry: messages.niceTry },
			onDone: (how) => this.#toast.show(say(how === 'set' ? messages.pinSet : messages.loggedIn), { duration: config.toastMs.short }),
			onForgot: (element) => this.#sessions.forgot(element),
		});
		const confetti = new Confetti({ colors: config.colors });
		const shade = new NightShade({ onWake: () => this.#idle.touch() });

		// Controllers
		this.#theme = new ThemeController({ store: this.#store, button: themeButton, toast: this.#toast, toastMs: config.toastMs });
		this.#screen = new ScreenController({
			store: this.#store,
			stage: this.#stage,
			shade,
			buttons: { brightness: brightnessButton, screen: screenButton },
			toast: this.#toast,
			idle: this.#idle,
			config,
		});
		this.#settings = new SettingsController({
			store: this.#store,
			view: settingsView,
			datePicker,
			timePicker,
			filePicker,
			confirm,
			toast: this.#toast,
			clock: this.#clock,
			toastMs: config.toastMs,
			onTimeRangeChange: () => {
				this.#theme.apply();
				this.#screen.apply();
			},
			onFileChange: () => this.#restartWithNewFile(),
		});
		this.#habits = new HabitController({
			store: this.#store,
			clock: this.#clock,
			idle: this.#idle,
			config,
			dayNames,
			views: { sidebar, today, calendar, manage, editor, confirm, toast: this.#toast, confetti },
			requireLogin: (origin, then) => this.#sessions.requireLogin(origin, then),
			isLoggedIn: () => this.#session.loggedIn,
		});
		this.#sessions = new SessionController({
			session: this.#session,
			store: this.#store,
			idle: this.#idle,
			sheets,
			lockButton,
			pinPad,
			confirm,
			logoutConfirm,
			toast: this.#toast,
			timing: config.timing,
			toastMs: config.toastMs,
			onChange: (loggedIn) => this.#habits.privacyChanged(loggedIn),
		});

		// Layout: sidebar | main; pop-ups, keyboard, confetti and toasts on top; the night shade over everything.
		this.#stage.append(
			sidebar.element,
			h('main', { className: 'main' }, this.#header.element, today.element, calendar.element, manage.element, settingsView.element),
			sheets.element,
			keyboard.element,
			confetti.element,
			this.#toast.element,
			shade.element);
	}

	/**
	 * Another data file is in use: start afresh with it (a reload also logs out, since
	 * every file has its own PIN), and say so once it's loaded.
	 */
	#restartWithNewFile() {
		location.hash = SWITCHED_HASH;
		location.reload();
	}

	#showView(view) {
		this.#view = view;
		this.#header.setView(view);
		this.#habits.showView(view); // hides its views unless one of them is `view`
		if (view === 'settings') this.#settings.show();
		else this.#settings.hide();
	}

	/** Every second: clock, theme, screen care, login timers, clear mode, and back to Today when idle. */
	#tick(now) {
		this.#habits.showTime(now);
		this.#settings.tick(now);
		this.#theme.apply(now);
		this.#screen.apply(now);
		this.#sessions.tick();
		this.#habits.tick();
		const idleTooLong = this.#idle.idleMs > config.timing.idleReturnMs;
		if (idleTooLong && (this.#view !== 'today' || this.#sheets.isOpen)) {
			this.#sheets.close();
			this.#showView('today');
		}
	}
}
