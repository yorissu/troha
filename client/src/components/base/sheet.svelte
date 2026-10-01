
<!--
	Sheet: a pop-up panel, the base of every pop-up (confirm question, PIN pad,
	pickers, the habit editor…). It lives in the sheet layer, hidden until open()
	shows it (see sheet_host.js for the swing in and out).

	With `onsubmit` it's a form: Enter (or a submit button) calls it.

	Props:
		class         extra classes (e.g. 'sheet-small')
		onsubmit      makes it a form
		onOutsideTap  a tap on the dimmed area around it (default: close)
		onHide        after it closed: clean up here
-->

<script>
	import { onDestroy, onMount } from 'svelte';
	import { sheets as host } from './sheet_host.js';

	let { class: className = '', onsubmit, onOutsideTap, onHide, children } = $props();

	let element = $state();
	const sheet = {
		get element() { return element; },
		onOutsideTap: () => (onOutsideTap ? onOutsideTap() : close()),
		onHide: () => onHide?.(),
	};

	onMount(() => host.add(sheet));
	onDestroy(() => host.remove(sheet));

	/** Shows it. @param {Element} [origin] The element that opened it (it closes toward it). */
	export function open(origin) {
		host.show(sheet, origin);
	}

	/** Closes it (if it's the one on screen). @param {{poof?: boolean}} [options] */
	export function close(options) {
		if (host.current === sheet) host.close(options);
	}

	/** True while it's on screen. */
	export function isOpen() {
		return host.current === sheet && host.isOpen;
	}

	/** Its panel (e.g. for the tour to point at). */
	export function panel() {
		return element;
	}
</script>

{#if onsubmit}
	<form class="sheet {className}" data-keyboard-lift hidden autocomplete="off" novalidate bind:this={element}
		onsubmit={(event) => { event.preventDefault(); onsubmit(); }}>
		{@render children()}
	</form>
{:else}
	<div class="sheet {className}" data-keyboard-lift hidden bind:this={element}>
		{@render children()}
	</div>
{/if}
