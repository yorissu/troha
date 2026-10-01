
<!--
	Habit editor: adds a new habit, or edits one (changes apply as you make them).

	Fields: name, priority, days, repeat, visibility (hidden or not), start and end dates, and
	colour. It only collects choices; the controller decides what happens with them
	(via the callbacks).

	Props:
		locale
		dayNames       short weekday names, Monday first
		colors         habit colour names
		repeatChoices  "every N weeks" choices
		nameMaxLength
		datePicker     the date picker (for the start and end dates)
		today          () => today's day key
		canChooseHidden  () => true if Hidden may be chosen right now (unlocked)
		onAdd          (fields) a new habit
		onChange       (habit, fields) a change to the habit being edited
		onDelete       (habit, element) Delete tapped
		onNeedUnlock   (element) Hidden was tapped while locked
-->

<script>
	import { clearInvalid, markInvalid } from '../../core/dom.js';
	import { formatDate, fromKey, isoWeekday } from '../../core/dates.js';
	import { DEFAULT_PRIORITY, PRIORITIES, PRIORITY_LABELS } from '../../models/priorities.js';
	import Sheet from '../base/sheet.svelte';
	import CycleButton from '../controls/cycle_button.svelte';
	import PickButton from '../controls/pick_button.svelte';
	import PillRow from '../controls/pill_row.svelte';
	import TextField from '../controls/text_field.svelte';

	const NAME_PLACEHOLDER = 'Water the plants';
	const NAME_MISSING = 'Give the habit a name';
	const NEVER = 'Never'; // no end date
	const PRIORITY_ICONS = Object.fromEntries(PRIORITIES.map((priority) => [priority, `priority_${priority}`]));

	let {
		locale, dayNames, colors, repeatChoices, nameMaxLength, datePicker, today, canChooseHidden,
		onAdd, onChange, onDelete, onNeedUnlock,
	} = $props();

	let sheet;
	let nameField;
	let dayRow = $state();
	let visibilityRow = $state();
	let startButton = $state();
	let endButton = $state();
	let habit = $state(null); // the habit being edited, or null when adding
	let name = $state('');
	let nameBefore = '';      // the name before the field was last tapped into (put back if closed with it erased)
	/** The choices so far. */
	let draft = $state({ days: [], everyWeeks: 1, startDate: '', earliestStart: '', endDate: null, hidden: false, priority: DEFAULT_PRIORITY, color: '' });

	/**
	 * Opens the editor.
	 * @param {object|null} edited The habit to edit, or null to add a new one.
	 * @param {{name?: string, colorIndex?: number, origin?: Element}} [options]
	 *   name: the habit's name to show (editing); colorIndex: the suggested colour for a new one.
	 */
	export function edit(edited, { name: shownName = '', colorIndex = 0, origin } = {}) {
		const day = today();
		habit = edited;
		draft = edited
			? {
				days: [...edited.days],
				everyWeeks: edited.everyWeeks,
				startDate: edited.startDate,
				earliestStart: edited.startDate < day ? edited.startDate : day,
				endDate: edited.endDate,
				hidden: edited.hidden,
				priority: edited.priority,
				color: colors.includes(edited.color) ? edited.color : colors[0],
			}
			: {
				days: [isoWeekday(fromKey(day))],
				everyWeeks: 1,
				startDate: day,
				earliestStart: day,
				endDate: null,
				hidden: false,
				priority: DEFAULT_PRIORITY,
				color: colors[colorIndex % colors.length],
			};
		name = edited ? shownName : '';
		nameBefore = name;
		clearMarks();
		sheet.open(origin); // no focus: the keyboard appears only when the name field is tapped
	}

	/** Comes back to the editor as it was (after the date picker, a question or the PIN pad). */
	export function reopen(origin) {
		sheet.open(origin);
	}

	/** Selects Hidden (after unlocking) and comes back to the editor. */
	export function chooseHidden(origin) {
		draft.hidden = true;
		reopen(origin);
		applyEdit();
	}

	export function close() {
		sheet.close();
	}

	function hidden() {
		// Edits apply as you type, so erasing a name letter by letter saved each shorter
		// version; closing with the name erased puts back the name from before the erasing.
		if (habit && !name.trim()) {
			name = nameBefore;
			clearMarks();
			applyEdit();
		}
	}

	/** A choice was made: apply it (when editing). */
	function changed() {
		clearMarks();
		applyEdit();
	}

	function toggleDay(day) {
		draft.days = draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day];
		changed();
	}

	function nextPriority() {
		draft.priority = PRIORITIES[(PRIORITIES.indexOf(draft.priority) + 1) % PRIORITIES.length];
		changed();
	}

	function tapHidden() {
		if (canChooseHidden()) {
			draft.hidden = true;
			changed();
		} else {
			onNeedUnlock(visibilityRow);
		}
	}

	function pickStart() {
		datePicker.pick({
			value: draft.startDate,
			earliest: draft.earliestStart,
			today: today(),
			origin: startButton,
			onPick: (day) => {
				draft.startDate = day;
				if (draft.endDate && draft.endDate < day) draft.endDate = day; // never ends before it starts
				picked(startButton);
			},
			onCancel: () => reopen(startButton),
		});
	}

	/** The end date: a day (from the start on), or "Never". */
	function pickEnd() {
		datePicker.pick({
			value: draft.endDate,
			earliest: draft.startDate,
			today: today(),
			origin: endButton,
			onPick: (day) => {
				draft.endDate = day;
				picked(endButton);
			},
			onNever: () => {
				draft.endDate = null;
				picked(endButton);
			},
			onCancel: () => reopen(endButton),
		});
	}

	/** A date was picked: back to the editor, and apply it. */
	function picked(origin) {
		reopen(origin);
		applyEdit();
	}

	/** The choices as habit fields, or null (with the missing part marked) if something is missing. */
	function fields() {
		const trimmed = name.trim();
		if (!trimmed) {
			nameField.markInvalid(NAME_MISSING);
			return null;
		}
		if (draft.days.length === 0) return markInvalid(dayRow);
		return {
			name: trimmed,
			days: [...draft.days].sort((a, b) => a - b),
			everyWeeks: draft.everyWeeks,
			startDate: draft.startDate,
			endDate: draft.endDate,
			hidden: draft.hidden,
			priority: draft.priority,
			color: draft.color,
		};
	}

	/** Clears the red marks of a missing name or days. */
	function clearMarks() {
		nameField?.clearMarks();
		if (dayRow) clearInvalid(dayRow);
	}

	/** Editing: every valid change applies right away. */
	function applyEdit() {
		if (!habit) return;
		const result = fields();
		if (result) onChange(habit, result);
	}

	function submit() {
		if (habit) {
			sheet.close(); // Enter while editing just closes
			return;
		}
		const result = fields();
		if (result) onAdd(result);
	}
