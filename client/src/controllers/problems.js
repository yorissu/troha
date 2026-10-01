
/**
 * What went wrong, in words: the server's reasons (see server/troha_server/app.py)
 * turned into what a form sheet shows (see form_sheet.svelte), or into plain text.
 */

import { config } from '../config.js';

const TEXTS = {
	'wrong-password': 'Wrong password',
	wrong: 'Wrong email or password',
	email: 'That’s not an email address',
	'email-taken': 'That email already has an account',
	'same-email': 'That’s the email you have now',
	password: `Use at least ${config.account.minPasswordLength} characters`,
	code: 'That license code doesn’t work (or was already used)',
	'payments-off': 'Paying isn’t available yet. Use a license code instead',
	days: 'That many days can’t be bought',
	currency: 'There are no prices in that currency',
	link: 'That link has expired or was already used. Ask for a new one',
	'too-many': 'Too many tries. Wait a few minutes and try again',
	lost: 'Can’t reach the server',
};

/** A server reason as text. */
export function reasonText(reason) {
	return TEXTS[reason] ?? 'Something went wrong. Try again';
}

/**
 * A server answer's problem, for a form sheet: which field it's about (if any) and
 * what to say. A wrong password empties the password field.
 * @param {{reason: string}} answer
 * @param {{passwordField?: string, emailField?: string, newPasswordField?: string}} fields
 *   The form's field names for each kind of problem.
 */
export function problemText({ reason }, { passwordField, emailField, newPasswordField } = {}) {
	const message = reasonText(reason);
	if ((reason === 'wrong-password' || reason === 'wrong') && passwordField) return { field: passwordField, message, clear: true };
	if ((reason === 'email' || reason === 'email-taken' || reason === 'same-email') && emailField) return { field: emailField, message };
	if (reason === 'password' && newPasswordField) return { field: newPasswordField, message, clear: true };
	return { message };
}
