
/**
 * Talks to server.py, which keeps the data files and can set the device's clock
 * and its screen's backlight.
 *
 * Once the server doesn't answer a request (or answers too late), no more requests
 * are sent: a change that couldn't be saved must never be saved later. The page
 * then waits for the server to be started again (on the Pi, troha.service does
 * that) and reloads (see ServerController).
 */

const DATA_URL = '/api/data';
const FILES_URL = '/api/files';
const CLOCK_URL = '/api/clock';
const DISPLAY_URL = '/api/display';
const HEALTH_URL = '/api/health';
const FILE_HEADER = 'X-Troha-File'; // which data file was loaded; saves name it, so they can't land in another
const SLOW_MS = 90 * 1000;          // setting the clock from the network may take this long

let lastSave = Promise.resolve();
let fileName = null;
let timeoutMs = 10 * 1000;
let reachable = true;
let onLost = () => {};

/**
 * Sets how long a request may take, and what to do once the server is lost.
 * @param {{timeoutMs: number, onLost: () => void}} options onLost is called once.
 */
export function watchServer(options) {
	({ timeoutMs, onLost } = options);
}

/** A request that wasn't sent or answered: the server is down (or was, earlier). */
export class ServerLost extends Error {
	constructor() {
		super("The server isn't answering");
	}
}

/** From now on, sends no more requests (see the top of this file). */
export function serverLost() {
	if (!reachable) return;
	reachable = false;
	onLost();
}

/** True if the server answers its health check right now (also after it was lost). */
export async function serverAnswers() {
	try {
		const response = await fetch(HEALTH_URL, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
		return response.ok;
	} catch {
		return false;
	}
}

/** fetch(), unless the server is lost; a request it doesn't answer in time loses it. Throws ServerLost. */
async function request(url, { slow = false, ...options } = {}) {
	if (!reachable) throw new ServerLost();
	try {
		return await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(slow ? SLOW_MS : timeoutMs), ...options });
	} catch {
		serverLost();
		throw new ServerLost();
	}
}

/** request(), then an Error unless the server said it worked. Throws ServerLost or Error. */
async function requestOk(url, options) {
	const response = await request(url, options);
	if (!response.ok) throw new Error(`${url} failed (${response.status})`);
	return response;
}

/** Loads the data file in use (as saved; see data_format.js). */
export async function loadData() {
	const response = await requestOk(DATA_URL);
	fileName = response.headers.get(FILE_HEADER);
	return response.json();
}

/** The name of the data file that was loaded, e.g. "habits". */
export function dataFileName() {
	return fileName;
}

/** A save that didn't work; `reason` is e.g. 'other-file', 'invalid' or 'lost' (the server is down). */
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
			response = await request(DATA_URL, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', [FILE_HEADER]: fileName ?? '' },
				body,
			});
		} catch {
			throw new SaveError('lost');
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

/** @returns {Promise<{files: string[], inUse: string}>} The data files' names, and the one in use. Throws ServerLost. */
export async function listFiles() {
	const response = await requestOk(FILES_URL);
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
	return post(`${CLOCK_URL}/sync`, {}, { slow: true });
}

/**
 * Sets the device's clock by hand.
 * @param {{date: string, time: string}} when "YYYY-MM-DD" and "HH:MM", local time.
 * @returns {Promise<{ok: boolean, test?: boolean, reason?: string}>} test: not the Pi, so nothing was changed.
 */
export function setClock(when) {
	return post(CLOCK_URL, when, { slow: true });
}

/** True if the device's screen backlight can be controlled (e.g. a Pi touch display). */
export async function backlightSupported() {
	try {
		const response = await requestOk(DISPLAY_URL);
		return (await response.json()).supported === true;
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

/** Sends a small JSON request. Answers {ok: false, reason: 'lost'} if the server is down. */
async function post(url, body, { slow = false } = {}) {
	let response;
	try {
		response = await request(url, {
			slow,
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	} catch {
		return { ok: false, reason: 'lost' };
	}
	try {
		return await response.json();
	} catch {
		return { ok: false, reason: 'failed' };
	}
}
