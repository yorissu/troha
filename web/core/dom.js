
/**
 * Small DOM helpers shared by all components.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICON_SPRITE = 'assets/icons/icons.svg';

/**
 * Creates an element.
 *
 *   h('button', { className: 'pill', type: 'button', on: { click: go } }, 'Label')
 *
 * @param {string} tag
 * @param {object} [props]
 *   className, text, attrs (attributes), dataset, style (CSS custom properties or
 *   properties, set with setProperty), on (event listeners); anything else is
 *   assigned as a property (e.g. type, hidden, disabled, value).
 * @param {...(Node|string|null|false)} children
 */
export function h(tag, props = {}, ...children) {
	const { className, text, attrs, dataset, style, on, ...properties } = props;
	const element = document.createElement(tag);
	if (className) element.className = className;
	if (text !== undefined) element.textContent = text;
	for (const [name, value] of Object.entries(attrs ?? {})) {
		if (value !== null && value !== undefined && value !== false) element.setAttribute(name, value === true ? '' : value);
	}
	Object.assign(element.dataset, dataset ?? {});
	for (const [name, value] of Object.entries(style ?? {})) element.style.setProperty(name, value);
	for (const [type, listener] of Object.entries(on ?? {})) element.addEventListener(type, listener);
	Object.assign(element, properties);
	element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
	return element;
}

/** Creates an SVG element (for drawings built in code, like progress rings). */
export function svg(tag, attrs = {}, ...children) {
	const element = document.createElementNS(SVG_NS, tag);
	for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
	element.append(...children);
	return element;
}

/**
 * An icon from assets/icons/icons.svg.
 * @param {string} name The symbol id in the sprite, e.g. 'check'.
 * @param {string} [className]
 */
export function icon(name, className = '') {
	return svg('svg', { class: `icon ${className}`.trim(), viewBox: '0 0 24 24', 'aria-hidden': 'true' },
		svg('use', { href: `${ICON_SPRITE}#${name}` }));
}

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
	if (prefersReducedMotion()) return; // no animation to wait for
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

/** True when the system, or the Motion setting (Calm), asks for less motion. */
export function prefersReducedMotion() {
	return document.documentElement.classList.contains('calm') || matchMedia('(prefers-reduced-motion: reduce)').matches;
}
