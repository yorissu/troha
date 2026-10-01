
/**
 * The license warning, a notice (in the Notices view): "License ends in 3 days" during the
 * license's last days (as many as the server says: license.warnDays, when its warning
 * email goes out too), then "License ended" once it has. It stays until the license
 * is renewed.
 */

import { onDestroy } from 'svelte';
import { daysBetween, formatDate } from '../core/dates.js';
import { clock } from '../services/clock.svelte.js';
import { notices } from '../services/notices.svelte.js';

const NOTICE = 'license';

export class LicenseNoticeController {
	#account;
	#locale;

	/**
	 * Made while the board is set up; stops with it.
	 * @param {object} options
	 * @param {import('../models/account.svelte.js').Account} options.account
	 * @param {string} options.locale
	 */
	constructor({ account, locale }) {
		this.#account = account;
		this.#locale = locale;
		this.check();
		onDestroy(clock.onTick(() => this.check()));
	}

	/** Shows the warning (or keeps it up to date) while it applies, and drops it once it doesn't. */
	check() {
		const license = this.#account.me?.license;
		if (!license) return;
		const date = (seconds) => formatDate(new Date(seconds * 1000), this.#locale, 'short');
		if (!license.validUntil) {
			if (license.endedAt) notices.show(NOTICE, 'License ended', { detail: `${date(license.endedAt)}. Renew it in Account.`, tone: 'error' });
			else notices.show(NOTICE, 'No license yet', { detail: 'Get one in Account.', tone: 'error' });
			return;
		}
		const left = daysBetween(clock.now, new Date(license.validUntil * 1000)); // calendar days: 0 is today
		if (left > license.warnDays) {
			notices.drop(NOTICE); // e.g. just renewed
			return;
		}
		const when = left === 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${left} days`;
		notices.show(NOTICE, `License ends ${when}`, { detail: date(license.validUntil) });
	}
}

