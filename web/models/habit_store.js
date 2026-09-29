
/**
 * The habits, the daily log and the settings: loading, changing and saving them.
 */

import { fromKey, addDays, toKey } from '../core/dates.js';
import { habitsOn } from '../core/schedule.js';
import { loadData, saveData } from './api.js';
import { fromFile, toFile } from './data_format.js';

export class HabitStore {
	/** @type {ReturnType<typeof fromFile>} */
	data = null;

	#privateNames;
	#onSaveError;
	#saveTimer;

	/**
	 * @param {object} options
	 * @param {import('./private_names.js').PrivateNames} options.privateNames
	 * @param {(error: import('./api.js').SaveError) => void} options.onSaveError
	 */
	constructor({ privateNames, onSaveError }) {
		this.#privateNames = privateNames;
		this.#onSaveError = onSaveError;
	}

	async load() {
		this.data = fromFile(await loadData());
	}

	get habits() { return this.data.habits; }
	get settings() { return this.data.settings; }
	get security() { return this.data.security; }

	find(id) {
		return this.data.habits.find((habit) => habit.id === id);
	}

	/** The habits due on `day`. */
	habitsOn(day) {
		return habitsOn(this.data.habits, fromKey(day));
	}

	/** True once the data file has been loaded. */
	get loaded() {
		return this.data !== null;
	}

	/** The log entry of `day` ({ total, done }), if any. */
	entry(day) {
		return this.data.log[day];
	}

	/**
	 * Updates `day`'s log entry: how many habits are due and which are ticked.
	 * @returns {boolean} true if anything changed (so it needs saving).
	 */
	syncDay(day) {
		const dueIds = this.habitsOn(day).map((habit) => habit.id);
		const previous = this.data.log[day];
		const entry = { total: dueIds.length, done: (previous?.done ?? []).filter((id) => dueIds.includes(id)) };
		this.data.log[day] = entry;
		return JSON.stringify(previous) !== JSON.stringify(entry);
	}

	/** Removes `day`'s log entry (its counter in the calendar) completely. @returns the removed entry. */
	clearDay(day) {
		const entry = this.data.log[day];
		delete this.data.log[day];
		return entry;
	}

	/** Puts back log entries removed by clearDay() (undo). @param {Map<string, object>} entries day -> entry */
	restoreDays(entries) {
		for (const [day, entry] of entries) this.data.log[day] = entry;
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

	/** Adds a habit. @returns the new habit. */
	add(fields) {
		let id;
		do id = newId(); while (this.find(id)); // never two habits with one id
		const habit = { ...fields, id, nameEncrypted: null };
		this.data.habits.push(habit);
		return habit;
	}

	update(habit, fields) {
		Object.assign(habit, fields);
	}

	/** Removes a habit. @returns where it was in the list (for restore()). */
	remove(habit) {
		const index = this.data.habits.indexOf(habit);
		this.data.habits = this.data.habits.filter((h) => h !== habit);
		return index;
	}

	/** Puts a removed habit back where it was (undo). */
	restore(habit, index) {
		this.data.habits.splice(index, 0, habit);
	}

	/** Removes every private habit. @returns how many were removed. */
	removePrivate() {
		const count = this.data.habits.filter((habit) => habit.private).length;
		this.data.habits = this.data.habits.filter((habit) => !habit.private);
		return count;
	}

	/** Saves now (encrypting private names first). */
	async save() {
		clearTimeout(this.#saveTimer);
		if (!this.loaded) return; // nothing to save before loading
		try {
			await this.#privateNames.seal(this.data.habits);
			await saveData(toFile(this.data));
		} catch (error) {
			console.error(error);
			this.#onSaveError(error);
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
