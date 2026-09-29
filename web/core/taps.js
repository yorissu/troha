
/**
 * Taps on the touchscreen, made reliable: one touch is one tap, and a tap is never
 * lost. Touchscreens can be messy:
 *   - some touchscreens and desktops send a copy of every touch as a mouse press
 *     (and so a second click);
 *   - a bouncy touch panel can report one tap several times;
 *   - a button that squishes when pressed can shrink out from under a finger near
 *     its edge, so the tap lands on whatever is underneath.
 *
 * ignoreCopiedTaps() and keepEdgeTaps() look after every button on the page;
 * listenForKeyPresses() is for on-screen keys (the PIN pad and the keyboard),
 * which type the moment they're touched.
 */

const MOUSE_AFTER_TOUCH_MS = 600; // a mouse press this soon after a touch is a copy of it
const KEY_BOUNCE_MS = 90;         // the same key again this soon is the screen bouncing
const CLICK_BOUNCE_MS = 120;      // the same button clicked again this soon is too

/**
 * Drops extra clicks: the mouse copy of a touch, and the same button clicked again
 * within a moment (e.g. a cycle button that would otherwise skip a choice). Set up
 * before anything else listens for clicks, so the extra ones reach nobody.
 * @param {Document|HTMLElement} root Where to listen (the whole page).
 */
export function ignoreCopiedTaps(root) {
	let lastTouchAt = -Infinity;
	let last = { target: null, at: -Infinity };
	root.addEventListener('pointerdown', (event) => {
		if (event.pointerType === 'touch') lastTouchAt = performance.now();
	}, true);
	root.addEventListener('click', (event) => {
		if (!event.isTrusted) return; // clicks made in code (e.g. by keepEdgeTaps) pass
		const now = performance.now();
		const target = event.target.closest?.('button, [role="button"]') ?? event.target;
		const mouseCopy = event.pointerType === 'mouse' && now - lastTouchAt < MOUSE_AFTER_TOUCH_MS;
		const bounce = target === last.target && now - last.at < CLICK_BOUNCE_MS;
		if (mouseCopy || bounce) {
			event.stopImmediatePropagation();
			event.preventDefault();
			return;
		}
		last = { target, at: now };
	}, true);
}

/**
 * A tap near the edge of a squishing element (.squish) still counts.
 *
 * A pressed .squish element shrinks (see styles/controls.css). When the finger is
 * near its edge, the element slides out from under it, so the browser sends the
 * click to whatever is underneath instead and the tap is lost, though the element
 * squished. This catches that case: a press that starts on a .squish element and
 * ends within the size it had before shrinking clicks that element.
 * @param {Document|HTMLElement} root Where to listen (the whole page).
 */
export function keepEdgeTaps(root) {
	let pressed = null; // { element, rect } of the last press on a .squish element

	root.addEventListener('pointerdown', (event) => {
		const element = event.isPrimary ? event.target.closest?.('.squish') : null;
		// Measured before the shrink starts, so it's the element's full size.
		pressed = element ? { element, rect: element.getBoundingClientRect() } : null;
	}, true);
	root.addEventListener('pointercancel', () => { pressed = null; }, true); // e.g. became a scroll

	root.addEventListener('click', (event) => {
		if (!pressed) return;
		const { element, rect } = pressed;
		pressed = null;
		if (element.contains(event.target)) return; // an ordinary tap
		if (!element.isConnected || element.disabled) return;
		const { clientX: x, clientY: y } = event;
		if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return; // slid off on purpose
		event.stopPropagation(); // not a tap on what's underneath
		event.preventDefault();
		element.click();
	}, true);
}

/**
 * Calls onPress(key) once for each press on an on-screen key inside `container`.
 * A key counts the moment a finger (or the mouse) goes down on it, not on the
 * click that follows; mouse copies of touches and bounces are ignored.
 * @param {HTMLElement} container
 * @param {string} selector What a key is, e.g. '.key'. Keys are told apart by their
 *   data-key, so a key redrawn between presses still counts as the same key.
 * @param {(key: HTMLElement) => void} onPress
 */
export function listenForKeyPresses(container, selector, onPress) {
	let lastTouchAt = -Infinity;
	let last = { name: null, at: -Infinity };
	container.addEventListener('pointerdown', (event) => {
		if (!event.isPrimary || event.button !== 0) return;
		const key = event.target.closest(selector);
		if (!key || !container.contains(key) || key.disabled) return;
		const now = performance.now();
		if (event.pointerType === 'touch') lastTouchAt = now;
		else if (event.pointerType === 'mouse' && now - lastTouchAt < MOUSE_AFTER_TOUCH_MS) return;
		const name = key.dataset.key ?? key;
		if (name === last.name && now - last.at < KEY_BOUNCE_MS) return;
		last = { name, at: now };
		onPress(key);
	});
}
