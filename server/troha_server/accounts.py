
"""Users, sign-in sessions, and the links sent by email.

A session is a random token in a cookie; the database keeps only its hash. Using
Troha keeps it alive; after IDLE_DAYS without use it ends. Changing
the password (or resetting it) ends every other session.
"""

import json
import re
import sqlite3

from . import crypto, pricing
from .database import now


EMAIL_PATTERN = re.compile(r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]+$")
MAX_EMAIL_LENGTH = 254
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 200
IDLE_DAYS = 5                     # a session ends after this long without use
TOUCH_EVERY_SECONDS = 60          # a session's last use is written at most this often
LINK_MINUTES = {"reset": 30, "email": 24 * 60}


class EmailTaken(Exception):
	"""Another account already has this email address."""


def normalize_email(text):
	"""The address, trimmed and lowercase, or None if it doesn't look like one."""
	if not isinstance(text, str):
		return None
	email = text.strip().lower()
	return email if len(email) <= MAX_EMAIL_LENGTH and EMAIL_PATTERN.match(email) else None


def valid_password(text):
	return isinstance(text, str) and MIN_PASSWORD_LENGTH <= len(text) <= MAX_PASSWORD_LENGTH


# ---------- Users ----------

def create_user(db, keys, email, password):
	"""A new user (with their own data key). @returns their id. Raises EmailTaken."""
	if find_user(db, email):
		raise EmailTaken(email)
	try:
		cursor = db.execute(
			"INSERT INTO users (email, password_hash, data_key, created_at) VALUES (?, ?, ?, ?)",
			(email, crypto.hash_secret(password), b"", now()),
		)
	except sqlite3.IntegrityError:  # taken meanwhile (by a sign-up at the same moment)
		raise EmailTaken(email) from None
	user_id = cursor.lastrowid
	sealed_key = crypto.seal(keys.user_keys, crypto.new_data_key(), f"user-key:{user_id}")
	db.execute("UPDATE users SET data_key = ? WHERE id = ?", (sealed_key, user_id))
	return user_id


def find_user(db, email):
	return db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def get_user(db, user_id):
	return db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def check_password(db, email, password):
	"""The user if `password` is theirs, else None. Takes as long either way."""
	user = find_user(db, email) if email else None
	if user is None:
		crypto.waste_a_check()
		return None
	return user if crypto.check_secret(password, user["password_hash"]) else None


def password_matches(user, password):
	return isinstance(password, str) and crypto.check_secret(password, user["password_hash"])


def set_password(db, user_id, password):
	db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (crypto.hash_secret(password), user_id))


def set_email(db, user_id, email):
	"""Raises EmailTaken."""
	other = find_user(db, email)
	if other and other["id"] != user_id:
		raise EmailTaken(email)
	try:
		db.execute("UPDATE users SET email = ? WHERE id = ?", (email, user_id))
	except sqlite3.IntegrityError:
		raise EmailTaken(email) from None


def currency(user):
	"""The currency the account's prices are shown and paid in (Account -> License)."""
	return user["currency"] if pricing.is_currency(user["currency"]) else pricing.DEFAULT_CURRENCY


def set_currency(db, user_id, value):
	"""The caller checks pricing.is_currency() first."""
	db.execute("UPDATE users SET currency = ? WHERE id = ?", (value, user_id))


def delete_user(db, user_id):
	"""Deletes the user and everything of theirs (sessions, habits, log, licenses…), except
	their payments, which are kept for the books without the account."""
	db.execute("DELETE FROM users WHERE id = ?", (user_id,))


def data_key(keys, user):
	"""The user's own key, for their data."""
	return crypto.open_sealed(keys.user_keys, user["data_key"], f"user-key:{user['id']}")


# ---------- Sessions ----------

def start_session(db, user_id):
	"""Signs a browser in. @returns the token for its cookie."""
	token = crypto.new_token()
	moment = now()
	db.execute(
		"INSERT INTO sessions (token_hash, user_id, created_at, last_used_at) VALUES (?, ?, ?, ?)",
		(crypto.hash_token(token), user_id, moment, moment),
	)
	return token


def find_session(db, token):
	"""The session for a cookie's token, if it's still on (it's kept alive by this); else None."""
	if not token:
		return None
	token_hash = crypto.hash_token(token)
	session = db.execute("SELECT * FROM sessions WHERE token_hash = ?", (token_hash,)).fetchone()
	if session is None:
		return None
	moment = now()
	if moment - session["last_used_at"] > IDLE_DAYS * 86400:
		db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
		return None
	if moment - session["last_used_at"] >= TOUCH_EVERY_SECONDS:
		db.execute("UPDATE sessions SET last_used_at = ? WHERE token_hash = ?", (moment, token_hash))
	return session


def end_session(db, token_hash):
	db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))


def end_other_sessions(db, user_id, keep_token_hash=None):
	"""Signs out every other browser (e.g. after a password change)."""
	db.execute("DELETE FROM sessions WHERE user_id = ? AND token_hash IS NOT ?", (user_id, keep_token_hash))


def remove_stale(db):
	"""Deletes sessions and links that have run out."""
	moment = now()
	db.execute("DELETE FROM sessions WHERE last_used_at < ?", (moment - IDLE_DAYS * 86400,))
	db.execute("DELETE FROM tokens WHERE expires_at < ?", (moment,))


# ---------- Emailed links ----------

def issue_link(db, keys, user_id, purpose, payload=None):
	"""A token for an emailed link ('reset' or 'email'). An earlier one for the same purpose stops working."""
	token = crypto.new_token()
	token_hash = crypto.hash_token(token)
	sealed = crypto.seal(keys.links, json.dumps(payload).encode("utf-8"), f"link:{purpose}:{token_hash.hex()}") if payload else None
	db.execute("DELETE FROM tokens WHERE user_id = ? AND purpose = ?", (user_id, purpose))
	db.execute(
		"INSERT INTO tokens (token_hash, user_id, purpose, payload, expires_at) VALUES (?, ?, ?, ?, ?)",
		(token_hash, user_id, purpose, sealed, now() + LINK_MINUTES[purpose] * 60),
	)
	return token


def use_link(db, keys, token, purpose):
	"""Uses up a link's token. @returns (user_id, payload) if it's valid and on time, else None."""
	if not isinstance(token, str) or not token:
		return None
	token_hash = crypto.hash_token(token)
	row = db.execute("SELECT * FROM tokens WHERE token_hash = ? AND purpose = ?", (token_hash, purpose)).fetchone()
	if row is None:
		return None
	db.execute("DELETE FROM tokens WHERE token_hash = ?", (token_hash,))
	if row["expires_at"] < now():
		return None
	payload = None
	if row["payload"] is not None:
		payload = json.loads(crypto.open_sealed(keys.links, row["payload"], f"link:{purpose}:{token_hash.hex()}"))
	return row["user_id"], payload
