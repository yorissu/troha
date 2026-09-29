
/**
 * Habits on screen: the Today, Calendar and Manage views, the sidebar progress,
 * adding, editing and deleting habits, and the celebrations.
 */

import { describeSchedule, repeatText } from '../core/schedule.js';
import { addDaysToKey, formatDate, fromKey } from '../core/dates.js';
import { prefersReducedMotion } from '../core/dom.js';
import { say } from '../core/text.js';
import { messages } from '../messages.js';

const NO_HABITS = 'No habits yet. Tap + to add your first one.';
const SUNRISE_COLORS = ['butter', 'peach', 'blush']; // the early bird's confetti
const NOTHING_TODAY = 'Nothing planned today. Enjoy it.';

export class HabitController {
	#store;
	#clock;
	#idle;
	#config;
	#dayNames;
	#views;
	#requireLogin;
	#isLoggedIn;
	#playful;
	#view = 'today';
	#halfwayShownOn = null; // the day the "halfway" toast was shown (once a day)
	#clearing = false;      // Calendar clear mode
	#cleared = new Map();   // days cleared while their "Undo" is on screen: day -> its log entry before clearing
	#undoClearing = null;   // that "Undo" (so a new clear can tell whether it's still on offer)

	/**
	 * @param {object} options
	 * @param {import('../models/habit_store.js').HabitStore} options.store
	 * @param {import('../core/clock.js').Clock} options.clock
	 * @param {import('../core/idle_timer.js').IdleTimer} options.idle For clear mode's time limit.
	 * @param {typeof import('../config.js').config} options.config
	 * @param {string[]} options.dayNames
	 * @param {object} options.views sidebar, today, calendar, manage, editor, confirm, toast, confetti
	 * @param {(origin: Element, then?: () => void) => void} options.requireLogin
	 * @param {() => boolean} options.isLoggedIn
	 * @param {import('./playful_controller.js').PlayfulController} options.playful The night owl and the early bird.
	 */
	constructor({ store, clock, idle, config, dayNames, views, requireLogin, isLoggedIn, playful }) {
		this.#store = store;
		this.#clock = clock;
		this.#idle = idle;
		this.#config = config;
		this.#dayNames = dayNames;
		this.#views = views;
		this.#requireLogin = requireLogin;
		this.#isLoggedIn = isLoggedIn;
		this.#playful = playful;
	}

