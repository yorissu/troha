
/**
 * The Account view's buttons: renewing the license (a license code, or paying for
 * days, in the currency chosen there), changing the email and the password, downloading everything, signing out,
 * and deleting the account. The account changes ask for the password in a pop-up
 * first (the server checks it).
 */

import { config } from '../config.js';
import { plural } from '../core/text.js';
import { renewedText } from '../models/account.svelte.js';
import { savesDone } from '../models/api.js';
import { formatPrice, priceCents } from '../models/license_prices.js';
import { toast } from '../services/toast.svelte.js';
import { problemText, reasonText } from './problems.js';

const PASSWORD_FIELD = { name: 'password', label: 'Password', kind: 'password', autocomplete: 'current-password' };

export class AccountController {
	/** What days of license cost (the server's prices), once loaded; null until then. */
	prices = $state(null);

	#account;
	#wasLicensed;
	#lock;
	#store;
	#views;

	/**
	 * @param {object} options
	 * @param {import('../models/account.svelte.js').Account} options.account
	 * @param {import('../models/hidden_lock.svelte.js').HiddenLock} options.lock
	 * @param {import('../models/habit_store.svelte.js').HabitStore} options.store
	 * @param {object} options.views form, confirm
	 */
	constructor({ account, lock, store, views }) {
		this.#account = account;
		this.#wasLicensed = account.licensed;
		this.#lock = lock;
		this.#store = store;
		this.#views = views;
	}

	/** Loads the prices (for the License section). */
	async loadPrices() {
		const answer = await this.#account.prices();
		if (answer.ok) this.prices = answer;
	}

	/** "Use a license code". */
	redeemCode(origin) {
		this.#views.form.ask({
			title: 'Use a license code',
			note: 'Its days are added to your license.',
			fields: [{ name: 'code', label: 'License code', kind: 'code', placeholder: 'XXXX-XXXX-XXXX' }],
			submitLabel: 'Use it',
			origin,
			onSubmit: async ({ code }) => {
				const answer = await this.#account.redeemCode(code.trim());
				if (!answer.ok) return { ...problemText(answer), field: answer.reason === 'code' ? 'code' : undefined };
				this.#renewed(answer.days);
				return true;
			},
		});
	}

	/** The currency button: the next currency there are prices in (the server keeps it with the account). */
	async nextCurrency() {
		const currencies = Object.keys(this.prices?.currencies ?? {});
		if (!currencies.length) return;
		const next = currencies[(currencies.indexOf(this.#account.me.currency) + 1) % currencies.length];
		const answer = await this.#account.setCurrency(next);
		if (!answer.ok) toast.show(reasonText(answer.reason), { duration: 'long' });
	}

	/** Paying for `days` days: asks first, then goes to the payment (or, paid at once, says so). */
	buy(days, origin) {
		const { currency } = this.#account.me;
		const price = formatPrice(priceCents(days, this.prices, currency), currency, config.locale);
		this.#views.confirm.ask({
			title: `Pay ${price} for ${days} days?`,
			note: 'They’re added to your license once it’s paid.',
			noLabel: 'Not now',
			yesLabel: `Pay ${price}`,
			yesStyle: 'primary',
			origin,
			onYes: async () => {
				const answer = await this.#account.checkout(days, currency);
				if (!answer.ok) toast.show(reasonText(answer.reason), { duration: 'long' });
				else if (answer.url) location.assign(answer.url); // the provider's payment page; it comes back here
				else if (answer.paid) {
					await this.#account.check();
					this.#renewed();
				}
			},
		});
	}

	/**
	 * The license changed while running: say until when it runs now (a code may also take
	 * days off). One that starts or ends reloads the page, and the account says it then.
	 */
	#renewed(days = 0) {
		const until = this.#account.me?.license?.validUntil;
		if (!until || !this.#wasLicensed) return;
		const text = renewedText(until);
		toast.show(days < 0 ? `That code took ${plural(-days, 'day')} off: ${text.replace('Your', 'your')}` : text, { duration: 'long' });
	}

	changeEmail(origin) {
		this.#views.form.ask({
			title: 'Change your email',
			note: 'We’ll send a link to the new address. Your email changes once you open it.',
			fields: [
				{ name: 'email', label: 'New email', kind: 'email', autocomplete: 'email' },
				PASSWORD_FIELD,
			],
			submitLabel: 'Send the link',
			origin,
			onSubmit: async ({ email, password }) => {
				const answer = await this.#account.changeEmail(password, email.trim());
				if (!answer.ok) return problemText(answer, { passwordField: 'password', emailField: 'email' });
				toast.show(`Check ${email.trim()} for the link`, { duration: 'long' });
				return true;
			},
		});
	}

	changePassword(origin) {
		this.#views.form.ask({
			title: 'Change your password',
			note: 'You’ll stay signed in here, and be signed out everywhere else.',
			fields: [
				{ name: 'current', label: 'Current password', kind: 'password', autocomplete: 'current-password' },
				{ name: 'password', label: 'New password', kind: 'password', autocomplete: 'new-password' },
				{ name: 'repeat', label: 'New password again', kind: 'password', autocomplete: 'new-password' },
			],
			submitLabel: 'Change it',
			origin,
			onSubmit: async ({ current, password, repeat }) => {
				if (password !== repeat) return { field: 'repeat', message: 'The new passwords don’t match', clear: true };
				const answer = await this.#account.changePassword(current, password);
				if (!answer.ok) return problemText(answer, { passwordField: 'current', newPasswordField: 'password' });
				toast.show('Password changed');
				return true;
			},
		});
	}

	/** Everything in the account, as a file (hidden habits too, so it asks for the password). */
	exportData(origin) {
		this.#views.form.ask({
			title: 'Download your data',
			note: 'Your habits (hidden ones too), ticks and settings, as a JSON file.',
			fields: [PASSWORD_FIELD],
			submitLabel: 'Download',
			origin,
			onSubmit: async ({ password }) => {
				await this.#store.save();
				const answer = await this.#account.exportData(password);
				if (!answer.ok) return problemText(answer, { passwordField: 'password' });
				download(answer.file, 'troha_export.json');
				return true;
			},
		});
	}

	signOut(origin) {
		this.#views.confirm.ask({
			title: 'Sign out?',
			note: 'You’ll need your email and password to sign in again.',
			noLabel: 'Stay',
			yesLabel: 'Sign out',
			yesStyle: 'primary',
			origin,
			onYes: async () => {
				if (this.#lock.unlocked) await this.#lock.lock();
				await this.#store.save();
				await savesDone();
				const answer = await this.#account.signOut();
				if (!answer.ok && answer.reason !== 'signed-out') toast.show(reasonText(answer.reason), { duration: 'long' });
			},
		});
	}

	deleteAccount(origin) {
		this.#views.form.ask({
			title: 'Delete your account?',
			note: 'Your habits, ticks, settings and license are deleted for good, and a new account with this email gets no free trial. Type your password to confirm.',
			fields: [PASSWORD_FIELD],
			submitLabel: 'Delete everything',
			submitStyle: 'danger',
			origin,
			onSubmit: async ({ password }) => {
				await savesDone();
				const answer = await this.#account.deleteAccount(password);
				return answer.ok ? true : problemText(answer, { passwordField: 'password' });
			},
		});
	}
}

/** Saves `file` (a Blob) as `name`, through the browser's downloads. */
function download(file, name) {
	const url = URL.createObjectURL(file);
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10000);
}