</script>

<Sheet class="editor-sheet" bind:this={sheet} onsubmit={submit} onHide={hidden}>
	<h2>{habit ? 'Edit habit' : 'New habit'}</h2>
	<div class="field-row">
		<div class="field-grow">
			<label class="field-label" for="habit-name">Name</label>
			<TextField bind:this={nameField} bind:value={name} id="habit-name" maxLength={nameMaxLength}
				placeholder={NAME_PLACEHOLDER} oninput={changed}
				onfocus={() => { if (name.trim()) nameBefore = name; }} />
		</div>
		<div class="priority">
			<div class="field-label">Priority</div>
			<!-- Each tap steps to the next priority (Low, Medium, High, then Low again). -->
			<CycleButton name="Priority" icons={PRIORITY_ICONS} choice={draft.priority} label={PRIORITY_LABELS[draft.priority]} onTap={nextPriority} />
		</div>
	</div>
	<div class="field-label">Days</div>
	<PillRow bind:element={dayRow} pills={[
		...dayNames.map((dayName, i) => ({ label: dayName, selected: draft.days.includes(i + 1), onTap: () => toggleDay(i + 1) })),
		{ label: 'Every day', selected: draft.days.length === 7, onTap: () => { draft.days = [1, 2, 3, 4, 5, 6, 7]; changed(); } },
	]} />
	<div class="field-label">Repeat</div>
	<PillRow pills={repeatChoices.map((weeks) => ({
		label: weeks === 1 ? 'Every week' : `Every ${weeks} weeks`,
		selected: draft.everyWeeks === weeks,
		onTap: () => { draft.everyWeeks = weeks; changed(); },
	}))} />
	<div class="field-row">
		<div>
			<div class="field-label">Visibility</div>
			<PillRow bind:element={visibilityRow} pills={[
				{ label: 'Visible', selected: !draft.hidden, onTap: () => { draft.hidden = false; changed(); } },
				{ label: 'Hidden', selected: draft.hidden, onTap: tapHidden },
			]} />
		</div>
		<div>
			<div class="field-label">Starts</div>
			<PickButton icon="calendar" label={draft.startDate ? formatDate(fromKey(draft.startDate), locale, 'date') : ''}
				bind:element={startButton} onTap={pickStart} />
		</div>
		<div>
			<div class="field-label">Ends</div>
			<PickButton icon="calendar" label={draft.endDate ? formatDate(fromKey(draft.endDate), locale, 'date') : NEVER}
				bind:element={endButton} onTap={pickEnd} />
		</div>
	</div>
	<div class="field-label">Colour</div>
	<div class="swatch-row">
		{#each colors as color (color)}
			<button type="button" class="swatch c-{color} squish" class:selected={draft.color === color} aria-label={color}
				onclick={() => { draft.color = color; changed(); }}></button>
		{/each}
	</div>
	<div class="sheet-actions">
		{#if habit}
			<button type="button" class="button danger squish" onclick={(event) => onDelete(habit, event.currentTarget)}>Delete</button>
		{/if}
		<span class="spacer"></span>
		<button type="button" class="button squish" class:primary={habit} onclick={() => sheet.close()}>{habit ? 'Done' : 'Cancel'}</button>
		{#if !habit}<button type="submit" class="button primary squish">Add</button>{/if}
	</div>
</Sheet>

<style>
	/* The priority: a round cycle button, as tall as the name field, in the filled colours. */
	.priority {
		--cycle-size: 5rem;
		--cycle-fill: var(--selected);
		--cycle-text: var(--selected-text);
	}
</style>
