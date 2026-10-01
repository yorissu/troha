
<!--
	Sheet layer: the dimmed overlay the pop-up sheets live in (one shows at a time;
	see sheet_host.js). Tapping the dimmed area tells the sheet on screen.
-->

<script>
	import { sheets } from './sheet_host.js';

	let { children } = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (Escape is handled by each sheet) -->
<div class="overlay" hidden bind:this={sheets.element} onclick={(event) => { if (event.target === event.currentTarget) sheets.tapOutside(); }}>
	{@render children()}
</div>