	get #day() {
		return this.#clock.day;
	}

	/** Switches the main area to `view` ('today', 'calendar' or 'manage'; any other view hides all three). */
	showView(view) {
		if (view !== 'calendar') this.#setClearing(false, { quiet: true }); // leaving the calendar ends clear mode
		this.#view = view;
		const { today, calendar, manage } = this.#views;
		today.element.hidden = view !== 'today';
		calendar.element.hidden = view !== 'calendar';
		manage.element.hidden = view !== 'manage';
		if (view === 'calendar') calendar.goToMonthOf(this.#day); // drawn by render() below
		this.render();
	}

	/** Redraws the sidebar and the current view. */
	render() {
		const { sidebar, today, calendar, manage } = this.#views;
		sidebar.showDate(fromKey(this.#day));
		this.#showProgress();
		if (this.#view === 'today') today.render(this.#todayItems(), this.#store.habits.length ? NOTHING_TODAY : NO_HABITS);
		if (this.#view === 'calendar') calendar.render();
		if (this.#view === 'manage') manage.render(this.#manageItems(), NO_HABITS);
	}

	/** The sidebar clock. */
	showTime(now) {
		this.#views.sidebar.showTime(now);
	}

	/** A new day started: a fresh log entry and a greeting (then show Today). */
	startDay() {
		if (this.#store.syncDay(this.#day)) this.#store.save();

		const count = this.#store.entry(this.#day).total;
		const weekday = formatDate(fromKey(this.#day), this.#config.locale, 'weekday');
		const greeting = count ? say(messages.greeting, weekday, count) : say(messages.greetingFree, weekday);
		this.#views.toast.show(greeting, { duration: 'long' });
	}

	/** After logging in or out: private names appear or hide (or, after a PIN reset, everything redraws). */
	privacyChanged(loggedIn) {
		if (!loggedIn && this.#views.toast.hasAction) this.#views.toast.hide(); // no undoing (e.g. a private habit's delete) after logging out
		if (this.#store.syncDay(this.#day)) {
			this.render(); // private habits were removed
			return;
		}
		for (const card of this.#views.today.cards) {
			const habit = this.#store.find(card.id);
			if (!habit?.private) continue;
			const content = this.#cardContent(habit);
			if (loggedIn) card.reveal(content);
			else card.conceal(content);
		}
		if (this.#view === 'manage') this.#views.manage.render(this.#manageItems(), NO_HABITS);
	}

	/* ---------- Taps ---------- */

	/** A habit card on Today: tick or untick it (a hidden one asks for the PIN first). */
	tapCard(card) {
		if (card.busy) return; // still animating the last tap
		const habit = this.#store.find(card.id);
		if (!habit) return; // a card left over from a moment ago (its habit is gone)
		if (this.#isHidden(habit)) {
			this.#requireLogin(card.element);
			return;
		}

		const done = this.#store.toggleDone(this.#day, habit.id);
		card.setDone(done);
		card.playToggle();
		this.#showProgress({ bump: true });
		this.#store.save();
		if (!done) return;
		const cheer = this.#cheerIfDeserved();
		// In the small hours, a sleepy remark, unless a cheer is on its way (then it waits for the next tick).
		const sleepy = cheer ? null : this.#playful.sleepyRemark(new Date());
		if (sleepy) this.#views.toast.show(sleepy);
	}

	/** A card in Manage: edit that habit (a hidden one asks for the PIN first). */
	tapManageCard(id, card) {
		const habit = this.#store.find(id);
		if (!habit) return;
		if (this.#isHidden(habit)) this.#requireLogin(card, () => this.#edit(habit, card));
		else this.#edit(habit, card);
	}

	/** The + button. */
	add(origin) {
		this.#views.editor.edit(null, { colorIndex: this.#store.habits.length, origin });
	}

	/* ---------- Calendar clear mode ---------- */

	/** The Clear button: turns clear mode on or off. */
	toggleClear() {
		this.#setClearing(!this.#clearing);
	}

	/** A day tapped in clear mode: its counter is removed ("Undo" is offered for a few seconds). */
	clearDay(day, cell) {
		if (!this.#clearing || !this.#store.entry(day)) return; // e.g. a second tap before it's redrawn
		// Days cleared while their "Undo" is still on screen are undone together. A day
		// cleared twice (today comes back empty) keeps what it had before the first time.
		if (!this.#views.toast.offers(this.#undoClearing)) this.#cleared = new Map();
		const cleared = this.#cleared;
		const entry = this.#store.clearDay(day);
		if (!cleared.has(day)) cleared.set(day, entry);
		if (day === this.#day) this.#store.syncDay(day); // today starts again from nothing done
		this.#store.save();
		this.#views.calendar.clearOut(cell, () => this.render());

		const count = cleared.size;
		const label = day === this.#day ? 'today' : this.#friendlyDate(day);
		this.#undoClearing = () => {
			this.#store.restoreDays(cleared);
			this.#store.syncDay(this.#day);
			this.#store.save();
			this.render();
			this.#views.toast.show(count === 1 ? 'Day restored' : `${count} days restored`, { duration: 'short' });
		};
		this.#offerUndo(count === 1 ? `Cleared ${label}` : `Cleared ${count} days`, this.#undoClearing);
	}

	/** Called every second (and on every touch): clear mode ends after a while without a touch. */
	tick() {
		if (!this.#clearing) return;
		const left = this.#idle.fractionLeft(this.#config.timing.clearModeIdleMs);
		if (left === 0) this.#setClearing(false);
		else this.#views.calendar.setClearTimeLeft(left);
	}

	#setClearing(on, { quiet = false } = {}) {
		if (this.#clearing === on) return;
		this.#clearing = on;
		this.#views.calendar.setClearMode(on);
		if (on) this.#views.calendar.setClearTimeLeft(1);
		if (quiet || (!on && this.#views.toast.hasAction)) return; // keep "Undo" on screen
		this.#views.toast.show(say(on ? messages.clearModeOn : messages.clearModeOff), { duration: 'short' });
	}

	/* ---------- Editor callbacks ---------- */

	/** A new habit from the editor. */
	added(fields) {
		this.#store.add(fields);
		this.#views.toast.show(fields.private ? say(messages.addedPrivate) : say(messages.added, fields.name));
		this.#views.editor.close();
		this.#store.syncDay(this.#day);
		this.render();
		this.#store.save();
	}

	/** A change made in the editor (applies right away). */
	changed(habit, fields) {
		this.#store.update(habit, fields);
		this.#store.syncDay(this.#day);
		this.render();
		this.#store.saveSoon(this.#config.timing.saveDelayMs);
	}

	/** Delete tapped in the editor: ask first. */
	askDelete(habit, origin) {
		this.#views.confirm.ask({
			title: `Delete “${displayName(habit)}”?`,
			note: 'Past days in the calendar keep their ticks.',
			noLabel: 'Keep it',
			yesLabel: 'Delete',
			poof: true,
			origin,
			onNo: () => this.#views.editor.reopen(origin),
			onYes: () => {
				const day = this.#day; // Undo may come after midnight: the tick belongs to this day
				const wasDone = this.#store.entry(day).done.includes(habit.id);
				const index = this.#store.remove(habit);
				this.#store.syncDay(day);
				this.render();
				this.#store.save();
				this.#offerUndo(habit.private ? 'Deleted a private habit' : `Deleted “${habit.name}”`, () => {
					this.#store.restore(habit, index);
					this.#store.syncDay(day);
					const { done } = this.#store.entry(day);
					if (wasDone && !done.includes(habit.id)) done.push(habit.id); // its tick comes back too
					if (day !== this.#day) this.#store.syncDay(this.#day);
					this.render();
					this.#store.save();
					this.#views.toast.show(habit.private ? 'Private habit restored' : `Restored “${habit.name}”`, { duration: 'short' });
				});
			},
		});
	}

	/* ---------- Helpers ---------- */

	/** A toast with an "Undo" button, offered for `config.timing.undoMs`. */
	#offerUndo(message, undo) {
		this.#views.toast.show(message, { duration: this.#config.timing.undoMs, action: { label: 'Undo', onTap: undo } });
	}

	#edit(habit, origin) {
		this.#views.editor.edit(habit, { name: displayName(habit), origin });
	}

	#isHidden(habit) {
		return habit.private && !this.#isLoggedIn();
	}

	#colorClass(habit) {
		const colors = this.#config.colors;
		return `c-${colors.includes(habit.color) ? habit.color : colors[0]}`;
	}

	#cardContent(habit) {
		return {
			name: displayName(habit),
			schedule: describeSchedule(habit, this.#dayNames),
			hidden: this.#isHidden(habit),
		};
	}

	/** A habit as the views show it: id, colour, name (or hidden) and schedule. */
	#item(habit) {
		return { id: habit.id, colorClass: this.#colorClass(habit), ...this.#cardContent(habit) };
	}

	#todayItems() {
		const done = new Set(this.#store.entry(this.#day).done);
		return this.#store.habitsOn(this.#day).map((habit) => ({ ...this.#item(habit), done: done.has(habit.id) }));
	}

	/** Manage shows each habit's days, and tags for what's out of the ordinary. */
	#manageItems() {
		return this.#store.habits.map((habit) => {
			const start = habit.startDate > this.#day ? this.#friendlyDate(habit.startDate) : null;
			const tags = [
				repeatText(habit),
				start && `starts ${start === 'Tomorrow' ? 'tomorrow' : start}`,
				habit.private && !this.#isHidden(habit) && 'private', // a hidden one shows it anyway
			].filter(Boolean);
			return { ...this.#item(habit), days: habit.days, tags };
		});
	}

	/** "Today", "Tomorrow", or e.g. "Mon, 5 Oct". */
	#friendlyDate(day) {
		if (day === this.#day) return 'Today';
		if (day === addDaysToKey(this.#day, 1)) return 'Tomorrow';
		return formatDate(fromKey(day), this.#config.locale, 'short');
	}

	#showProgress({ bump = false } = {}) {
		const { total, done } = this.#store.entry(this.#day);
		this.#views.sidebar.showProgress(done.length, total, { bump });
	}

	/**
	 * All done: celebrate. Half done (once a day, 4+ habits): a toast.
	 * @returns {'all'|'half'|null} Which of them, if any.
	 */
	#cheerIfDeserved() {
		const { total, done } = this.#store.entry(this.#day);
		if (total > 0 && done.length === total) {
			const day = this.#day;
			// After the last card's wiggle, and only if it's still all done (no untick meanwhile).
			setTimeout(() => {
				const entry = this.#store.entry(day);
				if (day === this.#day && entry && entry.total > 0 && entry.done.length === entry.total) this.#celebrate();
			}, this.#config.timing.celebrateDelayMs);
			return 'all';
		}
		if (total >= 4 && done.length === Math.ceil(total / 2) && this.#halfwayShownOn !== this.#day) {
			this.#halfwayShownOn = this.#day;
			this.#views.toast.show(say(messages.halfway), { duration: 'short' });
			return 'half';
		}
		return null;
	}

	/** Everything done: the cards hop, the date bounces, confetti. Early in the morning, a sunrise version. */
	#celebrate() {
		const { today, sidebar, toast, confetti } = this.#views;
		const earlyBird = this.#playful.isEarlyBird(new Date());
		today.cheer();
		if (earlyBird) sidebar.sunrise();
		else sidebar.cheer();
		const streak = this.#store.streak(this.#day);
		const remark = say(earlyBird ? messages.earlyBird : messages.allDone);
		toast.show(remark + (streak > 1 ? ` ${say(messages.streak, streak)}` : ''), { duration: 'long' });
		if (prefersReducedMotion()) return;
		const sunColors = SUNRISE_COLORS.filter((color) => this.#config.colors.includes(color));
		confetti.burst(earlyBird && sunColors.length ? sunColors : undefined);
	}
}

/** A habit's name to show, even if a private one couldn't be decrypted. */
function displayName(habit) {
	return habit.name ?? 'Unreadable habit';
}
