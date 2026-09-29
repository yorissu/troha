
/**
 * Settings view: the sleep time, the device's clock (set by hand, or from the
 * network), the data file in use, and Motion. Changes apply right away. Times are picked
 * in the clock pop-up, dates in the calendar pop-up, files in the file pop-up.
 *
 * No login is needed. (Settings about private things, if ever added, should ask
 * for the PIN themselves.)
 */

import { clockText, toKey } from '../core/dates.js';
import { fitSleepIntoNight } from '../models/settings.js';
import { dataFileName, deleteFile, listFiles, savesDone, setClock, syncClock, useFile } from '../models/api.js';

const PROBLEMS = {
	offline: 'No network right now. Tap the date or the time to set it yourself.',
	'not-allowed': "This device doesn't let Troha set its clock yet (see the readme).",
	'not-supported': 'Getting the time from the network only works on the Raspberry Pi.',
	failed: "Couldn't set the clock.",
};

export class SettingsController {
	#store;
	#view;
	#datePicker;
	#timePicker;
	#filePicker;
	#confirm;
	#toast;
	#clock;
	#toastMs;
	#onTimeRangeChange;
	#onFileChange;

	/**
	 * @param {object} options
	 * @param {import('../models/habit_store.js').HabitStore} options.store
	 * @param {import('../views/pages/settings_view/settings_view.js').SettingsView} options.view
	 * @param {import('../views/sheets/date_picker/date_picker.js').DatePicker} options.datePicker
	 * @param {import('../views/sheets/time_picker/time_picker.js').TimePicker} options.timePicker
	 * @param {import('../views/sheets/file_picker/file_picker.js').FilePicker} options.filePicker
	 * @param {import('../views/sheets/confirm_sheet/confirm_sheet.js').ConfirmSheet} options.confirm For "Delete this file?".
	 * @param {import('../views/overlays/toast/toast.js').Toast} options.toast
	 * @param {import('../core/clock.js').Clock} options.clock
	 * @param {{short: number, normal: number, long: number}} options.toastMs How long toasts stay.
	 * @param {() => void} options.onTimeRangeChange Re-applies whatever follows the night or sleep time.
	 * @param {() => void} options.onFileChange Another data file is now in use (the app starts afresh with it).
	 */
	constructor({ store, view, datePicker, timePicker, filePicker, confirm, toast, clock, toastMs, onTimeRangeChange, onFileChange }) {
		this.#store = store;
		this.#view = view;
		this.#datePicker = datePicker;
		this.#timePicker = timePicker;
		this.#filePicker = filePicker;
		this.#confirm = confirm;
		this.#toast = toast;
		this.#clock = clock;
		this.#toastMs = toastMs;
		this.#onTimeRangeChange = onTimeRangeChange;
		this.#onFileChange = onFileChange;
	}

	/** Shows the view, fresh. */
	show() {
		this.#view.showTimeRanges(this.#store.settings);
		this.#view.showNow(new Date());
		this.#view.showClockNote(null);
		this.#view.showFile(dataFileName());
		this.#view.showMotion(this.#store.settings.motion);
		this.#view.hidden = false;
	}

