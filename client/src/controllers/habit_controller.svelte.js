
/**
 * Habits on screen: what the Today and Manage views show, ticking, adding, editing
 * and deleting habits. (Celebrating a habit done: celebration_controller.js.)
 *
 * The views draw from the store by themselves (it's reactive); this decides what
 * they're given (todayItems, manageItems) and what taps do.
 */

import { tick } from 'svelte';
import { addDaysToKey, formatDate, fromKey } from '../core/dates.js';
import { describeSchedule, repeatText } from '../core/schedule.js';
import { say } from '../core/text.js';
import { messages } from '../messages.js';
import { clock } from '../services/clock.svelte.js';
import { toast } from '../services/toast.svelte.js';
import { DEFAULT_PRIORITY, PRIORITY_LABELS, byPriority } from '../models/priorities.js';

const NO_HABITS = 'No habits yet. Tap + to add your first one.';
const NOTHING_TODAY = 'Nothing planned today. Enjoy it.';

export class HabitController {
	#store;
	#lock;
	#config;
	#dayNames;
	#views;
	#requireUnlock;
	#onDone;

	/**
	 * @param {object} options
	 * @param {import('../models/habit_store.svelte.js').HabitStore} options.store
	 * @param {import('../models/hidden_lock.svelte.js').HiddenLock} options.lock
	 * @param {typeof import('../config.js').config} options.config
	 * @param {string[]} options.dayNames
	 * @param {object} options.views editor, confirm
	 * @param {(origin: Element, then?: () => void, onCancel?: () => void) => void} options.requireUnlock
	 *   Runs `then` once unlocked (asking for the PIN first if needed), or `onCancel` if the PIN pad is cancelled.
	 * @param {() => void} options.onDone A habit was just ticked done (to celebrate it).
	 */
	constructor({ store, lock, config, dayNames, views, requireUnlock, onDone }) {
		this.#store = store;
		this.#lock = lock;
		this.#config = config;
		this.#dayNames = dayNames;
		this.#views = views;
		this.#requireUnlock = requireUnlock;
		this.#onDone = onDone;
	}

