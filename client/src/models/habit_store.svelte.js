
/**
 * The account's habits, daily log and settings: loading, changing and saving them.
 *
 * `data` is reactive ($state): components that show any of it update by themselves
 * when it changes. Its shape is described in server/troha_server/data_format.py.
 *
 * Saving sends all of it, with the version it was based on; the server turns away
 * a save based on an older version (e.g. another device changed things meanwhile),
 * and onSaveError hears about it.
 *
 * Hidden habits' names are null until the PIN unlocks them (showNames), and go back
 * to null when they're locked (hideNames); the server keeps them meanwhile.
 */

import { addDays, fromKey, toKey } from '../core/dates.js';
import { habitsOn } from '../core/schedule.js';
import { loadData, saveData } from './api.js';

export class HabitStore {
	/** @type {{settings: object, habits: object[], log: Object<string, {total: number, due?: string[], done: string[]}>}|null} */
	data = $state(null);

	#version = 0;
	#onSaveError;
	#saveTimer = null;
	#saving = 0; // saves on their way

	/** @param {{onSaveError: (error: import('./api.js').SaveError) => void}} options */
	constructor({ onSaveError }) {
		this.#onSaveError = onSaveError;
	}

	/** Loads everything. Throws ServerLost or Error. */
	async load() {
		const { version, data } = await loadData();
		this.#version = version;
		this.data = data;
	}

	/**
	 * Catches up with changes made elsewhere (another device), unless a change of
	 * this one is still waiting to be saved. @returns {Promise<boolean>} true if anything changed.
	 */
	async refresh() {
		if (!this.loaded || this.#saving || this.#saveTimer !== null) return false;
		const { version, data } = await loadData();
		if (version === this.#version || this.#saving || this.#saveTimer !== null) return false;
		this.#version = version;
		this.data = data;
		return true;
	}

	get loaded() { return this.data !== null; }
	get habits() { return this.data.habits; }
	get settings() { return this.data.settings; }

	find(id) {
		return this.data.habits.find((habit) => habit.id === id);
	}

	/** The habits due on `day`. */
	habitsOn(day) {
		return habitsOn(this.data.habits, fromKey(day));
	}

	/** The log entry of `day` ({ total, due, done }), if any. */
	entry(day) {
		return this.data.log[day];
	}

	/**
	 * Updates `day`'s log entry: which habits are due (and how many) and which are ticked.
	 * @returns {boolean} true if anything changed (so it needs saving).
	 */
	syncDay(day) {
		const dueIds = this.habitsOn(day).map((habit) => habit.id);
		const previous = this.data.log[day];
		const done = (previous?.done ?? []).filter((id) => dueIds.includes(id));
		const same = previous?.due?.length === dueIds.length && dueIds.every((id, i) => previous.due[i] === id);
		if (same && done.length === previous.done.length) return false;
		this.data.log[day] = { total: dueIds.length, due: dueIds, done };
		return true;
	}

	/** Ticks or unticks a habit on `day`. @returns {boolean} true if it is now done. */
	toggleDone(day, id) {
		if (!this.data.log[day]) this.syncDay(day); // e.g. a tap right as the day changes
		const { done } = this.data.log[day];
		const index = done.indexOf(id);
		if (index === -1) done.push(id);
		else done.splice(index, 1);
		return index === -1;
	}

	/** Days in a row with everything done, up to `day`. Days with nothing due don't break it. */
	streak(day) {
		let streak = 0;
		for (let date = fromKey(day); ; date = addDays(date, -1)) {
			const key = toKey(date);
			const entry = this.data.log[key];
			if (!entry) break;
			if (entry.total === 0) continue;
			if (entry.done.length >= entry.total) streak++;
			else if (key !== day) break; // today only counts once complete
		}
		return streak;
	}

	/** Adds a habit. @returns the new habit (as stored). */
	add(fields) {
		let id;
		do id = newId(); while (this.find(id)); // never two habits with one id
		this.data.habits.push({ ...fields, id });
		return this.data.habits.at(-1);
	}

	update(habit, fields) {
		Object.assign(habit, fields);
	}

	/** Removes a habit. @returns {{habit: object, index: number}} a copy and where it was (for restore()). */
	remove(habit) {
		const index = this.data.habits.indexOf(habit);
		const copy = $state.snapshot(habit);
		this.data.habits.splice(index, 1);
		return { habit: copy, index };
	}

	/** Puts a removed habit back where it was (undo). */
	restore({ habit, index }) {
		this.data.habits.splice(index, 0, structuredClone(habit));
	}

	/** Hidden habits' names, once the PIN unlocks them. @param {Object<string, string>} names id -> name */
	showNames(names) {
		for (const habit of this.data?.habits ?? []) {
			if (habit.hidden && habit.id in names) habit.name = names[habit.id];
		}
	}

	/** Forgets hidden habits' names (locking them). */
	hideNames() {
		for (const habit of this.data?.habits ?? []) {
			if (habit.hidden) habit.name = null;
		}
	}

	/** Saves now. */
	async save() {
		clearTimeout(this.#saveTimer);
		this.#saveTimer = null;
		if (!this.loaded) return; // nothing to save before loading
		this.#saving += 1;
		try {
			this.#version = await saveData(() => ({ version: this.#version, data: $state.snapshot(this.data) }));
		} catch (error) {
			console.error(error);
			this.#onSaveError(error);
		} finally {
			this.#saving -= 1;
		}
	}

	/** Saves after a short pause, so typing doesn't save on every letter. */
	saveSoon(delayMs) {
		clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => this.save(), delayMs);
	}
}

function newId() {
	return `h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