	/** Motion: Calm switches every animation off (html.calm, see styles/base.css). */
	applyMotion() {
		document.documentElement.classList.toggle('calm', this.#store.settings.motion === 'calm');
	}

	/** A Motion choice tapped: use it and save it. */
	pickMotion(choice) {
		if (choice === this.#store.settings.motion) return;
		this.#store.settings.motion = choice;
		this.applyMotion();
		this.#view.showMotion(choice);
		this.#store.save();
	}

	hide() {
		this.#view.hidden = true;
	}

	/** Every second: the date and time on show. */
	tick(now) {
		if (!this.#view.hidden) this.#view.showNow(now);
	}

	/**
	 * A night or sleep time button: pick that time in the clock pop-up. Sleep times
	 * can only be picked inside the night (and never past each other); a new night
	 * pulls the sleep time inside it.
	 */
	pickRangeTime(range, which, origin) {
		const settings = this.#store.settings;
		const current = settings[range];
		const { nightTime: night, sleepTime: sleep } = settings;
		const limit = range === 'nightTime' ? null
			: which === 'from' ? { from: night.from, until: sleep.until } : { from: sleep.from, until: night.until };
		this.#timePicker.pick({
			value: current[which],
			title: `${range === 'nightTime' ? 'Night' : 'Sleep'} ${which}`,
			limit,
			origin,
			onPick: (time) => {
				this.#timePicker.close();
				settings[range] = { ...current, [which]: time };
				settings.sleepTime = fitSleepIntoNight(settings.nightTime, settings.sleepTime);
				this.#view.showTimeRanges(settings);
				this.#onTimeRangeChange();
				this.#store.save();
			},
			onCancel: () => this.#timePicker.close(),
		});
	}

	/** "Get from the network". */
	async syncTapped() {
		this.#view.setClockBusy(true);
		this.#view.showClockNote(null);
		const result = await syncClock();
		this.#view.setClockBusy(false);
		if (result.ok) this.#clockWasSet('Clock set from the network');
		else this.#view.showClockNote(PROBLEMS[result.reason] ?? PROBLEMS.failed);
	}

	/** Setting the date by hand: pick it in the calendar pop-up (the time stays). */
	pickDate(origin) {
		this.#datePicker.pick({
			value: toKey(new Date()),
			earliest: '2000-01-01',
			today: this.#clock.day,
			origin,
			onPick: (day) => {
				this.#datePicker.close();
				this.#setByHand({ date: day, time: clockText(new Date()) }, 'Date set');
			},
			onCancel: () => this.#datePicker.close(),
		});
	}

	/** Setting the time by hand: pick it in the clock pop-up (the date stays). */
	pickTime(origin) {
		this.#timePicker.pick({
			value: clockText(new Date()),
			origin,
			onPick: (time) => {
				this.#timePicker.close();
				this.#setByHand({ date: toKey(new Date()), time }, `Time set to ${time}`);
			},
			onCancel: () => this.#timePicker.close(),
		});
	}

	/** The data file button: pick a file, name a new one, or delete one. */
	async pickFile(origin) {
		const listing = await this.#listFiles();
		if (!listing) return;
		this.#filePicker.pick({
			...listing,
			origin,
			onUse: (name) => {
				if (name === dataFileName()) this.#filePicker.close();
				else this.#switchTo(name, false);
			},
			onCreate: (name) => this.#switchTo(name, true),
			onDelete: (name, element) => this.#askDelete(name, element, origin),
		});
	}

	/** A file's bin button: ask first, then back to the (refreshed) file list either way. */
	#askDelete(name, element, pickerOrigin) {
		const backToFiles = async () => {
			const listing = await this.#listFiles();
			if (listing) this.#filePicker.reopen(listing, pickerOrigin);
		};
		this.#confirm.ask({
			title: `Delete “${name}”?`,
			note: 'Its habits, ticks, settings and PIN are deleted for good.',
			noLabel: 'Keep it',
			yesLabel: 'Delete',
			poof: true,
			origin: element,
			onNo: backToFiles,
			onYes: async () => {
				const result = await deleteFile(name);
				this.#toast.show(result.ok ? `Deleted “${name}”` : `Couldn't delete “${name}”.`, { duration: this.#toastMs.short });
				setTimeout(backToFiles, 450); // after the "deleted" exit
			},
		});
	}

	async #listFiles() {
		try {
			return await listFiles();
		} catch {
			this.#toast.show("Couldn't list the data files. Is server.py running?");
			return null;
		}
	}

	/** Uses (or first creates) another data file. Everything is saved to the old one first. */
	async #switchTo(name, create) {
		await this.#store.save();
		await savesDone();
		const result = await useFile(name, { create });
		if (result.ok) {
			this.#filePicker.close();
			this.#onFileChange();
		} else if (result.reason === 'exists') {
			this.#filePicker.markTaken();
		} else {
			this.#toast.show(`Couldn't switch to “${name}”.`);
		}
	}

	async #setByHand(when, message) {
		const result = await setClock(when);
		// Not the Pi (e.g. while developing): it can be tried, but the clock stays as it is.
		if (result.ok && result.test) this.#toast.show(`Test only, the clock stays as it is: ${when.date} ${when.time}`, { duration: this.#toastMs.long });
		else if (result.ok) this.#clockWasSet(message);
		else this.#view.showClockNote(PROBLEMS[result.reason] ?? PROBLEMS.failed);
	}

	#clockWasSet(message) {
		this.#view.showClockNote(null);
		this.#view.showNow(new Date());
		this.#toast.show(message, { duration: this.#toastMs.normal });
	}
}
