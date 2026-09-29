
/**
 * Tour: a walkthrough layer over the whole app. Everything is dimmed except what's
 * being explained (the spotlights, e.g. a view and its button in the header),
 * whose own outlines are drawn over in the tour's colour; a card next to the main
 * one explains it, with Back, Next and "Skip tour".
 *
 * Nothing but the card can be tapped while it's on: four transparent panels
 * around the main spotlight, and a cover over it, catch every touch. A step can
 * leave the main spotlight open (`interactive`), e.g. to type a new PIN.
 *
 * The spotlights follow their targets as they move (e.g. a pop-up swinging in),
 * and glide from one step's targets to the next; the dimming (one layer with a
 * rounded hole cut out for each spotlight) is redrawn every frame to match them.
 */

import { h, replayAnimation } from '../../../core/dom.js';
import { Component } from '../../base/component/component.js';
import { Button } from '../../base/button/button.js';

// In rem (so they scale with the screen, like everything else).
const PLAIN_BORDER = .3;  // the outline's width on something without a border of its own
const PLAIN_RADIUS = 1.25; // and its corners, on something without rounded corners either
const CARD_GAP = 1.25;    // between the main spotlight and the card
const EDGE = 1;           // the card keeps this far from the edges of the screen

export class Tour extends Component {
	#dim = h('div', { className: 'tour-dim' });
	#spots = []; // one outline per spotlight; the first is the main one
	#cover = h('div', { className: 'tour-block tour-cover' });
	#panels = Array.from({ length: 4 }, () => h('div', { className: 'tour-block' }));
	#card = h('div', { className: 'tour-card', attrs: { role: 'dialog', 'aria-live': 'polite' } });
	#title = h('h2', { className: 'tour-title' });
	#text = h('p', { className: 'tour-text' });
	#progress = h('span', { className: 'tour-progress' });
	#back;
	#next;
	#step = null;
	#lastHoles = null; // the targets' places last time, to only move things when they move
	#lastDim = null;   // the dimming's last shape
	#frame = 0;

