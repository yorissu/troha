
<!--
	PIN pad: unlocks hidden habits, or sets a new PIN (entered twice).

	Unlocking needs no OK: the PIN is checked as soon as it has as many digits as the
	PIN does, and the key in the corner is Cancel. Setting a PIN: its length is up to
	you, so Next confirms it; repeating it is checked as soon as it's as long as the
	first.

	Wrong PINs shake the dots; after a few, the pad waits with a countdown (the server
	decides; the pad shows it). A physical keyboard works too.

	Easter egg: 0000 can't be set as a PIN; tried when unlocking, the dots wobble and
	say something cheeky (and it doesn't count as a wrong try).

	Props:
		lock      the HiddenLock (models/hidden_lock.svelte.js)
		limits    { minLength, maxLength }
		remarks   { wrongPin, niceTry }: what the note says after a wrong PIN, and after 0000
		onDone    after unlocking ('unlock') or setting a PIN ('set')
		onForgot  "Forgot PIN?" tapped (gets the button)
-->

<script>
	import { onMount } from 'svelte';
	import { clock } from '../../services/clock.svelte.js';
	import { replayAnimation } from '../../core/dom.js';
	import { listenForKeyPresses } from '../../core/taps.js';
	import { say } from '../../core/text.js';
	import Sheet from '../base/sheet.svelte';
	import Icon from '../controls/icon.svelte';

	const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
	const DOT_ANIMATIONS = ['shake', 'nice-try'];

	let { lock, limits, remarks, onDone, onForgot } = $props();

	let sheet;
	let keypad;
	let dots;
	let mode = $state('unlock'); // or 'set'
	let step = $state(1);        // setting a PIN: 1 = enter it, 2 = repeat it
	let entry = $state('');
	let first = '';
	let checking = $state(false);
	let message = $state(null);  // replaces the usual note (null: the usual one)
	let fresh = $state(true);    // the last dot was just typed (it pops)
	let request = $state({ then: null, onCancel: null, save: null }); // what the pad is for (see ask and askNew)

	const waitSeconds = $derived.by(() => {
		void clock.now; // read, so it's worked out again every second (the wait isn't reactive)
		return lock.waitSecondsLeft;
	});
	const busy = $derived(checking || waitSeconds > 0);
	const expectedLength = $derived(mode === 'unlock' ? lock.pinLength : step === 2 ? first.length : null);
	const dotCount = $derived(Math.max(expectedLength ?? limits.minLength, entry.length));
	const title = $derived(mode === 'unlock' ? 'Enter your PIN' : step === 1 ? request.title ?? 'Set a PIN' : 'Repeat your PIN');
	const note = $derived(waitSeconds ? `Too many tries. Try again in ${waitText(waitSeconds)}`
		: message ?? (mode === 'unlock' ? 'Hidden habits need your PIN'
			: step === 1 ? `${limits.minLength} to ${limits.maxLength} digits, then Next` : 'Enter the same PIN again'));
	const cornerLabel = $derived(mode === 'unlock' ? 'Cancel' : step === 1 ? 'Next' : 'Set');

	onMount(() => {
		// Keys count when pressed, once per touch (see core/taps.js).
		listenForKeyPresses(keypad, '.pin-key', ({ dataset }) => {
			if (dataset.key === 'corner') tapCorner();
			else if (dataset.key === 'back') backspace();
			else type(dataset.key);
		});
		const onKey = (event) => {
			if (!sheet.isOpen()) return;
			if (/^[0-9]$/.test(event.key)) type(event.key);
			else if (event.key === 'Backspace') backspace();
			else if (event.key === 'Enter' && mode === 'set') submit();
			else if (event.key === 'Escape') dismiss();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});

	/**
	 * Unlocks hidden habits, then runs `then` (asks for the PIN, or to set one up, if needed).
	 * @param {{origin?: Element, then?: () => void, onCancel?: () => void}} [options]
	 *   onCancel: the pad was cancelled instead (Cancel, Escape, or a tap beside it).
	 */
	export function ask({ origin, then, onCancel } = {}) {
		if (lock.unlocked) {
			then?.();
			return;
		}
		request = { then, onCancel, save: lock.hasPin ? null : (pin) => lock.setPin(pin) };
		mode = lock.hasPin ? 'unlock' : 'set';
		startOver();
		sheet.open(origin);
	}

	/**
	 * Sets a new PIN with `save` (e.g. changing it with the account password).
	 * @param {{origin?: Element, title?: string, save: (pin: string) => Promise<'ok'|'error'>, then?: () => void, onCancel?: () => void}} options
	 */
	export function askNew({ origin, title, save, then, onCancel }) {
		request = { then, onCancel, save, title };
		mode = 'set';
		startOver();
		sheet.open(origin);
	}

	/** Comes back to the pad as it was (e.g. after cancelling "Forgot PIN?"). */
	export function reopen(origin) {
		sheet.open(origin);
	}

	export function isOpen() {
		return sheet.isOpen();
	}

	/** Its panel (the tour points at it). */
	export function element() {
		return sheet.panel();
	}


	function hidden() {
		startOver();
		request = { then: null, onCancel: null, save: null };
	}

	/** Cancelled: closes, then lets whoever asked go back (onCancel). */
	function dismiss() {
		const { onCancel } = request;
		sheet.close();
		onCancel?.();
	}

	/** "45s", or "3:05" from a minute on (the wait doubles with every wrong PIN). */
	function waitText(seconds) {
		return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
	}

	/** Back to an empty first step (nothing typed, nothing to repeat). */
	function startOver() {
		step = 1;
		entry = '';
		first = '';
		message = null;
	}

	/** Clears what was typed and plays `animation` on the dots ('shake' or 'nice-try'). */
	function reject(animation, text) {
		entry = '';
		message = text;
		replayAnimation(dots, animation, DOT_ANIMATIONS);
	}

	function tapCorner() {
		if (mode === 'set') submit();
		else dismiss();
	}

	/** A digit. Once the PIN is long enough to check, it's checked by itself. */
	function type(digit) {
		if (busy || entry.length >= limits.maxLength) return;
		entry += digit;
		message = null;
		fresh = true;
		if (entry.length === expectedLength) submit();
	}

	function backspace() {
		if (busy) return;
		entry = entry.slice(0, -1);
		fresh = false;
	}

	async function submit() {
		if (busy) return;
		if (entry.length < limits.minLength) {
			message = `Use at least ${limits.minLength} digits`;
			return;
		}
		if (mode === 'set') {
			await submitNewPin();
			return;
		}
		const result = await whileChecking('Checking…', () => lock.unlock(entry));
		if (result === 'ok') finish('unlock');
		else if (result === 'nice-try') reject('nice-try', say(remarks.niceTry));
		else if (result === 'wrong') reject('shake', say(remarks.wrongPin));
		else if (result === 'wait') reject('shake', null);
		else reject('shake', "Couldn't check the PIN. Try again");
	}

	async function submitNewPin() {
		if (step === 1) {
			if (!lock.isAllowedPin(entry)) {
				reject('shake', 'Too easy to guess. Pick another PIN');
				return;
			}
			first = entry;
			entry = '';
			step = 2;
			return;
		}
		if (entry !== first) {
			startOver();
			reject('shake', "PINs didn't match. Start again");
			return;
		}
		const result = await whileChecking('Saving…', () => request.save(entry));
		if (result !== 'ok') {
			startOver();
			message = "Couldn't set the PIN. Try again";
			return;
		}
		finish('set');
	}

	/**
	 * Runs `work` (checking or saving a PIN) while the keypad waits and `text` shows.
	 * @returns {Promise<any>} What `work` returned, or 'error' if it failed.
	 */
	async function whileChecking(text, work) {
		checking = true;
		message = text;
		try {
			return await work();
		} catch (error) {
			console.error(error);
			return 'error';
		} finally {
			checking = false; // before the caller shows the outcome, so the keypad is back
			message = null;
		}
	}

	function finish(how) {
		const { then } = request;
		sheet.close();
		onDone(how);
		then?.();
	}
</script>

<Sheet class="sheet-pin" bind:this={sheet} onOutsideTap={dismiss} onHide={hidden}>
	<h2>{title}</h2>
	<p class="note">{note}</p>
	<div class="pin-dots" bind:this={dots}>
		{#each { length: dotCount }, i (i)}
			<span class="pin-dot" class:filled={i < entry.length} class:new={fresh && i === entry.length - 1}></span>
		{/each}
	</div>
	<div class="keypad" class:disabled={busy} bind:this={keypad}>
		{#each DIGITS as digit (digit)}
			<button type="button" class="pin-key squish" data-key={digit}>{digit}</button>
		{/each}
		<button type="button" class="pin-key squish" data-key="back" aria-label="Delete"><Icon name="backspace" /></button>
		<button type="button" class="pin-key squish" data-key="0">0</button>
		<button type="button" class="pin-key squish" class:ok={mode === 'set'} class:cancel={mode !== 'set'} data-key="corner">{cornerLabel}</button>
	</div>
	<div class="sheet-actions pin-actions">
		{#if mode === 'unlock'}
			<button type="button" class="button link squish" onclick={(event) => onForgot(event.currentTarget)}>Forgot PIN?</button>
		{:else}
			<button type="button" class="button squish" onclick={dismiss}>Cancel</button>
		{/if}
	</div>
</Sheet>

<style>
	:global(.sheet-pin) { width: 44rem; }
	:global(.sheet-pin) h2, :global(.sheet-pin) .note { text-align: center; }

	.pin-dots {
		display: flex;
		justify-content: center;
		gap: 1.25rem;
		height: 2rem;
		margin: 2rem 0 2.25rem;
	}

	.pin-dot {
		width: 1.75rem;
		height: 1.75rem;
		border: .25rem solid var(--text-soft);
		border-radius: 50%;
	}

	.pin-dot.filled { background: var(--text); border-color: var(--text); }
	.pin-dot.new { animation: dot-pop .35s var(--spring); }

	@keyframes dot-pop {
		from { transform: scale(.3); }
	}

	/* Easter egg: 0000 when unlocking. A cheeky head-tilt wobble, not the "wrong" shake. */
	.pin-dots:global(.nice-try) { animation: nice-try .9s var(--spring); }

	@keyframes nice-try {
		20% { transform: translateY(-.6rem) rotate(-8deg) scale(1.1); }
		45% { transform: rotate(6deg) scale(1.05); }
		70% { transform: rotate(-3deg); }
	}

	.keypad {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
	}

	.pin-key {
		display: grid;
		place-items: center;
		height: 6rem;
		border-radius: 1.75rem;
		background: var(--muted-fill);
		color: var(--text);
		font-size: 2.75rem;
		transition: opacity .3s;
	}

	/* While checking, or waiting after too many tries: the keys rest, but Cancel still works. */
	.keypad.disabled .pin-key:not(.cancel) { opacity: .35; pointer-events: none; }

	.pin-key :global(.icon) { width: 2.75rem; height: 2.75rem; }
	.pin-key.ok { background: var(--primary); color: var(--primary-text); font-size: 2rem; font-weight: 500; }
	.pin-key.cancel { font-size: 2rem; font-weight: 500; }

	/* Under the keypad, centred: "Forgot PIN?" (unlocking) or Cancel (setting one). */
	.pin-actions { justify-content: center; }
</style>
