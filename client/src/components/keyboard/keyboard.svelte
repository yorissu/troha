
<!--
	On-screen keyboard: slides up from the bottom while a text field is being typed
	into (see keyboard.svelte.js, which has its state and typing). It comes up over
	whatever is there; only the night shade (dimming, and the screen going black) is
	ever above it.

	Nothing makes room for it. But if the field being typed into would end up under
	it, the box around the field (whatever carries data-keyboard-lift: a pop-up, the
	welcome card) slides up just enough to clear it, and back down once it's gone.
	app.svelte shows it once, over every screen.
-->

<script>
	import { onMount } from 'svelte';
	import { listenForKeyPresses } from '../../core/taps.js';
	import Icon from '../controls/icon.svelte';
	import { keyboard, LAYOUTS } from './keyboard.svelte.js';

	const LABELS = { '{numbers}': '123', '{letters}': 'abc', '{symbols}': '#+=', '{space}': 'space', '{done}': 'Done' };
	const LIFT_GAP_PX = 24; // a lifted field ends this far above the keyboard (in the stage's own pixels)

	let element = $state();
	let lifted = null; // the box slid up for the field being typed into, if any
	let liftPx = 0;    // how far (in the stage's own pixels)

	// The field being typed into would be under the keyboard: slide its box up just enough.
	$effect(() => {
		const field = keyboard.field;
		const box = field?.closest('[data-keyboard-lift]') ?? null;
		let lift = 0;
		if (box) {
			const scale = element.getBoundingClientRect().width / element.offsetWidth; // the stage is scaled to fit the screen
			const keyboardTop = element.offsetParent.getBoundingClientRect().bottom - element.offsetHeight * scale; // once it's up
			const fieldBottom = field.getBoundingClientRect().bottom + (box === lifted ? liftPx * scale : 0); // as if not lifted
			lift = Math.max(0, (fieldBottom - keyboardTop) / scale + LIFT_GAP_PX);
		}
		if (lifted && lifted !== box) lifted.style.removeProperty('--keyboard-lift');
		if (box) box.style.setProperty('--keyboard-lift', `${lift}px`);
		lifted = box;
		liftPx = lift;
	});

	// Keys count when pressed, once per touch (see core/taps.js).
	onMount(() => listenForKeyPresses(element, '.key', ({ dataset }) => keyboard.press(dataset.key)));

	const special = (key) => key.startsWith('{');
</script>

<!-- Keep focus (and the caret) in the text field while keys are pressed. -->
	<div class="keyboard" class:open={keyboard.open} bind:this={element} role="group" aria-label="Keyboard"
		onpointerdown={(event) => event.preventDefault()}
		onpointerup={() => keyboard.stopBackspace()}
		onpointerleave={() => keyboard.stopBackspace()}
		onpointercancel={() => keyboard.stopBackspace()}>
		{#each LAYOUTS[keyboard.layout] as row, r (`${keyboard.layout}${r}`)}
			<div class="key-row">
				{#each row as key (key)}
					{#if !special(key)}
						<button type="button" tabindex="-1" class="key" data-key={key}>{keyboard.shift ? key.toLocaleUpperCase() : key}</button>
					{:else}
						<button type="button" tabindex="-1" class="key special key-{key.slice(1, -1)}" class:selected={key === '{shift}' && keyboard.shift}
							data-key={key} aria-label={key.slice(1, -1)}>
							{#if key === '{shift}'}<Icon name={keyboard.capsLock ? 'caps_lock' : 'shift'} />
							{:else if key === '{back}'}<Icon name="backspace" />
							{:else}{LABELS[key]}{/if}
						</button>
					{/if}
				{/each}
			</div>
		{/each}
	</div>

<style>
	.keyboard {
		position: absolute;
		left: 50%;
		bottom: 0;
		width: 96rem;
		display: flex;
		flex-direction: column;
		gap: .75rem;
		padding: 1.5rem 1.75rem 1.75rem;
		border-radius: 2.5rem 2.5rem 0 0;
		background: var(--panel);
		translate: -50% 0;
		/* Hidden below the screen; slides up with a spring when .open */
		transform: translateY(105%);
		visibility: hidden;
		transition: transform .35s cubic-bezier(.5, 0, .75, 0), visibility 0s .35s, background-color .6s;
	}

	/* A box that slides up to keep the field being typed into clear of the keyboard (see above). */
	:global([data-keyboard-lift]) {
		translate: 0 calc(-1 * var(--keyboard-lift, 0px));
		transition: translate .5s var(--spring-soft);
	}

	.keyboard.open {
		transform: none;
		visibility: visible;
		transition: transform .55s var(--spring-soft), visibility 0s, background-color .6s;
	}

	.key-row {
		display: flex;
		justify-content: center;
		gap: .75rem;
	}

	.key {
		flex: 1 1 0;
		max-width: 8.5rem;
		height: 5.5rem;
		display: grid;
		place-items: center;
		border-radius: 1.5rem;
		background: var(--surface);
		color: var(--text);
		font-size: 2.25rem;
		transition: transform .3s var(--spring), background-color .15s;
	}

	.key:active { transform: scale(.88); background: var(--muted-fill); transition-duration: .08s; }
	.key :global(.icon) { width: 2.5rem; height: 2.5rem; }

	.key.special { flex-grow: 1.5; max-width: 13rem; background: var(--muted-fill); font-size: 1.75rem; }
	.key.special:active { background: var(--line); }
	.key.selected { background: var(--selected); color: var(--selected-text); }
	.key.key-space { flex-grow: 6; max-width: none; color: var(--text-soft); }
	.key.key-done { flex-grow: 2; max-width: none; background: var(--primary); color: var(--primary-text); }
</style>
