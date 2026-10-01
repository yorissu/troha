
/**
 * Confetti, which anything can set off. components/overlays/confetti.svelte draws it
 * (it registers itself here while it's on screen).
 */

let layer = null;

export const confetti = {
	/** @param {{burst: (colors?: string[]) => void}|null} drawer */
	setLayer(drawer) {
		layer = drawer;
	},

	/** @param {string[]} [colors] Habit colour names for this burst (default: all of them). */
	burst(colors) {
		layer?.burst(colors);
	},
};
