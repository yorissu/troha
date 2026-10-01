<!--
	Settings view. Changes apply right away (there is no Save button).

		Tutorial          a walk through Troha (the tour)
		PIN               for hidden habits: set or change it (with the account
		                  password, so a forgotten PIN is changed here too)
		Night and sleep   side by side: the night (the Auto theme turns dark), and
		                  within it the sleep time (Auto brightness dims, and the Auto
		                  screen goes off when idle)

	The time buttons open the clock pop-up (via the controller).

	Props:
		settings          the account's settings (nightTime, sleepTime)
		hasPin            the account has a PIN
		onChangePin       "Set a PIN" or "Change PIN" tapped (gets the button)
		onPickRangeTime   (range: 'nightTime'|'sleepTime', which: 'from'|'until', element)
		onStartTour       "Take the tour" tapped
-->

<script>
	import PickButton from '../controls/pick_button.svelte';

	let { settings, hasPin, onChangePin, onPickRangeTime, onStartTour } = $props();

	const RANGES = [
		{ range: 'nightTime', title: 'Night', note: 'The Auto theme turns dark.' },
		{ range: 'sleepTime', title: 'Sleep', note: 'Within the night. Auto brightness dims, and the Auto screen goes off when idle.' },
	];

	let root;
	/** Its root element (the tour points at it). */
	export function element() {
		return root;
	}
</script>

<section class="view settings-view scroll-area section-list" bind:this={root}>
	<div class="settings-section" style:--i="0">
		<h2>Tutorial</h2>
		<div class="settings-row">
			<button type="button" class="button primary squish" onclick={onStartTour}>Take the tour</button>
		</div>
		<p class="note">A one-minute walk through Troha: setting your PIN, the views, and what every button does.</p>
	</div>
	<div class="settings-section" style:--i="1">
		<h2>PIN</h2>
		<div class="settings-row">
			<button type="button" class="button squish" onclick={(event) => onChangePin(event.currentTarget)}>
				{hasPin ? 'Change PIN' : 'Set a PIN'}
			</button>
		</div>
		<p class="note">Hidden habits stay blank bars until the PIN is typed. Forgot it? Change it here with your password; your hidden habits stay.</p>
	</div>
	<div class="settings-section" style:--i="2">
		<h2>Night and sleep</h2>
		<div class="settings-parts">
			{#each RANGES as { range, title, note } (range)}
				<div class="settings-part">
					<h3>{title}</h3>
					<div class="settings-row">
						<span class="settings-word">From</span>
						<PickButton icon="clock" label={settings[range].from} onTap={(element) => onPickRangeTime(range, 'from', element)} />
						<span class="settings-word until">until</span>
						<PickButton icon="clock" label={settings[range].until} onTap={(element) => onPickRangeTime(range, 'until', element)} />
					</div>
					<p class="note">{note}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	/* Two parts side by side in one section (Night | Sleep). */
	.settings-parts {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3rem;
	}

	.settings-part h3 {
		margin: 0 0 1.25rem;
		font-size: 2rem;
		font-weight: 500;
		color: var(--text-soft);
	}

	.settings-word {
		font-size: 2rem;
		color: var(--text-soft);
	}

	/* "From [22:00] until [07:00]": a little more room before "until" than inside the pairs. */
	.settings-word.until {
		margin-left: .5rem;
	}
</style>
