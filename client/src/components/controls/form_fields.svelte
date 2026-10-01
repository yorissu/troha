<!--
	Form fields: a column of labelled text fields, made from a list of what they are
	(the welcome card and the form pop-up use it). Something missing or wrong is
	marked in the field itself (red, with a shake; see text_field.svelte).

	Props:
		fields    [{ name, label, kind?, autocomplete?, placeholder? }] (kind: see text_field.svelte)
		values    name -> text (bindable)
		idPrefix  for the fields' ids, so their labels point at them
-->

<script>
	import { config } from '../../config.js';
	import TextField from './text_field.svelte';

	/** The longest each kind of field takes (the server allows the same). */
	const MAX_LENGTH = { email: config.account.emailMaxLength, password: config.account.passwordMaxLength };
	const DEFAULT_MAX_LENGTH = 200;

	let { fields, values = $bindable(), idPrefix } = $props();

	const inputs = $state({}); // field name -> its TextField

	/** Marks every empty field ("Email needed"). @returns {boolean} true if any was empty. */
	export function markMissing() {
		const missing = fields.filter((field) => !values[field.name]?.trim());
		for (const field of missing) inputs[field.name]?.markInvalid(`${field.label} needed`);
		return missing.length > 0;
	}

	/**
	 * Marks the field a problem is about ({ field, message, clear }, see controllers/problems.js),
	 * emptying it first with `clear`.
	 * @returns {boolean} true if the field now says the message itself (emptied, it's its placeholder).
	 */
	export function markProblem({ field, message, clear }) {
		const input = field && inputs[field];
		if (!input) return false;
		if (clear) values[field] = '';
		input.markInvalid(message);
		return Boolean(clear);
	}

	/** Clears every field's marks. */
	export function clearMarks() {
		for (const input of Object.values(inputs)) input?.clearMarks();
	}
</script>

{#each fields as field (field.name)}
	<label class="field-label" for="{idPrefix}-{field.name}">{field.label}</label>
	<TextField bind:value={values[field.name]} bind:this={inputs[field.name]} id="{idPrefix}-{field.name}"
		kind={field.kind ?? 'text'} autocomplete={field.autocomplete ?? 'off'} placeholder={field.placeholder ?? ''}
		maxLength={MAX_LENGTH[field.kind] ?? DEFAULT_MAX_LENGTH} oninput={() => inputs[field.name]?.clearMarks()} />
{/each}
