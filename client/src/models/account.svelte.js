
/**
 * The account: who's signed in, and everything about signing in and the account
 * itself (the server does the real work; see server/troha_server/app.py).
 *
 * `state` decides what the page shows (see app.svelte):
 *   'loading'     finding out whether anyone is signed in
 *   'signed-out'  the welcome card: sign in, create an account, or reset a password
 *   'ready'       the habit board: all of it while the license runs (`licensed`),
 *                 else only the account, to renew it
 *
 * Every action answers { ok, reason? } (see api.js); reasons are e.g. 'wrong',
 * 'email-taken', 'code', 'password', 'too-many' or 'lost'.
 */

import { config } from '../config.js';
import { formatDate } from '../core/dates.js';
import { plural } from '../core/text.js';
import { call, ServerLost } from './api.js';

const GREETING_KEY = 'troha.greeting';

/** What's said once the license has been renewed. */
export function renewedText(validUntil) {
	return `Your license now runs until ${formatDate(new Date(validUntil * 1000), config.locale, 'date')}`;
}

/** A greeting left for this load (by the one before it), once. */
function takeGreeting() {
	try {
		const text = sessionStorage.getItem(GREETING_KEY);
		sessionStorage.removeItem(GREETING_KEY);
		return text;
	} catch {
		return null;
	}
}

export class Account {
	/** @type {'loading'|'signed-out'|'ready'} */
	state = $state('loading');
	/** currency: what prices are shown and paid in (Account -> License).
	 *  @type {{email: string, currency: string, hasPin: boolean, pinLength: number|null, pinWait: number, unlocked: boolean,
	 *          license: {validUntil: number|null, endedAt: number|null}}|null} */
	me = $state(null);
	#greeting = $state(takeGreeting());

	/**
	 * Something to say once the next screen is up (e.g. "Welcome!" after signing up), or
	 * null. Kept over a reload (the page reloads when the license starts or ends).
	 */
	get greeting() {
		return this.#greeting;
	}

	set greeting(text) {
		this.#greeting = text;
		try {
			if (text) sessionStorage.setItem(GREETING_KEY, text);
			else sessionStorage.removeItem(GREETING_KEY);
		} catch {
			// no storage here: it's said only if there's no reload in between
		}
	}

	/** Finds out who's signed in (if anyone). */
	async check() {
		const answer = await this.#ask('GET', '/api/account', undefined, { quiet: true });
		if (answer.ok) this.#signedIn(answer);
		else if (answer.reason !== 'lost') this.#signedOut();
		return answer;
	}

	async signIn(email, password) {
		return this.#entered(await this.#ask('POST', '/api/account/sign-in', { email, password }));
	}

	/** True while the license runs (else only the account can be used, to renew it). */
	get licensed() {
		return Boolean(this.me?.license?.validUntil);
	}

	/** A new account (with a free trial license). */
	async register(email, password) {
		return this.#entered(await this.#ask('POST', '/api/account/register', { email, password }));
	}

	/** Emails a link for setting a new password (always answers ok, so it can't tell who has an account). */
	forgot(email) {
		return this.#ask('POST', '/api/account/forgot', { email });
	}

	/** The new password from a reset link (signs in). */
	async reset(token, password) {
		return this.#entered(await this.#ask('POST', '/api/account/reset', { token, password }));
	}

	async signOut() {
		const answer = await this.#ask('POST', '/api/account/sign-out');
		this.#signedOut();
		return answer;
	}

	changePassword(current, password) {
		return this.#ask('POST', '/api/account/password', { current, password });
	}

	/** Checks the password (before asking for more, e.g. a new PIN). */
	checkPassword(password) {
		return this.#ask('POST', '/api/account/check-password', { password });
	}

	/** Emails a link to the new address; the address changes once it's opened. */
	changeEmail(password, email) {
		return this.#ask('POST', '/api/account/email', { password, email });
	}

	/** The link from that email. */
	async confirmEmail(token) {
		const answer = await this.#ask('POST', '/api/account/email/confirm', { token });
		if (answer.ok && this.me) this.me.email = answer.email;
		return answer;
	}

	/** Everything in the account, as a file to download. @returns {Promise<{ok: boolean, file?: Blob}>} */
	async exportData(password) {
		const answer = await this.#ask('POST', '/api/account/export', { password });
		if (!answer.ok) return answer;
		const { ok, status, ...data } = answer;
		return { ok, file: new Blob([JSON.stringify(data, null, '\t')], { type: 'application/json' }) };
	}

	/** What days of license cost: { payments, minDays, maxDays, currencies: {code: brackets} } (see the server's pricing.py). */
	prices() {
		return this.#ask('GET', '/api/license/prices');
	}

	/** A license code's days (answers them as `days`: negative ones took days off). */
	async redeemCode(code) {
		const answer = await this.#ask('POST', '/api/license/redeem', { code });
		if (!answer.ok) return answer;
		// A code that ends the license: said once the page has reloaded into the account (first: it reloads then).
		if (this.licensed && !answer.license?.validUntil) this.greeting = `That code took ${plural(-answer.days, 'day')} off: your license has ended`;
		this.#signedIn(answer);
		return answer;
	}

	/** The currency prices are shown and paid in. */
	async setCurrency(currency) {
		const answer = await this.#ask('POST', '/api/account/currency', { currency });
		if (answer.ok && this.me) this.me.currency = answer.currency;
		return answer;
	}

	/** Pays for `days` days in `currency`: answers { url } (go there to pay) or { paid: true }. */
	checkout(days, currency) {
		return this.#ask('POST', '/api/license/checkout', { days, currency });
	}

	async deleteAccount(password) {
		const answer = await this.#ask('POST', '/api/account/delete', { password });
		if (answer.ok) this.#signedOut();
		return answer;
	}

	/** The session ended (the server said so): back to the welcome card. */
	sessionEnded() {
		if (this.state !== 'signed-out') this.#signedOut();
	}

	/** The license ended (the server said so). */
	licenseEnded() {
		if (this.me && this.licensed) this.me.license = { validUntil: null, endedAt: Math.floor(Date.now() / 1000) };
	}

	#entered(answer) {
		if (answer.ok) this.#signedIn(answer);
		return answer;
	}

	#signedIn(me) {
		const { ok, status, ...details } = me;
		const renewed = this.me !== null && !this.licensed && Boolean(details.license?.validUntil);
		if (renewed) this.greeting = renewedText(details.license.validUntil); // first: the page reloads once it's licensed
		this.me = details;
		this.state = 'ready';
	}

	#signedOut() {
		this.me = null;
		this.state = 'signed-out';
	}

	/** call(), with a lost server answered as { ok: false, reason: 'lost' } (the server-down pop-up says the rest). */
	async #ask(method, url, body, options) {
		try {
			return await call(method, url, body, options);
		} catch (error) {
			if (error instanceof ServerLost) return { ok: false, reason: 'lost' };
			throw error;
		}
	}
}
