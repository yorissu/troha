
<!--
	Date picker: a month calendar in a pop-up, for choosing a day (e.g. a habit's
	start or end date). It can also offer "Never" (no day at all).

	Props:
		locale
		dayNames  short weekday names, Monday first
-->

<script>
	import { calendarDays, firstOfMonth, fromKey, shiftMonth, toKey } from '../../core/dates.js';
	import Sheet from '../base/sheet.svelte';
	import MonthBar from '../controls/month_bar.svelte';
	import WeekdayRow from '../controls/weekday_row.svelte';

	let { locale, dayNames } = $props();

	let sheet;
	let request = $state({ value: null, earliest: '0000-00-00', today: toKey(new Date()) });
	let month = $state(firstOfMonth(new Date()));

	// Always 6 weeks, so the pop-up keeps its size from month to month.
	const days = $derived(calendarDays(month, 6).map((date) => ({ key: toKey(date), date })));

	/**
	 * Opens the picker.
	 * @param {object} asked
	 * @param {string|null} asked.value The chosen day key (null: none yet, e.g. "Never").
	 * @param {string} asked.earliest The earliest day that may be chosen.
	 * @param {string} asked.today
	 * @param {Element} [asked.origin]
	 * @param {(day: string) => void} asked.onPick
	 * @param {() => void} [asked.onCancel] Default: just close.
	 * @param {() => void} [asked.onNever] Offers a "Never" button, which calls this.
	 */
	export function pick(asked) {
		request = asked;
		const shown = asked.value ?? (asked.today < asked.earliest ? asked.earliest : asked.today);
		month = firstOfMonth(fromKey(shown));
		sheet.open(asked.origin);
	}

	export function close() {
		sheet.close();
	}

	function choose(day) {
		request.onPick(day < request.earliest ? request.earliest : day);
	}

	function cancel() {
		if (request.onCancel) request.onCancel();
		else sheet.close();
	}
</script>

<Sheet class="sheet-date" bind:this={sheet} onOutsideTap={cancel}>
	<MonthBar {month} {locale} class="picker-bar" canGoBack={month > firstOfMonth(fromKey(request.earliest))}
		onShift={(step) => { month = shiftMonth(month, step); }} />
	<WeekdayRow {dayNames} class="picker-weekdays" />
	<div class="picker-grid">
		{#each days as { key, date } (key)}
			<button type="button" class="picker-day squish" class:outside={date.getMonth() !== month.getMonth()}
				class:today={key === request.today} class:selected={key === request.value} disabled={key < request.earliest}
				onclick={() => choose(key)}>{date.getDate()}</button>
		{/each}
	</div>
	<div class="sheet-actions">
		<button type="button" class="button squish" onclick={() => choose(request.today)}>Today</button>
		{#if request.onNever}<button type="button" class="button squish" onclick={() => request.onNever()}>Never</button>{/if}
		<span class="spacer"></span>
		<button type="button" class="button squish" onclick={cancel}>Cancel</button>
	</div>
</Sheet>

<style>
	:global(.sheet-date) { width: 54rem; }

	/* The month bar: arrows at the ends, the month in the middle. */
	:global(.picker-bar) {
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}

	:global(.picker-bar .month-label) { font-size: 2.25rem; }

	:global(.picker-weekdays) {
		gap: .75rem;
		margin-bottom: .5rem;
		font-size: 1.5rem;
	}

	.picker-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: .75rem;
	}

	.picker-day {
		height: 5.25rem;
		border: .25rem solid transparent;
		border-radius: 1.5rem;
		background: var(--muted-fill);
		font-size: 1.875rem;
	}

	.picker-day.outside { opacity: .45; }
	.picker-day.today { border-color: var(--text-soft); }
	.picker-day.selected { background: var(--selected); color: var(--selected-text); }
	.picker-day:disabled { opacity: .2; pointer-events: none; }
</style>
