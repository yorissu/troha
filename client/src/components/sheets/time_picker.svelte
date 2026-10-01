
<!--
	Time picker: a clock pop-up. A round clock face (hours outside, minutes inside;
	see clock_dial.svelte), the chosen time in big digits, and Cancel / Set.

	Props:
		minuteStep  minutes snap to multiples of this (e.g. 5)
-->

<script>
	import { pad } from '../../core/dates.js';
	import Sheet from '../base/sheet.svelte';
	import ClockDial from '../controls/clock_dial.svelte';

	let { minuteStep } = $props();

	let sheet;
	let request = $state(null);
	let hour = $state(0);
	let minute = $state(0);
	const time = $derived(`${pad(hour)}:${pad(minute)}`);

	/**
	 * Opens the picker.
	 * @param {object} asked
	 * @param {string} asked.value The starting time, "HH:MM".
	 * @param {string} [asked.title]
	 * @param {{from: string, until: string}} [asked.limit] Only times in this range (both ends included).
	 * @param {Element} [asked.origin]
	 * @param {(time: string) => void} asked.onPick
	 * @param {() => void} [asked.onCancel] Default: just close.
	 */
	export function pick(asked) {
		request = asked;
		[hour, minute] = asked.value.split(':').map(Number);
		sheet.open(asked.origin);
	}

	export function close() {
		sheet.close();
	}

	function cancel() {
		if (request?.onCancel) request.onCancel();
		else sheet.close();
	}
</script>

<Sheet class="time-picker" bind:this={sheet} onOutsideTap={cancel}>
	<div class="time-picker-bar">
		<h2>{request?.title ?? 'Set the time'}</h2>
		<span class="time-picker-readout">{time}</span>
	</div>
	<ClockDial bind:hour bind:minute limit={request?.limit ?? null} {minuteStep} />
	<div class="sheet-actions">
		<span class="spacer"></span>
		<button type="button" class="button squish" onclick={cancel}>Cancel</button>
		<button type="button" class="button primary squish" onclick={() => request?.onPick(time)}>Set</button>
	</div>
</Sheet>

<style>
	:global(.time-picker) {
		width: 52rem;
	}

	.time-picker-bar {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}

	.time-picker-readout {
		font-size: 4.5rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
</style>
