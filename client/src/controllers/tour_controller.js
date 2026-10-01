
/**
 * The tour (Settings -> Tutorial): a walk through Troha, one thing at a time, with
 * the rest of the app dimmed and untouchable (see tour.svelte). In order: setting
 * a PIN, then the Notices, Account, Today, Your habits, Calendar and Settings views (each lit
 * up with its button at the top), the theme, brightness and screen buttons, the
 * buttons at the top, and a hint that there are easter eggs.
 *
 * The PIN step opens the PIN pad and moves on by itself once a PIN is set (or the
 * pad is cancelled); "Later" skips it. With a PIN already set, it only explains the
 * lock button. While the tour runs, nothing counts as idle: it isn't interrupted by
 * going back to Today, "Lock them?" or the screen turning off.
 */

import { confetti } from '../services/confetti.js';
import { idle } from '../services/idle.js';
import { sheets } from '../components/base/sheet_host.js';

export class TourController {
	#app;
	#steps;
	#index = 0;
	#step = null; // the current step, as shown

	/**
	 * @param {object} options
	 * @param {object} options.app What the tour needs from the rest of the app:
	 * @param {(view: string) => void} options.app.showView
	 * @param {import('../models/hidden_lock.svelte.js').HiddenLock} options.app.lock
	 * @param {(origin: Element, then: () => void, onCancel: () => void) => void} options.app.requireUnlock
	 * @param {object} options.app.views tour, header, sidebar, pinPad, today, calendar, manage, settings,
	 *   account, and the buttons: theme, brightness, screen
	 */
	constructor({ app }) {
		this.#app = app;
		this.#steps = this.#makeSteps();
	}

	/** True while the tour is on. */
	get active() {
		return this.#app.views.tour.active();
	}

	/** Starts the tour from the beginning. */
	start() {
		if (this.active) return;
		sheets.close();
		idle.keepAwake(true);
		this.#go(0);
	}

	/** Ends the tour where it is (e.g. at midnight, when the app starts the new day). */
	stop() {
		if (!this.active) return;
		this.#leave();
		this.#app.views.tour.hide();
		idle.keepAwake(false);
	}

	next() {
		if (!this.active) return;
		if (this.#index === this.#steps.length - 1) this.#finish();
		else this.#go(this.#index + 1);
	}

	back() {
		if (this.active && this.#index > 0) this.#go(this.#index - 1);
	}

	/** "Skip tour": straight back to Today. */
	skip() {
		this.stop();
		this.#app.showView('today');
	}

	#finish() {
		this.stop();
		this.#app.showView('today');
		confetti.burst();
	}

	#go(index) {
		this.#leave();
		this.#index = index;
		const step = this.#steps[index]();
		this.#step = step;
		if (step.view) this.#app.showView(step.view);
		step.enter?.();
		this.#app.views.tour.show({ ...step, number: index + 1, count: this.#steps.length, canGoBack: index > 0 });
	}

	#leave() {
		this.#step?.leave?.();
		this.#step = null;
	}

	/**
	 * The steps, in order. Each is made when it's reached, so it can depend on how
	 * things are then (e.g. whether a PIN is set yet).
	 * @returns {Array<() => object>} Steps for the tour's show(), plus `view` (to show first),
	 *   and `enter` and `leave` (run when the step starts and ends).
	 */
	#makeSteps() {
		const { views: v } = this.#app;
		const viewStep = (view, title, text) => () => ({
			view,
			target: () => v[view].element(),
			also: () => [v.header.viewButton(view)],
			title,
			text,
		});
		return [
			() => ({
				view: 'today',
				title: 'Welcome to Troha',
				text: 'A quick walk through your habit board. It takes about a minute. While it runs, only the buttons on this card work.',
				nextLabel: 'Start',
			}),
			() => this.#pinStep(),
			viewStep('notices', 'Notices',
				'Anything Troha needs you to know, like your license ending soon (its button gets a dot), and the messages that popped up at the bottom lately.'),
			viewStep('account', 'Account',
				'Your license (renew it here, with a code or by paying for days), your email and password, and downloading or deleting your data. Signing out is here too.'),
			viewStep('today', 'Today',
				'Today’s habits, the most important first. Tap one to tick it off, and again to untick it. Finish them all for a little party.'),
			viewStep('manage', 'Your habits',
				'Every habit, with its week at a glance. Tap one to change its name, priority, days, dates, colour or visibility, or to delete it.'),
			viewStep('calendar', 'Calendar',
				'Every day gets a ring showing how much you did, and perfect days build up a streak.'),
			viewStep('settings', 'Settings',
				'Your PIN, and the night and sleep times. Changes apply right away. This tour lives here too.'),
			() => ({
				target: () => v.theme,
				title: 'Theme',
				text: 'Light, dark, or auto: dark during the night time you set in Settings.',
			}),
			() => ({
				target: () => v.brightness,
				title: 'Brightness',
				text: 'Bright, dim, or auto: dim during your sleep time.',
			}),
			() => ({
				target: () => v.screen,
				title: 'Screen',
				text: 'Always on, off when idle, or auto: off when idle during your sleep time. Its outline counts down to going dark.',
			}),
			() => ({
				target: () => v.header.navButtons()[0],
				also: () => v.header.navButtons().slice(1),
				enter: () => v.header.flare(),
				title: 'Up here',
				text: 'The lock for hidden habits, + to add a habit, then Notices, your account, your views (Today, Your habits and Calendar), and Settings.',
			}),
			() => ({
				target: () => v.sidebar.dayNumberElement(),
				also: () => [v.sidebar.clockElement()],
				title: 'Psst…',
				text: 'There are a few easter eggs hidden around Troha. Try tapping things more than once, and keep an eye on the clock.',
			}),
			() => ({
				view: 'today',
				title: 'You’re all set',
				text: 'Have fun ticking things off. You can take this tour again any time from Settings.',
				nextLabel: 'Done',
			}),
		];
	}

	/** Setting a PIN (the pad opens, and the tour moves on once it's set), or, with one set, the lock. */
	#pinStep() {
		const { lock, views: v, requireUnlock } = this.#app;
		if (lock.hasPin) {
			return {
				target: () => v.header.lockButton(),
				title: 'Your PIN',
				text: 'Hidden habits stay blank bars until you type your PIN: tap the lock. They lock again after a minute without a touch.',
			};
		}
		let open = false;
		return {
			target: () => v.pinPad.element(),
			interactive: true, // the pad can be typed into
			title: 'Set your PIN',
			text: 'Hidden habits stay blank bars until you type a PIN. Choose one now: 4 to 8 digits, then the same again.',
			nextLabel: 'Later',
			enter: () => {
				open = true;
				const done = () => {
					if (!open) return; // the tour has moved on already
					open = false;
					this.next();
				};
				requireUnlock(v.header.lockButton(), done, done); // set: next step; cancelled on the pad: next step too
			},
			leave: () => {
				if (!open) return;
				open = false;
				sheets.close(); // "Later" or Back: put the pad away
			},
		};
	}
}
