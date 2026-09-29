
/**
 * Talks to server.py, which keeps the data files and can set the device's clock
 * and its screen's backlight.
 */

const DATA_URL = '/api/data';
const FILES_URL = '/api/files';
const CLOCK_URL = '/api/clock';
const DISPLAY_URL = '/api/display';
const FILE_HEADER = 'X-Troha-File'; // which data file was loaded; saves name it, so they can't land in another

let lastSave = Promise.resolve();
let fileName = null;

/** Loads the data file in use (as saved; see data_format.js). */
export async function loadData() {
	const response = await fetch(DATA_URL, { cache: 'no-store' });
	if (!response.ok) throw new Error(`Loading failed (${response.status})`);
	fileName = response.headers.get(FILE_HEADER);
	return response.json();
}

/** The name of the data file that was loaded, e.g. "habits". */
export function dataFileName() {
	return fileName;
}

/** A save that didn't work; `reason` is e.g. 'other-file', 'invalid' or 'offline'. */
export class SaveError extends Error {
	constructor(reason) {
		super(`Saving failed (${reason})`);
		this.reason = reason;
	}
}

/** Saves the data file. Saves are queued so they reach the server in order. Throws SaveError. */
export function saveData(data) {
	const body = JSON.stringify(data, null, '\t');
	const save = lastSave.catch(() => {}).then(async () => {
		let response;
		try {
			response = await fetch(DATA_URL, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', [FILE_HEADER]: fileName ?? '' },
				body,
			});
		} catch {
			throw new SaveError('offline');
		}
		if (!response.ok) {
			const answer = await response.json().catch(() => ({}));
			throw new SaveError(answer.reason ?? `status-${response.status}`);
		}
	});
	lastSave = save;
	return save;
}

/** Waits until every save so far has reached the server (or failed). */
export function savesDone() {
	return lastSave.catch(() => {});
}

/**
 * What a data file may be called (the server checks the same, in backend/data_files.py):
 * a-z, 0-9, _ and -, starting with a letter or number, up to 40 characters.
 */
export const FILE_NAME = {
	maxLength: 40,
	/** Typed text as a file name: lowercase, spaces become _, anything else is dropped. */
	clean: (text) => text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '').replace(/^[_-]+/, ''),
};

/** @returns {Promise<{files: string[], inUse: string}>} The data files' names, and the one in use. */
export async function listFiles() {
	const response = await fetch(FILES_URL, { cache: 'no-store' });
	if (!response.ok) throw new Error(`Listing failed (${response.status})`);
	return response.json();
}

/**
 * Switches to data file `name`; with `create`, makes it first (empty).
 * @returns {Promise<{ok: boolean, reason?: string}>} reason: 'exists', 'missing' or 'failed'.
 */
export function useFile(name, { create = false } = {}) {
	return post(FILES_URL, { name, create });
}

/**
 * Deletes data file `name` for good (the server won't delete the one in use).
 * @returns {Promise<{ok: boolean, reason?: string}>} reason: 'in-use', 'missing' or 'failed'.
 */
export function deleteFile(name) {
	return post(`${FILES_URL}/delete`, { name });
}

/**
 * Asks the device to set its clock from the network (time servers).
 * @returns {Promise<{ok: boolean, reason?: string}>} reason: 'offline', 'not-allowed', 'not-supported' or 'failed'.
 */
export function syncClock() {
	return post(`${CLOCK_URL}/sync`, {});
}

/**
 * Sets the device's clock by hand.
 * @param {{date: string, time: string}} when "YYYY-MM-DD" and "HH:MM", local time.
 * @returns {Promise<{ok: boolean, test?: boolean, reason?: string}>} test: not the Pi, so nothing was changed.
 */
export function setClock(when) {
	return post(CLOCK_URL, when);
}

/** True if the device's screen backlight can be controlled (e.g. a Pi touch display). */
export async function backlightSupported() {
	try {
		const response = await fetch(DISPLAY_URL, { cache: 'no-store' });
		return response.ok && (await response.json()).supported === true;
	} catch {
		return false;
	}
}

/**
 * Sets the screen's backlight.
 * @param {{brightness: number, on: boolean}} state brightness: 0.05 to 1 of full.
 * @returns {Promise<{ok: boolean, reason?: string}>} reason: 'not-supported', 'not-allowed' or 'failed'.
 */
export function setBacklight(state) {
	return post(DISPLAY_URL, state);
}

async function post(url, body) {
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		return await response.json();
	} catch {
		return { ok: false, reason: 'failed' };
	}
}
