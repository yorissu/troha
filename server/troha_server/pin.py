
"""The PIN: it shows hidden habits. One per account, 4 to 8 digits.

Its Argon2id hash is sealed with the server's key (a PIN has so few possibilities
that a bare hash could be guessed through quickly). Wrong PINs count: from the
FREE_TRIES-th on, each one makes the next try wait, LOCKOUT_SECONDS at first and
twice as long every time after (up to MAX_LOCKOUT_SECONDS), until the right PIN.
Each try is counted, and the wait set, in one step before the PIN is even checked,
so tries sent all at once can't slip past it.

A correct PIN unlocks the session it was typed in: its hidden habits' names are
sent until the session is locked again, or UNLOCK_SECONDS pass without the page
saying it's in use (POST /api/pin/touch, sent while someone touches the screen).
This is the one place that decides when hidden habits lock: every answer that
unlocks or keeps them unlocked says how many seconds are left, and the page counts
those down (asking "Lock them?" near the end), then locks.

Easter egg: 0000 can't be set; tried (and wrong) it gets a "nice try" instead of
counting as a wrong PIN.
"""

import json
import re

from . import crypto
from .database import now


PIN_PATTERN = re.compile(r"^\d{4,8}$")
JOKE_PIN = "0000"
FREE_TRIES = 3
LOCKOUT_SECONDS = 60
MAX_LOCKOUT_SECONDS = 60 * 60
UNLOCK_SECONDS = 70  # a minute without a touch, and 10 more seconds for the page to ask "Lock them?"


def valid_new_pin(pin):
	return isinstance(pin, str) and bool(PIN_PATTERN.match(pin)) and pin != JOKE_PIN


def has_pin(user):
	return user["pin"] is not None


def pin_length(keys, user):
	"""How many digits the PIN has (the PIN pad checks it as soon as that many are typed); None if there's none."""
	return _record(keys, user)["length"] if has_pin(user) else None


def set_pin(db, keys, user_id, pin):
	"""Sets (or replaces) the PIN. The caller checks valid_new_pin() first."""
	record = json.dumps({"hash": crypto.hash_secret(pin), "length": len(pin)}).encode("utf-8")
	sealed = crypto.seal(keys.pins, record, f"pin:{user_id}")
	db.execute("UPDATE users SET pin = ?, pin_failures = 0, pin_locked_until = NULL WHERE id = ?", (sealed, user_id))


def wait_seconds(user):
	"""Seconds until another PIN may be tried (0: now)."""
	until = user["pin_locked_until"]
	return max(0, until - now()) if until else 0


def check_pin(db, keys, user_id, pin):
	"""Tries a PIN. @returns 'ok', 'wrong', 'nice-try' or 'wait' (locked out for now).
	Commits by itself (call it outside a transaction): the try is counted at once."""
	moment = now()
	with db:
		user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
		if not has_pin(user):
			return "wrong"
		if wait_seconds(user):
			return "wait"
		if pin == JOKE_PIN:  # can never be the PIN, so it needn't count
			return "nice-try"
		# Counts the try, and sets the wait it would earn if wrong, unless another try got there first.
		counted = db.execute(
			"""UPDATE users SET pin_failures = pin_failures + 1,
			       pin_locked_until = CASE WHEN pin_failures + 1 >= ?1
			           THEN ?2 + MIN(?3, ?4 << MIN(pin_failures + 1 - ?1, 10)) ELSE NULL END
			   WHERE id = ?5 AND (pin_locked_until IS NULL OR pin_locked_until <= ?2)""",
			(FREE_TRIES, moment, MAX_LOCKOUT_SECONDS, LOCKOUT_SECONDS, user_id),
		).rowcount
	if not counted:
		return "wait"
	if isinstance(pin, str) and crypto.check_secret(pin, _record(keys, user)["hash"]):
		with db:
			db.execute("UPDATE users SET pin_failures = 0, pin_locked_until = NULL WHERE id = ?", (user_id,))
		return "ok"
	return "wrong"


def unlock(db, token_hash):
	"""Unlocks the session (or keeps it unlocked) for UNLOCK_SECONDS from now. @returns those seconds."""
	db.execute("UPDATE sessions SET unlocked_until = ? WHERE token_hash = ?", (now() + UNLOCK_SECONDS, token_hash))
	return UNLOCK_SECONDS


def lock(db, token_hash):
	db.execute("UPDATE sessions SET unlocked_until = NULL WHERE token_hash = ?", (token_hash,))


def is_unlocked(session):
	return session["unlocked_until"] is not None and session["unlocked_until"] > now()


def lock_all(db, user_id):
	"""Locks every session of the user (e.g. after the PIN changes)."""
	db.execute("UPDATE sessions SET unlocked_until = NULL WHERE user_id = ?", (user_id,))


def _record(keys, user):
	return json.loads(crypto.open_sealed(keys.pins, user["pin"], f"pin:{user['id']}"))
