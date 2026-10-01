
/**
 * Talks to troha-server (its API is described in server/troha_server/app.py).
 *
 * Every answer comes back as { ok, status, reason?, ...the rest of the JSON }. Two
 * answers matter to the whole page, whichever request gets them, so they're
 * reported once through watchServer():
 *   signed out   the session ended (e.g. after days without use): sign in again
 *   no license   the account's license ended
 *
 * Once the server doesn't answer a request (or answers too late), no more requests
 * are sent: a change that couldn't be saved must never be saved later. The page
 * then waits for the server to answer again and reloads (see ServerController).
 */

const HEALTH_URL = '/api/health';

let lastSave = Promise.resolve();
let timeoutMs = 10 * 1000;
let reachable = true;
let handlers = { onLost: () => {}, onSignedOut: () => {}, onNoLicense: () => {} };

/**
 * Sets how long a request may take, and what to do when the server is lost, the
 * session ends, or the license does.
 * @param {{timeoutMs: number, onLost: () => void, onSignedOut: () => void, onNoLicense: () => void}} options
 *   onLost is called once.
 */
export function watchServer(options) {
	({ timeoutMs } = options);
	handlers = { ...handlers, ...options };
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
	handlers.onLost();
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

/**
 * Sends a request and reads the answer. Throws ServerLost if the server is (or was) down.
 * @param {'GET'|'POST'|'PUT'} method
 * @param {string} url
 * @param {object} [body] Sent as JSON (every change is a JSON request; see the server's check_request).
 * @param {{quiet?: boolean}} [options] quiet: don't report "signed out" (e.g. checking whether anyone is signed in).
 * @returns {Promise<{ok: boolean, status: number, reason?: string, [key: string]: any}>}
 */
export async function call(method, url, body, { quiet = false } = {}) {
	if (!reachable) throw new ServerLost();
	let response;
	try {
		response = await fetch(url, {
			method,
			cache: 'no-store',
			credentials: 'same-origin',
			signal: AbortSignal.timeout(timeoutMs),
			headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
			body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
		});
	} catch {
		serverLost();
		throw new ServerLost();
	}
	const answer = await response.json().catch(() => ({}));
	const result = { ...answer, ok: response.ok && answer.ok !== false, status: response.status };
	if (!result.ok) result.reason ??= `status-${response.status}`;
	if (result.reason === 'signed-out' && !quiet) handlers.onSignedOut();
	if (result.reason === 'license') handlers.onNoLicense();
	return result;
}

/** A save that didn't work; `reason` is e.g. 'conflict' (changed elsewhere), 'locked' or 'lost' (the server is down). */
export class SaveError extends Error {
	constructor(reason) {
		super(`Saving failed (${reason})`);
		this.reason = reason;
	}
}

/** Loads the account's data. @returns {Promise<{version: number, data: object}>} Throws ServerLost or Error. */
export async function loadData() {
	const answer = await call('GET', '/api/data');
	if (!answer.ok) throw new Error(`Loading failed (${answer.reason})`);
	return { version: answer.version, data: answer.data };
}

/**
 * Saves the account's data. Saves are queued, so they reach the server in order,
 * each based on the version the one before it made.
 * @param {() => {version: number, data: object}} snapshot What to save, taken when its turn comes.
 * @returns {Promise<number>} The new version. Throws SaveError.
 */
export function saveData(snapshot) {
	const save = lastSave.catch(() => {}).then(async () => {
		const { version, data } = snapshot();
		let answer;
		try {
			answer = await call('PUT', '/api/data', { version, data });
		} catch {
			throw new SaveError('lost');
		}
		if (!answer.ok) throw new SaveError(answer.reason);
		return answer.version;
	});
	lastSave = save;
	return save;
}

/** Waits until every save so far has reached the server (or failed). */
export function savesDone() {
	return lastSave.catch(() => {});
}
