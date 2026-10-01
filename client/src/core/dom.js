
/**
 * Small DOM helpers for animations and form marks, shared by the components.
 * (The components themselves are built with Svelte markup.)
 */

/**
 * Marks a field as missing or wrong, in place: it turns red and shakes (see
 * .invalid in styles/controls.css). Nothing is added, so the layout doesn't move.
 * @returns {null} (handy for `return markInvalid(field)`)
 */
export function markInvalid(element) {
	element.classList.add('invalid');
	element.setAttribute('aria-invalid', 'true');
	replayAnimation(element, 'shake');
	return null;
}

/** Undoes markInvalid(). */
export function clearInvalid(element) {
	element.classList.remove('invalid', 'shake');
	element.removeAttribute('aria-invalid');
}

/** Restarts a CSS animation class (removing `others` first) so it plays again. */
export function replayAnimation(element, className, others = [className]) {
	element.classList.remove(...others);
	void element.offsetWidth; // let the browser notice the removal
	element.classList.add(className);
}

/** Marks `element` busy (class "busy") until its current CSS animation ends. */
export function lockUntilAnimationEnds(element) {
	element.classList.add('busy');
	const animation = getComputedStyle(element).animationName; // the one just started
	const unlock = (event) => {
		// Only that animation of the element itself counts: not ones bubbling up from
		// inside it, nor an earlier one (e.g. its pop-in) that the new one cut short.
		if (event && (event.target !== element || event.animationName !== animation)) return;
		element.classList.remove('busy');
		clearTimeout(fallback);
		element.removeEventListener('animationend', unlock);
		element.removeEventListener('animationcancel', unlock);
	};
	const fallback = setTimeout(unlock, 1000); // safety net if no end event arrives
	element.addEventListener('animationend', unlock);
	element.addEventListener('animationcancel', unlock);
}

/** Where `element` is on screen, or null if it isn't (none given, removed, or hidden). */
export function visibleRect(element) {
	if (!element?.isConnected) return null;
	const rect = element.getBoundingClientRect();
	return rect.width || rect.height ? rect : null;
}