	get #day() {
		return clock.day;
	}

	/* ---------- What the views show ---------- */

	/** Today's habits, most important first (left to right, then top to bottom). */
	todayItems() {
		const done = new Set(this.#store.entry(this.#day)?.done ?? []);
		return byPriority(this.#store.habitsOn(this.#day)).map((habit) => ({ ...this.#item(habit), done: done.has(habit.id) }));
	}

	/** Manage shows each habit's days, and tags for what's out of the ordinary. */
	manageItems() {
		return this.#store.habits.map((habit) => {
			const tags = [
				repeatText(habit),
				habit.startDate > this.#day && `starts ${this.#friendlyDate(habit.startDate)}`,
				habit.endDate && (habit.endDate < this.#day ? 'ended' : `ends ${this.#friendlyDate(habit.endDate)}`),
				habit.priority !== DEFAULT_PRIORITY && `${PRIORITY_LABELS[habit.priority].toLowerCase()} priority`,
				habit.hidden && !this.#isHidden(habit) && 'hidden', // a locked one shows it anyway
			].filter(Boolean);
			return { ...this.#item(habit), days: habit.days, tags };
		});
	}

	/** The ids of the habits planned for `day` (the calendar's days after today), most important first. */
	plannedOn(day) {
		return byPriority(this.#store.habitsOn(day)).map((habit) => habit.id);
	}

	/** A habit's colour class by its id (the calendar's dots); a deleted habit's is plain. */
	colorOf(id) {
		const habit = this.#store.find(id);
		return habit ? this.#colorClass(habit) : 'c-plain';
	}

	/** What Today says with no habits on it. */
	emptyToday() {
		return this.#store.habits.length ? NOTHING_TODAY : NO_HABITS;
	}

	/** What Your habits says with no habits. */
	emptyManage() {
		return NO_HABITS;
	}

	/** "3 of 12 done", for the sidebar. */
	progress() {
		const entry = this.#store.entry(this.#day);
		return { done: entry?.done.length ?? 0, total: entry?.total ?? 0 };
	}

	/** A new day started: a fresh log entry and a greeting. */
	startDay() {
		if (this.#store.syncDay(this.#day)) this.#store.save();
		const count = this.#store.entry(this.#day).total;
		const weekday = formatDate(fromKey(this.#day), this.#config.locale, 'weekday');
		const greeting = count ? say(messages.greeting, weekday, count) : say(messages.greetingFree, weekday);
		toast.show(greeting, { duration: 'long' });
	}

	/** Hidden habits were locked: no undoing (e.g. a hidden habit's delete) after that. */
	locked() {
		if (toast.hasAction()) toast.hide();
	}

	/* ---------- Taps ---------- */

	/** A habit card on Today: tick or untick it (a hidden one asks for the PIN first, then ticks). */
	tapCard(card) {
		if (card.busy()) return; // still animating the last tap
		const habit = this.#store.find(card.id);
		if (!habit) return; // a card left over from a moment ago (its habit is gone)
		if (this.#isHidden(habit)) {
			// After the PIN, the tap goes ahead (once the card has shown its name).
			this.#requireUnlock(card.element, () => tick().then(() => this.#toggle(card, habit.id)));
			return;
		}
		this.#toggle(card, habit.id);
	}

	/** Ticks or unticks a habit on Today, with its wiggle, and cheers if that deserves it. */
	#toggle(card, id) {
		if (!this.#store.find(id)) return; // deleted meanwhile (e.g. on another device)
		const done = this.#store.toggleDone(this.#day, id);
		card.playToggle(done);
		this.#store.save();
		if (done) this.#onDone();
	}

	/** A card in Manage: edit that habit (a hidden one asks for the PIN first). */
	tapManageCard(id, card) {
		const habit = this.#store.find(id);
		if (!habit) return;
		if (this.#isHidden(habit)) this.#requireUnlock(card, () => this.#edit(habit, card));
		else this.#edit(habit, card);
	}

	/** The + button. */
	add(origin) {
		this.#views.editor.edit(null, { colorIndex: this.#store.habits.length, origin });
	}

	/* ---------- Editor callbacks ---------- */

	/** Hidden tapped in the editor while hidden habits are locked: the PIN first, then back to the editor with it chosen. */
	unlockToHide(origin) {
		const { editor } = this.#views;
		this.#requireUnlock(origin, () => editor.chooseHidden(origin), () => editor.reopen(origin));
	}

	/** A new habit from the editor. */
	added(fields) {
		this.#store.add(fields);
		toast.show(fields.hidden ? say(messages.addedHidden) : say(messages.added, fields.name));
		this.#views.editor.close();
		this.#store.syncDay(this.#day);
		this.#store.save();
	}

	/** A change made in the editor (applies right away). */
	changed(habit, fields) {
		this.#store.update(habit, fields);
		this.#store.syncDay(this.#day);
		this.#store.saveSoon(this.#config.timing.saveDelayMs);
	}

	/** Delete tapped in the editor: ask first. */
	askDelete(habit, origin) {
		const { confirm, editor } = this.#views;
		confirm.ask({
			title: `Delete “${displayName(habit)}”?`,
			note: 'Past days in the calendar keep their ticks.',
			noLabel: 'Keep it',
			yesLabel: 'Delete',
			poof: true,
			origin,
			onNo: () => editor.reopen(origin),
			onYes: () => {
				const day = this.#day; // Undo may come after midnight: the tick belongs to this day
				const wasDone = this.#store.entry(day)?.done.includes(habit.id) ?? false;
				const removed = this.#store.remove(habit);
				this.#store.syncDay(day);
				this.#store.save();
				const gone = removed.habit;
				this.#offerUndo(gone.hidden ? 'Deleted a hidden habit' : `Deleted “${gone.name}”`, () => {
					this.#store.restore(removed);
					this.#store.syncDay(day);
					const { done } = this.#store.entry(day);
					if (wasDone && !done.includes(gone.id)) done.push(gone.id); // its tick comes back too
					if (day !== this.#day) this.#store.syncDay(this.#day);
					this.#store.save();
					toast.show(gone.hidden ? 'Hidden habit restored' : `Restored “${gone.name}”`, { duration: 'short' });
				});
			},
		});
	}

	/* ---------- Helpers ---------- */

	/** A toast with an "Undo" button, offered for `config.timing.undoMs`. */
	#offerUndo(message, undo) {
		toast.show(message, { duration: this.#config.timing.undoMs, action: { label: 'Undo', onTap: undo } });
	}

	#edit(habit, origin) {
		this.#views.editor.edit(habit, { name: displayName(habit), origin });
	}

	/** True for a hidden habit while hidden habits are locked. */
	#isHidden(habit) {
		return habit.hidden && !this.#lock.unlocked;
	}

	#colorClass(habit) {
		const colors = this.#config.colors;
		return `c-${colors.includes(habit.color) ? habit.color : colors[0]}`;
	}

	/** A habit as the views show it: id, colour, name (or hidden) and schedule. */
	#item(habit) {
		return {
			id: habit.id,
			colorClass: this.#colorClass(habit),
			name: habit.name,
			schedule: describeSchedule(habit, this.#dayNames),
			hidden: this.#isHidden(habit),
		};
	}

	/** "today", "tomorrow", or e.g. "Mon, Oct 5" (to go in the middle of a sentence). */
	#friendlyDate(day) {
		if (day === this.#day) return 'today';
		if (day === addDaysToKey(this.#day, 1)) return 'tomorrow';
		return formatDate(fromKey(day), this.#config.locale, 'short');
	}

}

/** A habit's name to show. */
function displayName(habit) {
	return habit.name ?? 'Hidden habit';
}
