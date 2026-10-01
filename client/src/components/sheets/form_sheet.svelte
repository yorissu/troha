
<!--
	Form sheet: a pop-up with a few text fields and a button, for the account's
	changes (a new password, a new email, "type your password to continue"…).

	The owner checks what was typed (usually with the server) and answers; a field
	that's wrong is marked in place (red, with a shake, and a hint where it's empty).
-->

<script>
	import { tick } from 'svelte';
	import Sheet from '../base/sheet.svelte';
	import FormFields from '../controls/form_fields.svelte';

	let sheet;
	let form = $state({ title: '', fields: [] });
	let values = $state({});
	let note = $state('');
	let problem = $state(false); // the note says what went wrong
	let busy = $state(false);
	let formFields;

	/**
	 * Opens the form.
	 * @param {object} asked
	 * @param {string} asked.title
	 * @param {string} [asked.note]
	 * @param {Array<{name: string, label: string, kind?: string, autocomplete?: string, placeholder?: string}>} asked.fields
	 *   kind: 'text', 'email', 'password' or 'code' (see text_field.svelte)
	 * @param {string} asked.submitLabel
	 * @param {'primary'|'danger'} [asked.submitStyle]
	 * @param {Element} [asked.origin]
	 * @param {(values: Object<string, string>) => Promise<true|{field?: string, message: string, clear?: boolean}>} asked.onSubmit
	 *   true: done (the form closes). Otherwise what's wrong: with `field`, that field is
	 *   marked (and emptied, with `clear`); without, the note says it.
	 * @param {() => void} [asked.onCancel] Default: just close.
	 */
	export function ask(asked) {
		form = asked;
		values = Object.fromEntries(asked.fields.map((field) => [field.name, '']));
		note = asked.note ?? '';
		problem = false;
		busy = false;
		// Once its fields are drawn (so they rise in one by one too).
		tick().then(() => {
			formFields.clearMarks();
			sheet.open(asked.origin);
		});
	}

	export function close() {
		sheet.close();
	}

	async function submit() {
		if (busy) return;
		if (formFields.markMissing()) return;
		busy = true;
		let result;
		try {
			result = await form.onSubmit({ ...values });
		} catch (error) {
			console.error(error);
			result = { message: 'Something went wrong. Try again' };
		} finally {
			busy = false;
		}
		if (result === true) {
			sheet.close();
			return;
		}
		if (!formFields.markProblem(result)) showProblem(result.message); // unless the emptied field says it
	}

	function showProblem(message) {
		note = message;
		problem = true;
	}

	function cancel() {
		if (busy) return;
		if (form.onCancel) form.onCancel();
		else sheet.close();
	}
</script>

<Sheet class="sheet-small form-sheet" bind:this={sheet} onsubmit={submit} onOutsideTap={cancel}>
	<h2>{form.title}</h2>
	<p class="note" class:problem>{note}</p>
	<FormFields bind:this={formFields} fields={form.fields} bind:values idPrefix="form" />
	<div class="sheet-actions">
		<span class="spacer"></span>
		<button type="button" class="button squish" onclick={cancel}>Cancel</button>
		<button type="submit" class="button squish {form.submitStyle ?? 'primary'}" disabled={busy}>
			{busy ? 'One moment…' : form.submitLabel}
		</button>
	</div>
</Sheet>

<style>
	.note.problem { color: var(--error); }
	.note:empty { display: none; }
</style>
