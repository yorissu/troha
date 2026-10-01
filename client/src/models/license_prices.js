
/**
 * What days of license cost, worked out from the prices the server sends (GET
 * /api/license/prices; the server's pricing.py has the numbers and charges the same):
 * a price list per currency (the account's currency is chosen in Account -> License). Like tax
 * brackets: each day costs the rate of the bracket it falls in.
 */

/** The lengths offered in Account -> License, in days. */
export const DURATIONS = [
	{ days: 30, label: '30 days' },
	{ days: 90, label: '3 months' },
	{ days: 180, label: '6 months' },
	{ days: 365, label: '1 year' },
	{ days: 1095, label: '3 years' },
	{ days: 3650, label: '10 years' },
	{ days: 36500, label: '100 years' },
];

/** How a currency is called (Account -> License), e.g. "Euro (€)", as the browser names it. */
export function currencyLabel(code, locale) {
	const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
	const symbol = new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
		.formatToParts(0).find((part) => part.type === 'currency')?.value;
	return symbol && symbol !== code ? `${name} (${symbol})` : name;
}

/**
 * What `days` days cost in `currency`, in its cents.
 * @param {number} days
 * @param {{currencies: Object<string, {upTo: number|null, centsPerDay: number}[]>}} prices
 * @param {string} currency
 */
export function priceCents(days, prices, currency) {
	let total = 0;
	let counted = 0;
	for (const { upTo, centsPerDay } of prices.currencies[currency] ?? []) {
		const until = upTo === null ? days : Math.min(days, upTo);
		if (until > counted) {
			total += (until - counted) * centsPerDay;
			counted = until;
		}
	}
	return total;
}

/** e.g. "€182.50". */
export function formatPrice(cents, currency, locale) {
	return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}
