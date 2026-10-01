
"""Licenses: an account can use Troha while its license runs. A license is a run of
days; each time it's extended (signing up, a license code, a payment, an admin) adds
a row that starts when the license would have ended, or now if it already has, so
renewing early loses nothing and the rows always run on from one another.

	signing up      TRIAL_DAYS free, once per email address (even after the account
	                is deleted: see trial_used and remember_trial)
	license codes   made with `python -m troha_server code`; each gives its days, once
	                (negative days take days off); only a keyed hash of each is kept
	payments        see payments.py
	admin           `python -m troha_server grant EMAIL --days D`

An account without a running license can still sign in, but only to its account
(renew, download its data, change or delete it): see app.py's licensed().
"""

import secrets

from . import crypto
from .database import now


TRIAL_DAYS = 7
WARN_DAYS = 5  # this long before the license ends, an email goes out and the page starts saying so
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I, so codes read out clearly
CODE_LENGTH = 12


# ---------- The license ----------

def valid_until(db, user_id):
	"""When the account's license ends (unix seconds), or None if it isn't running."""
	end = _last_end(db, user_id)
	return end if end and end > now() else None


def extend(db, user_id, days, source, reference=None):
	"""Adds `days` to the license (from its end, or from now if it has ended). Negative days
	take days off its end instead: at or before now, the license has ended (one that has
	ended already stays as it was). @returns the license's end (None if it has none)."""
	if not db.in_transaction:
		db.execute("BEGIN IMMEDIATE")  # held from reading the end to writing the new one: two at once can't overlap
	moment = now()
	last_end = _last_end(db, user_id)
	if days < 0:
		return _shorten(db, user_id, days, source, reference, moment, last_end)
	start = max(moment, last_end or 0)
	end = start + int(days) * 86400
	db.execute(
		"INSERT INTO licenses (user_id, source, status, starts_at, ends_at, reference) VALUES (?, ?, 'active', ?, ?, ?)",
		(user_id, source, start, end, reference),
	)
	return end


def _shorten(db, user_id, days, source, reference, moment, last_end):
	"""extend() with negative days: the end moves back (no row runs past it any more), and a
	row of no length notes it, so the history says what happened."""
	if not last_end or last_end <= moment:
		return last_end  # it has ended already: nothing to take off
	end = last_end + int(days) * 86400
	db.execute(
		"""UPDATE licenses SET ends_at = MIN(ends_at, ?1), starts_at = MIN(starts_at, ?1)
		   WHERE user_id = ?2 AND status = 'active'""",
		(end, user_id),
	)
	db.execute(
		"INSERT INTO licenses (user_id, source, status, starts_at, ends_at, reference) VALUES (?, ?, 'active', ?, ?, ?)",
		(user_id, source, end, end, reference),
	)
	return end


def revoke(db, user_id):
	"""Ends the account's license now (days still to come are cut off). @returns True if it was running."""
	moment = now()
	return db.execute(
		"""UPDATE licenses SET ends_at = ?, starts_at = MIN(starts_at, ?)
		   WHERE user_id = ? AND status = 'active' AND ends_at > ?""",
		(moment, moment, user_id, moment),
	).rowcount > 0


def describe(db, user_id):
	"""The license as the page gets it: {validUntil} while it runs, else {validUntil: None, endedAt};
	and warnDays, how long before the end the page starts saying it's ending."""
	end = _last_end(db, user_id)
	running = bool(end) and end > now()
	return {"validUntil": end if running else None, "endedAt": None if running else end, "warnDays": WARN_DAYS}


def _last_end(db, user_id):
	row = db.execute("SELECT MAX(ends_at) AS end FROM licenses WHERE user_id = ? AND status = 'active'", (user_id,)).fetchone()
	return row["end"]


def start_trial(db, keys, user_id, email):
	"""A new account's free trial, unless its email address has had one. @returns True if it got one."""
	if _trial_used(db, keys, email):
		return False
	extend(db, user_id, TRIAL_DAYS, "trial")
	remember_trial(db, keys, email)
	return True


def remember_trial(db, keys, email):
	"""Notes that `email` has had its trial (also when its account is deleted, for accounts from before this was noted)."""
	db.execute("INSERT OR IGNORE INTO trials_used (email_hash, created_at) VALUES (?, ?)",
		(crypto.keyed_hash(keys.trials, email), now()))


def _trial_used(db, keys, email):
	return db.execute("SELECT 1 FROM trials_used WHERE email_hash = ?", (crypto.keyed_hash(keys.trials, email),)).fetchone() is not None


# ---------- License codes ----------

def new_code(db, keys, days):
	"""Makes a license code worth `days` (negative: it takes days off). @returns the code (only its keyed hash
	is kept: show it now)."""
	raw = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
	code = "-".join(raw[i:i + 4] for i in range(0, CODE_LENGTH, 4))
	db.execute(
		"INSERT INTO license_codes (code_hash, days, created_at) VALUES (?, ?, ?)",
		(_code_hash(keys, code), int(days), now()),
	)
	return code


def redeem_code(db, keys, user_id, code):
	"""Uses up a license code for the account and changes its license by the code's days.
	@returns those days, or None if the code doesn't exist or was used (even at the same moment)."""
	if not isinstance(code, str) or not code.strip():
		return None
	code_hash = _code_hash(keys, code)
	row = db.execute("SELECT days FROM license_codes WHERE code_hash = ? AND used_at IS NULL", (code_hash,)).fetchone()
	if row is None:
		return None
	used = db.execute(
		"UPDATE license_codes SET used_by = ?, used_at = ? WHERE code_hash = ? AND used_at IS NULL",
		(user_id, now(), code_hash),
	).rowcount
	if used != 1:
		return None
	extend(db, user_id, row["days"], "code")
	return row["days"]


def _code_hash(keys, code):
	"""What's stored for a code: a hash only TROHA_SECRET_KEY can make (a leaked database alone can't
	be used to try codes)."""
	return crypto.keyed_hash(keys.codes, _normalize_code(code))


def _normalize_code(text):
	"""A typed code in its stored form: uppercase, without spaces or dashes."""
	return "".join(ch for ch in str(text).upper() if ch.isalnum())


# ---------- Warnings ----------

def due_warnings(db):
	"""Accounts whose license ends within WARN_DAYS and haven't been warned about that end yet.
	@returns [(user_id, email, ends_at)]; mark each with warned() once it's sent."""
	moment = now()
	return db.execute(
		"""SELECT users.id AS id, users.email AS email, MAX(licenses.ends_at) AS ends_at
		   FROM users JOIN licenses ON licenses.user_id = users.id AND licenses.status = 'active'
		   GROUP BY users.id
		   HAVING ends_at > ? AND ends_at <= ? AND users.license_warned_until IS NOT ends_at""",
		(moment, moment + WARN_DAYS * 86400),
	).fetchall()


def warned(db, user_id, ends_at):
	db.execute("UPDATE users SET license_warned_until = ? WHERE id = ?", (ends_at, user_id))
