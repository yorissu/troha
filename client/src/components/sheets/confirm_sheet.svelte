
<!--
	Confirm sheet: a question with No / Yes buttons, and an optional countdown that
	answers Yes by itself (used for "Lock them?"). Reused for every yes/no question.
-->

<script>
	import { replayAnimation } from '../../core/dom.js';
	import Sheet from '../base/sheet.svelte';

	
	let sheet;
	let fill;
	let shown = $state({}); // the question on screen (kept while it closes, so its words don't vanish)
	let note = $state('');
	let waiting = null;     // the question waiting for an answer
	let timer;
	let ticker;

	/**
	 * Asks a question.
	 * @param {object} asked
	 * @param {string} asked.title
	 * @param {string} [asked.note]
	 * @param {string} [asked.noLabel]
	 * @param {string} [asked.yesLabel]
	 * @param {'danger'|'primary'} [asked.yesStyle]
	 * @param {boolean} [asked.poof] Close with the "deleted" exit on Yes.
	 * @param {number} [asked.countdownMs] Answer Yes by itself after this long.
	 * @param {(secondsLeft: number) => string} [asked.countdownNote] Note text during the countdown.
	 * @param {Element} [asked.origin] The element that asked (it closes toward it).
	 * @param {() => void} [asked.onYes]
	 * @param {() => void} [asked.onNo] Default: just close.
	 */
	export function ask(asked) {
		stopCountdown();
		waiting = asked;
		shown = asked;
		note = asked.note ?? '';
		sheet.open(asked.origin);
		if (asked.countdownMs) startCountdown(asked);
	}

	/** True while it's on screen. */
	export function isOpen() {
		return sheet.isOpen();
	}

	export function close(options) {
		sheet.close(options);
	}

	function answer(yes) {
		const asked = waiting;
		if (!asked) return;
		waiting = null;
		stopCountdown();
		if (yes) {
			sheet.close({ poof: asked.poof });
			asked.onYes?.();
		} else if (asked.onNo) {
			asked.onNo();
		} else {
			sheet.close();
		}
	}

	function startCountdown({ countdownMs, countdownNote }) {
		const endsAt = performance.now() + countdownMs; // the steady timer, like the setTimeout below
		const showSecondsLeft = () => {
			if (countdownNote) note = countdownNote(Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)));
		};
		fill.style.animationDuration = `${countdownMs}ms`;
		replayAnimation(fill, 'draining');
		showSecondsLeft();
		ticker = setInterval(showSecondsLeft, 250);
		timer = setTimeout(() => answer(true), countdownMs);
	}

	function stopCountdown() {
		clearTimeout(timer);
		clearInterval(ticker);
	}

	function hidden() {
		stopCountdown();
		waiting = null;
	}
</script>

<Sheet class="sheet-small confirm-sheet" bind:this={sheet} onOutsideTap={() => answer(false)} onHide={hidden}>
	<h2>{shown.title}</h2>
	<p class="note">{note}</p>
	<div class="countdown" hidden={!shown.countdownMs}><div class="countdown-fill" bind:this={fill}></div></div>
	<div class="sheet-actions">
		<span class="spacer"></span>
		<button type="button" class="button squish" onclick={() => answer(false)}>{shown.noLabel ?? 'No'}</button>
		<button type="button" class="button squish {shown.yesStyle ?? 'danger'}" onclick={() => answer(true)}>{shown.yesLabel ?? 'Yes'}</button>
	</div>
</Sheet>

<style>
	/* Countdown bar: drains over the countdown time (set in code). */
	.countdown {
		height: .75rem;
		margin-top: 1.75rem;
		overflow: hidden;
		border-radius: 1rem;
		background: var(--muted-fill);
	}

	.countdown-fill {
		height: 100%;
		border-radius: inherit;
		background: var(--progress);
		transform-origin: left center;
	}

	.countdown-fill:global(.draining) {
		animation: drain 10s linear both;
	}

	@keyframes drain {
		to { transform: scaleX(0); }
	}
</style>