	/**
	 * @param {object} options
	 * @param {() => void} options.onNext
	 * @param {() => void} options.onBack
	 * @param {() => void} options.onSkip
	 */
	constructor({ onNext, onBack, onSkip }) {
		super(h('div', { className: 'tour', hidden: true }));
		this.#back = new Button({ className: 'button', label: 'Back', onTap: onBack });
		this.#next = new Button({ className: 'button primary', label: 'Next', onTap: onNext });
		const skip = new Button({ className: 'button link', label: 'Skip tour', onTap: onSkip });
		this.#card.append(
			h('div', { className: 'tour-top' }, this.#progress, skip.element),
			this.#title,
			this.#text,
			h('div', { className: 'tour-actions' }, this.#back.element, this.#next.element));
		this.element.append(this.#dim, ...this.#panels, this.#cover, this.#card);

		// Keys too: while the tour is on, only a step that's left open may be typed into.
		document.addEventListener('keydown', (event) => {
			if (this.element.hidden || this.#step?.interactive) return;
			event.stopImmediatePropagation();
			event.preventDefault();
		}, true);
	}

	/** True while the tour is on screen. */
	get active() {
		return !this.element.hidden;
	}

	/**
	 * Shows a step.
	 * @param {object} step
	 * @param {() => (Element|null)} [step.target] The main thing to spotlight (none: just the card, in the middle).
	 * @param {() => Element[]} [step.also] More things to spotlight with it (e.g. the view's button).
	 * @param {boolean} [step.interactive] Let the main spotlit thing be tapped (and typed into).
	 * @param {string} step.title
	 * @param {string} step.text
	 * @param {number} step.number 1, 2, 3…
	 * @param {number} step.count How many steps there are.
	 * @param {string} [step.nextLabel] Default "Next".
	 * @param {boolean} [step.canGoBack]
	 */
	show(step) {
		const first = !this.active;
		this.#step = step;
		this.element.hidden = false;
		this.#title.textContent = step.title;
		this.#text.textContent = step.text;
		this.#progress.textContent = `${step.number} of ${step.count}`;
		this.#next.setLabel(step.nextLabel ?? 'Next');
		this.#back.hidden = !step.canGoBack;
		this.#cover.hidden = Boolean(step.interactive);
		this.#lastHoles = null; // place everything afresh
		this.element.classList.toggle('starting', first); // no gliding in from nowhere
		this.#follow();
		replayAnimation(this.#card, 'arriving');
		for (const spot of this.#spots) replayAnimation(spot, 'arriving');
		cancelAnimationFrame(this.#frame);
		this.#frame = requestAnimationFrame(() => this.#track());
	}

	hide() {
		cancelAnimationFrame(this.#frame);
		this.element.hidden = true;
		this.#step = null;
	}

	/** Every frame while on: keeps the spotlights on their targets, and the dimming on the spotlights. */
	#track() {
		if (!this.active) return;
		this.#follow();
		this.element.classList.remove('starting');
		this.#frame = requestAnimationFrame(() => this.#track());
	}

	/** Places the spotlights, the panels and the card where the targets are now, and redraws the dimming. */
	#follow() {
		const layer = this.element.getBoundingClientRect();
		const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
		const main = holeAround(this.#step?.target?.(), layer, rem); // null: nothing to light (e.g. the welcome)
		const extras = (this.#step?.also?.() ?? []).map((target) => holeAround(target, layer, rem)).filter(Boolean);
		const holes = main ? [main, ...extras] : extras;

		const key = holes.map(({ left, top, width, height, radius }) => [left, top, width, height, radius].map(Math.round).join(' ')).join('|');
		if (key !== this.#lastHoles) {
			this.#lastHoles = key;
			this.element.classList.toggle('no-target', !main);
			this.#placeSpots(holes);
			this.#placeBlocks(main ?? { left: layer.width / 2, top: layer.height / 2, width: 0, height: 0 }, layer);
			this.#placeCard(main, holes, layer, rem);
		}
		this.#drawDim(layer);
	}

	/** One outline per hole (made or removed as needed). */
	#placeSpots(holes) {
		while (this.#spots.length < holes.length) {
			const spot = h('div', { className: 'tour-spot' });
			this.#dim.after(spot);
			this.#spots.push(spot);
		}
		this.#spots.forEach((spot, i) => {
			const hole = holes[i];
			spot.hidden = !hole;
			if (!hole) return;
			place(spot, hole);
			spot.style.borderRadius = `${hole.radius}px`;
			spot.style.setProperty('--spot-border', `${hole.border}px`);
		});
	}

	/** The panels around the main spotlight, and the cover over it, catch every touch. */
	#placeBlocks(hole, layer) {
		place(this.#cover, hole);
		const right = hole.left + hole.width;
		const bottom = hole.top + hole.height;
		const [above, below, before, after] = this.#panels;
		place(above, { left: 0, top: 0, width: layer.width, height: Math.max(0, hole.top) });
		place(below, { left: 0, top: bottom, width: layer.width, height: Math.max(0, layer.height - bottom) });
		place(before, { left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height });
		place(after, { left: right, top: hole.top, width: Math.max(0, layer.width - right), height: hole.height });
	}

	/**
	 * Dims everything but the spotlights: a hole for each, cut where it is right now,
	 * with its corners (so the holes glide along with the outlines).
	 */
	#drawDim(layer) {
		const holes = this.#spots
			.filter((spot) => !spot.hidden && !this.element.classList.contains('no-target'))
			.map((spot) => {
				const box = spot.getBoundingClientRect();
				const radius = parseFloat(getComputedStyle(spot).borderTopLeftRadius) || 0;
				return { left: box.left - layer.left, top: box.top - layer.top, width: box.width, height: box.height, radius };
			})
			.filter((hole) => hole.width > 0 && hole.height > 0);
		const shape = holes.length
			? `path(evenodd, "M0 0H${layer.width}V${layer.height}H0Z ${holes.map(roundedRect).join(' ')}")`
			: 'none';
		if (shape === this.#lastDim) return;
		this.#lastDim = shape;
		this.#dim.style.clipPath = shape;
	}

	/**
	 * The card goes where there's room without covering any spotlight: below the main
	 * one, above it, beside it, or (if none fits) in the middle.
	 */
	#placeCard(hole, holes, layer, rem) {
		const gap = CARD_GAP * rem;
		const edge = EDGE * rem;
		const width = this.#card.offsetWidth;
		const height = this.#card.offsetHeight;
		const clampX = (x) => Math.min(Math.max(x, edge), layer.width - width - edge);
		const clampY = (y) => Math.min(Math.max(y, edge), layer.height - height - edge);
		const middle = { x: (layer.width - width) / 2, y: (layer.height - height) / 2 };
		let spot = middle;
		if (hole) {
			const centreX = hole.left + hole.width / 2 - width / 2;
			const centreY = hole.top + hole.height / 2 - height / 2;
			const spots = [
				{ fits: hole.top + hole.height + gap + height + edge <= layer.height, x: clampX(centreX), y: hole.top + hole.height + gap },
				{ fits: hole.top - gap - height >= edge, x: clampX(centreX), y: hole.top - gap - height },
				{ fits: hole.left + hole.width + gap + width + edge <= layer.width, x: hole.left + hole.width + gap, y: clampY(centreY) },
				{ fits: hole.left - gap - width >= edge, x: hole.left - gap - width, y: clampY(centreY) },
			];
			const coversNothing = ({ x, y }) => holes.every((other) => !overlaps({ left: x, top: y, width, height }, other));
			spot = spots.find((s) => s.fits && coversNothing(s)) ?? spots.find((s) => s.fits) ?? { x: middle.x, y: clampY(centreY) };
		}
		this.#card.style.left = `${spot.x}px`;
		this.#card.style.top = `${spot.y}px`;
	}
}

/**
 * The spotlight on `target`: exactly its box (in px within the layer), its corner radius,
 * and its border's width, so the outline lies on the target's own; null if it isn't on
 * screen. Something with no border (or no rounded corners) gets a plain one.
 */
function holeAround(target, layer, rem) {
	if (!target?.isConnected) return null;
	const box = target.getBoundingClientRect();
	if (!box.width && !box.height) return null;
	const style = getComputedStyle(target);
	const corner = style.borderTopLeftRadius;
	const radius = corner.endsWith('%') ? (parseFloat(corner) / 100) * Math.min(box.width, box.height) : parseFloat(corner) || 0;
	const border = parseFloat(style.borderTopWidth) || 0;
	return {
		left: box.left - layer.left,
		top: box.top - layer.top,
		width: box.width,
		height: box.height,
		radius: radius || (border ? 0 : PLAIN_RADIUS * rem),
		border: border || PLAIN_BORDER * rem,
	};
}

/** True if two boxes overlap. */
function overlaps(a, b) {
	return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

/** An SVG path for a rectangle with rounded corners (the radius shrinks to fit small ones). */
function roundedRect({ left, top, width, height, radius }) {
	const r = Math.min(radius, width / 2, height / 2);
	const right = left + width;
	const bottom = top + height;
	return `M${left + r} ${top}H${right - r}A${r} ${r} 0 0 1 ${right} ${top + r}V${bottom - r}A${r} ${r} 0 0 1 ${right - r} ${bottom}`
		+ `H${left + r}A${r} ${r} 0 0 1 ${left} ${bottom - r}V${top + r}A${r} ${r} 0 0 1 ${left + r} ${top}Z`;
}

/** Sets an element's box, in px within the tour layer. */
function place(element, { left, top, width, height }) {
	Object.assign(element.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
}
