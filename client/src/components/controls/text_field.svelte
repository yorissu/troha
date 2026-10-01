
<!--
	Text field, typed into with the on-screen keyboard (components/keyboard; the
	device's own keyboard stays hidden, a physical one works too). Something missing or wrong is marked in the field itself: it turns
	red and shakes, and its placeholder can say what's needed, so nothing else on
	the page moves. (Styles: .text-input in styles/controls.css.)

	Props:
		value        the text (bindable)
		kind         'text' (the default), 'email', 'password' or 'code' (no capital
		             letter to start with, no spell checking)
		placeholder
		maxLength
		autocomplete what browsers and password managers may fill in, e.g. 'email' or 'current-password'
		id           for a <label> to point at
		ariaLabel    spoken name, when there's no <label>
		oninput      the text changed
		onfocus
-->

<script>
	import { onMount } from 'svelte';
	import { clearInvalid, markInvalid as markElement } from '../../core/dom.js';
	import { keyboard } from '../keyboard/keyboard.svelte.js';

	let {
		value = $bindable(''), kind = 'text', placeholder = '', maxLength, autocomplete = 'off',
		id, ariaLabel, oninput, onfocus,
	} = $props();

	let element;
	let hint = $state(null); // replaces the placeholder while marked (markInvalid)
	const plain = $derived(kind !== 'text');

	onMount(() => keyboard.attach(element));

	/** Marks the field red, with a shake; `text` (if any) replaces the placeholder until clearMarks(). */
	export function markInvalid(text) {
		hint = text ?? null;
		markElement(element);
	}

	/** Undoes markInvalid(). */
	export function clearMarks() {
		clearInvalid(element);
		hint = null;
	}

	export function focus() {
		element.focus();
	}
</script>

<input class="text-input" bind:this={element} bind:value
	type={kind === 'password' ? 'password' : kind === 'email' ? 'email' : 'text'}
	inputmode="none"
	data-keyboard={plain ? 'plain' : 'text'}
	autocapitalize={plain ? 'off' : 'sentences'} spellcheck={!plain}
	maxlength={maxLength} placeholder={hint ?? placeholder} {autocomplete} {id} aria-label={ariaLabel}
	oninput={() => oninput?.()} onfocus={() => onfocus?.()} />
