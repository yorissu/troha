
"""Paying for days of license, through a payment provider (Troha never sees card
details). The page asks to buy some days (POST /api/license/checkout); start() works
out the price, opens the payment with the provider and remembers it. Once the
provider says it's paid, complete() extends the license, once, however often it's told.

Providers (TROHA_PAYMENTS):
	none   the default: payments are off (license codes still work)
	fake   for developing only: every payment is paid at once, with no money
	(PayPal comes here: its create() returns the address of PayPal's own payment page.)
"""

import secrets

from . import licenses, pricing
from .database import now


class PaymentsOff(Exception):
	"""No payment provider is set up."""


class FakeProvider:
	"""Pays at once, for trying the whole flow while developing."""

	def create(self, payment_id, amount_cents, currency, description):
		"""Opens a payment. @returns {"url": its payment page} or {"paid": True} if it's paid already."""
		return {"paid": True}


def provider_for(name):
	"""The provider TROHA_PAYMENTS names, or None for 'none'."""
	providers = {"none": None, "fake": FakeProvider}
	if name not in providers:
		raise ValueError(f"TROHA_PAYMENTS must be one of: {', '.join(providers)}")
	return providers[name]() if providers[name] else None


def start(db, provider, user_id, days, currency):
	"""Opens a payment for `days` days, in `currency`. @returns the provider's answer ({"url"} or {"paid"}).
	Raises PaymentsOff, or ValueError for days or a currency that can't be bought with."""
	if provider is None:
		raise PaymentsOff()
	amount = pricing.price_cents(days, currency)
	payment_id = f"troha-{secrets.token_hex(12)}"
	with db:
		db.execute(
			"INSERT INTO payments (id, user_id, days, amount_cents, currency, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)",
			(payment_id, user_id, days, amount, currency, now()),
		)
	answer = provider.create(payment_id, amount, currency, f"Troha license, {days} days")
	if answer.get("paid"):
		with db:
			complete(db, payment_id)
	return answer


def complete(db, payment_id):
	"""A payment was paid: extends its account's license (only the first time). @returns True if it did."""
	row = db.execute("SELECT user_id, days FROM payments WHERE id = ?", (payment_id,)).fetchone()
	if row is None:
		return False
	paid = db.execute("UPDATE payments SET status = 'paid' WHERE id = ? AND status = 'open'", (payment_id,)).rowcount
	if paid != 1 or row["user_id"] is None:  # told before, or its account was deleted meanwhile
		return False
	licenses.extend(db, row["user_id"], row["days"], "payment", reference=payment_id)
	return True
