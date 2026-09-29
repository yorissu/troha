
/**
 * First look: gives the page the theme and dimness it had last time before it's
 * first drawn, so a reload doesn't flash bright while the data file loads.
 *
 * It's a plain script at the top of index.html (not a module like the rest, which
 * run only after the page is drawn). The controllers keep what it reads up to date
 * (core/look_memory.js); the data file stays in charge once it's loaded.
 */

(() => {
	try {
		const look = JSON.parse(localStorage.getItem('troha.look') ?? '{}'); // the key look_memory.js writes
		const root = document.documentElement;
		if (look.theme === 'dark' || look.theme === 'light') root.dataset.theme = look.theme;
		if (typeof look.dim === 'number') root.style.setProperty('--start-dim', String(look.dim));
	} catch {
		// No storage here (e.g. a private window): the page starts light, as it would anyway.
	}
})();
