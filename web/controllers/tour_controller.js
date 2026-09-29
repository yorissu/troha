
/**
 * The tour (Settings -> Tutorial): a walk through Troha, one thing at a time, with
 * the rest of the app dimmed and untouchable (see the Tour view). In order: setting
 * a PIN, then the Settings, Calendar, Your habits and Today views (each lit up with
 * its button at the top), the theme, brightness and screen buttons, the buttons at
 * the top, and a hint that there are easter eggs.
 *
 * The PIN step opens the PIN pad and moves on by itself once a PIN is set (or the
 * pad is cancelled); "Later" skips it. With a PIN already set, it only explains the
 * lock button. While the tour runs, nothing counts as idle: it isn't interrupted by
 * going back to Today, "Log out?" or the screen turning off.
 */

import { prefersReducedMotion } from '../core/dom.js';

export class TourController {
	#tour;
	#app;
	#steps;
	#index = 0;
	#step = null; // the current step, as shown

	/**
	 * @param {object} options
	 * @param {import('../views/overlays/tour/tour.js').Tour} options.tour
	 * @param {object} options.app What the tour needs from the rest of the app:
	 * @param {(view: string) => void} options.app.showView
	 * @param {import('../core/idle_timer.js').IdleTimer} options.app.idle
	 * @param {import('../views/base/sheet/sheet.js').SheetHost} options.app.sheets
	 * @param {import('../models/session.js').Session} options.app.session
	 * @param {(origin: Element, then: () => void, onCancel: () => void) => void} options.app.requireLogin
	 * @param {import('../views/frame/header/header.js').Header} options.app.header
	 * @param {import('../views/overlays/confetti/confetti.js').Confetti} options.app.confetti
	 * @param {object} options.app.elements lock, pinPad, today, calendar, manage, settings, theme, brightness,
	 *   screen, dayNumber, clock
	 */
	constructor({ tour, app }) {
		this.#tour = tour;
		this.#app = app;
		this.#steps = this.#makeSteps();
	}

	/** True while the tour is on. */
	get active() {
		return this.#tour.active;
	}

	/** Starts the tour from the beginning. */
	start() {
		if (this.active) return;
		this.#app.sheets.close();
		this.#app.idle.keepAwake(true);
		this.#go(0);
	}

	/** Ends the tour where it is (e.g. at midnight, when the app starts the new day). */
	stop() {
		if (!this.active) return;
		this.#leave();
		this.#tour.hide();
		this.#app.idle.keepAwake(false);
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
		if (!prefersReducedMotion()) this.#app.confetti.burst();
	}

	#go(index) {
		this.#leave();
		this.#index = index;
		const step = this.#steps[index]();
		this.#step = step;
		if (step.view) this.#app.showView(step.view);
		step.enter?.();
		this.#tour.show({ ...step, number: index + 1, count: this.#steps.length, canGoBack: index > 0 });
	}

	#leave() {
		this.#step?.leave?.();
		this.#step = null;
	}

	/**
	 * The steps, in order. Each is made when it's reached, so it can depend on how
	 * things are then (e.g. whether a PIN is set yet).
	 * @returns {Array<() => object>} Steps for Tour.show(), plus `view` (to show first),
	 *   and `enter` and `leave` (run when the step starts and ends).
	 */
	#makeSteps() {
		const { elements: e, header } = this.#app;
		return [
			() => ({
				view: 'today',
				title: 'Welcome to Troha',
				text: 'A quick walk through your habit board. It takes about a minute. While it runs, only the buttons on this card work.',
				nextLabel: 'Start',
			}),
			() => this.#pinStep(),
			() => ({
				view: 'settings',
				target: () => e.settings,
				also: () => [header.viewButton('settings')],
				title: 'Settings',
				text: 'Your data file, the night and sleep times, the date and time, and how bouncy things are. Changes apply right away. This tour lives here too.',
			}),
			() => ({
				view: 'calendar',
				target: () => e.calendar,
				also: () => [header.viewButton('calendar')],
				title: 'Calendar',
				text: 'Every day gets a ring showing how much you did, and perfect days build up a streak. The eraser clears days you’d rather forget.',
			}),
			() => ({
				view: 'manage',
				target: () => e.manage,
				also: () => [header.viewButton('manage')],
				title: 'Your habits',
				text: 'Every habit, with its week at a glance. Tap one to change its name, days, colour or privacy, or to delete it.',
			}),
			() => ({
				view: 'today',
				target: () => e.today,
				also: () => [header.viewButton('today')],
				title: 'Today',
				text: 'Today’s habits. Tap one to tick it off, and again to untick it. Finish them all for a little party.',
			}),
			() => ({
				target: () => e.theme,
				title: 'Theme',
				text: 'Light, dark, or auto: dark during the night time you set in Settings.',
			}),
			() => ({
				target: () => e.brightness,
				title: 'Brightness',
				text: 'Bright, dim, or auto: dim during your sleep time.',
			}),
			() => ({
				target: () => e.screen,
				title: 'Screen',
				text: 'Always on, off when idle, or auto: off when idle during your sleep time. Its outline counts down to going dark.',
			}),
			() => ({
				target: () => header.navButtons[0],
				also: () => header.navButtons.slice(1),
				enter: () => header.flare(),
				title: 'Up here',
				text: 'The lock for your PIN, your views (Today, Calendar and Your habits), + to add a habit, and Settings.',
			}),
			() => ({
				target: () => e.dayNumber,
				also: () => [e.clock],
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
		const { session, elements: e, sheets, requireLogin } = this.#app;
		if (session.hasPin) {
			return {
				target: () => e.lock,
				title: 'Your PIN',
				text: 'Private habits stay hidden until you log in with your PIN: tap the lock. You’re logged out after a minute without a touch.',
			};
		}
		let open = false;
		return {
			target: () => e.pinPad,
			interactive: true, // the pad can be typed into
			title: 'Set your PIN',
			text: 'Private habits stay hidden until you log in with a PIN. Choose one now: 4 to 8 digits, then the same again.',
			nextLabel: 'Later',
			enter: () => {
				open = true;
				const done = () => {
					if (!open) return; // the tour has moved on already
					open = false;
					this.next();
				};
				requireLogin(e.lock, done, done); // set: next step; cancelled on the pad: next step too
			},
			leave: () => {
				if (!open) return;
				open = false;
				sheets.close(); // "Later" or Back: put the pad away
			},
		};
	}
}
