
/**
 * Timeout ring: turns an element's own border into a countdown. The border becomes
 * a faint track, and a line along it empties as time runs out, starting from the
 * top centre.
 *
 * Any element can have one (the lock and screen buttons do, and so does the
 * toast). It measures the element's real size and corner radius, so it fits any
 * shape: square, pill or round. The element's CSS sets the colour with --timeout-color.
 * (Styles: .has-timeout-ring in styles/controls.css.)
 *
 * In markup, use the action:  <button use:timeoutRing={fraction}>  (1 = full, 0 = empty,
 * null = none). Or make one in code and let it count down by itself (run).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export class TimeoutRing {
	#host;
	#svg = document.createElementNS(SVG_NS, 'svg');
	#path = document.createElementNS(SVG_NS, 'path');
	#countdown = null; // the running animation while it counts down by itself (run)
	#resize;

	/** @param {HTMLElement} host The element whose border becomes the countdown. */
	constructor(host) {
		this.#host = host;
		this.#svg.setAttribute('class', 'timeout-ring');
		this.#svg.setAttribute('aria-hidden', 'true');
		this.#svg.setAttribute('hidden', '');
		this.#path.setAttribute('class', 'timeout-fill');
		this.#path.setAttribute('pathLength', '1');
		this.#svg.append(this.#path);
		host.classList.add('has-timeout-ring');
		host.append(this.#svg);
		this.#resize = new ResizeObserver(() => this.#fit());
		this.#resize.observe(host);
	}

	/**
	 * The countdown: 1 = full, 0 = empty. `null` hides it.
	 * @param {number|null} fraction
	 */
	setTimeLeft(fraction) {
		this.#countdown?.cancel();
		this.#countdown = null;
		this.#svg.toggleAttribute('hidden', fraction === null); // an SVG element has no .hidden
		this.#host.classList.toggle('timing', fraction !== null);
		if (fraction === null) return;
		// Set on the path itself: Chrome doesn't redraw it when an inherited variable changes.
		this.#path.style.strokeDashoffset = (1 - fraction).toFixed(4);
	}

	/** Counts down by itself, smoothly, from full to empty over `durationMs`. */
	run(durationMs) {
		this.setTimeLeft(1);
		this.#countdown = this.#path.animate(
			[{ strokeDashoffset: 0 }, { strokeDashoffset: 1 }],
			{ duration: durationMs, easing: 'linear', fill: 'forwards' });
	}

	destroy() {
		this.#resize.disconnect();
		this.#svg.remove();
		this.#host.classList.remove('has-timeout-ring', 'timing');
	}

	/** Draws the line exactly on the border: a rounded rectangle starting at the top centre. */
	#fit() {
		const width = this.#host.offsetWidth;
		const height = this.#host.offsetHeight;
		if (!width || !height) return;
		const style = getComputedStyle(this.#host);
		const border = parseFloat(style.borderTopWidth) || 1;
		const half = border / 2;
		const corner = style.borderTopLeftRadius;
		const cornerPx = corner.endsWith('%') ? (parseFloat(corner) / 100) * width : parseFloat(corner) || 0;
		const radius = Math.max(0, Math.min(cornerPx, width / 2, height / 2) - half);
		const [left, top, right, bottom] = [half, half, width - half, height - half];

		this.#svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
		Object.assign(this.#svg.style, { top: `${-border}px`, left: `${-border}px`, width: `${width}px`, height: `${height}px` });
		this.#path.style.strokeWidth = `${border}`;
		this.#path.setAttribute('d', [
			`M${width / 2} ${top}`,
			`H${right - radius}`, `A${radius} ${radius} 0 0 1 ${right} ${top + radius}`,
			`V${bottom - radius}`, `A${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`,
			`H${left + radius}`, `A${radius} ${radius} 0 0 1 ${left} ${bottom - radius}`,
			`V${top + radius}`, `A${radius} ${radius} 0 0 1 ${left + radius} ${top}`,
			'Z',
		].join(' '));
	}
}

/** The action: <element use:timeoutRing={fraction}> (1 = full, 0 = empty, null = none). */
export function timeoutRing(host, fraction) {
	const ring = new TimeoutRing(host);
	ring.setTimeLeft(fraction ?? null);
	return {
		update: (next) => ring.setTimeLeft(next ?? null),
		destroy: () => ring.destroy(),
	};
}
