
/**
 * Remembers the look the page last had (its theme, and how much the page itself
 * is darkened) in this browser, for first_look.js to use on the next load before
 * anything else is ready. Only a head start: the data file stays in charge.
 */

const KEY = 'troha.look'; // first_look.js reads the same

let look = null;

/** Merges `part` (e.g. {theme: 'dark'} or {dim: 0.4}) into what's remembered, if it changed. */
export function rememberLook(part) {
	try {
		look ??= JSON.parse(localStorage.getItem(KEY) ?? '{}');
		if (Object.entries(part).every(([name, value]) => look[name] === value)) return;
		Object.assign(look, part);
		localStorage.setItem(KEY, JSON.stringify(look));
	} catch {
		look ??= {}; // no storage here: the next load just starts light
	}
}
