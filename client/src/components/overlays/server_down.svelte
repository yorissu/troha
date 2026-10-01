
<!--
	Server-down pop-up: covers everything while the server can't be reached, so
	nothing can be changed. It can't be closed: it goes when the server answers again
	and the page reloads (see ServerController). It looks like the other pop-ups
	(styles/sheets.css) but has its own overlay, above all of them.

	Props:
		shown
-->

<script>
	let { shown } = $props();
</script>

{#if shown}
	<div class="overlay server-down" role="alertdialog" aria-modal="true" aria-labelledby="server-down-title">
		<div class="sheet sheet-small">
			<h2 id="server-down-title" style:--i="0">Can't reach Troha's server</h2>
			<p class="note" style:--i="1">Changes can't be saved, so the last one was undone, and nothing can be changed for now.</p>
			<p class="note" style:--i="2">Waiting for the server (or the network) to come back… This goes away by itself then.</p>
		</div>
	</div>
{/if}
