
"""What days of license cost, in each currency the page offers (Account -> License).
Each currency has its own price list, charged as it is: the page shows exactly what's
paid, with no exchange rates. Priced like tax brackets: each day costs the rate of the
bracket it falls in, so a longer license always costs more in all, but less per day.
The page gets these numbers from the server (GET /api/license/prices), so they live
only here.
"""

MIN_DAYS = 30        # a payment's fees would eat a smaller one
MAX_DAYS = 36500     # 100 years

# Currency -> its brackets: (the last day of the bracket, cents per day); None: every day after that.
# The first is the default (a new account's, and any account's whose currency isn't one of these).
PRICES = {
	"EUR": ((365, 50), (3650, 10), (None, 1)),
	"USD": ((365, 55), (3650, 11), (None, 1)),
	"GBP": ((365, 45), (3650, 9), (None, 1)),
}
DEFAULT_CURRENCY = next(iter(PRICES))


def is_currency(value):
	"""True for a currency there are prices in."""
	return isinstance(value, str) and value in PRICES


def price_cents(days, currency):
	"""What `days` days cost in `currency`, in its cents. Raises ValueError for days
	outside MIN_DAYS..MAX_DAYS or a currency that isn't offered."""
	if not is_currency(currency):
		raise ValueError(f"no prices in {currency!r}")
	if not isinstance(days, int) or isinstance(days, bool) or not MIN_DAYS <= days <= MAX_DAYS:
		raise ValueError(f"days must be {MIN_DAYS} to {MAX_DAYS}")
	total = 0
	counted = 0
	for last_day, cents in PRICES[currency]:
		upto = days if last_day is None else min(days, last_day)
		if upto > counted:
			total += (upto - counted) * cents
			counted = upto
	return total


def describe():
	"""The prices, as the page gets them (it works prices out the same way)."""
	return {
		"minDays": MIN_DAYS,
		"maxDays": MAX_DAYS,
		"currencies": {
			currency: [{"upTo": last_day, "centsPerDay": cents} for last_day, cents in brackets]
			for currency, brackets in PRICES.items()
		},
	}
