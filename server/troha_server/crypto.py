
"""The server's keys, sealing data, and hashing passwords, PINs and tokens.

What a leaked database shows: email addresses, and when things happened. The rest
is sealed or hashed:
	passwords        Argon2id hashes (can't be turned back into the password)
	each user's data sealed (AES-256-GCM) with that user's own random key, which is
	                 itself sealed with a key derived from TROHA_SECRET_KEY (not in
	                 the database)
	PINs             Argon2id hashes, then sealed too: a PIN has so few possibilities
	                 that a bare hash could be guessed through quickly
	session and link tokens   SHA-256 hashes (they're long and random)
	license codes    keyed hashes (HMAC-SHA256, with a key derived from TROHA_SECRET_KEY):
	                 shorter, so a bare hash of an unused one could be guessed through

Every sealed value is tied to what it is and whose it is (its `context`), so one
can't be copied into another row or another user and still open.
"""

import base64
import hashlib
import hmac
import os
import secrets
import threading

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


NONCE_BYTES = 12
_hasher = PasswordHasher()  # Argon2id, with the library's recommended costs (~64 MB of memory each)
# At most this many Argon2 hashes or checks at once; the rest wait their turn. Otherwise a
# burst of sign-ins (each within its rate limit) could take gigabytes of memory at once.
_argon_slots = threading.BoundedSemaphore(4)
_dummy_hash = _hasher.hash("not a real password")  # for checking against when there's no user


class SealError(Exception):
	"""A sealed value couldn't be opened (wrong key or context, or it was changed)."""


class Keys:
	"""The keys derived from TROHA_SECRET_KEY, one for each kind of thing sealed."""

	def __init__(self, secret):
		self.user_keys = _derive(secret, b"troha/user-keys")  # seals each user's own key
		self.pins = _derive(secret, b"troha/pins")            # seals PIN hashes
		self.trials = _derive(secret, b"troha/trials")        # hashes emails that have had a free trial
		self.links = _derive(secret, b"troha/links")          # seals what emailed links carry (a new email)
		self.codes = _derive(secret, b"troha/license-codes")  # hashes license codes


def _derive(secret, purpose):
	return HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=purpose).derive(secret)


def new_secret():
	"""A new TROHA_SECRET_KEY, as base64 text."""
	return base64.urlsafe_b64encode(os.urandom(32)).decode("ascii").rstrip("=")


def new_data_key():
	"""A new key for one user's data."""
	return AESGCM.generate_key(bit_length=256)


def seal(key, plain, context):
	"""`plain` (bytes) encrypted and signed with `key`, tied to `context` (e.g. "habit:3:h1")."""
	nonce = os.urandom(NONCE_BYTES)
	return nonce + AESGCM(key).encrypt(nonce, plain, context.encode("utf-8"))


def open_sealed(key, sealed, context):
	"""Undoes seal(). Raises SealError."""
	try:
		return AESGCM(key).decrypt(sealed[:NONCE_BYTES], sealed[NONCE_BYTES:], context.encode("utf-8"))
	except Exception as error:  # cryptography raises InvalidTag; anything else means the same here
		raise SealError(context) from error


def hash_secret(text):
	"""An Argon2id hash of a password or PIN."""
	with _argon_slots:
		return _hasher.hash(text)


def check_secret(text, stored_hash):
	"""True if `text` matches `stored_hash` (made by hash_secret)."""
	try:
		with _argon_slots:
			return _hasher.verify(stored_hash, text)
	except (VerificationError, InvalidHashError):
		return False


def waste_a_check():
	"""Takes as long as checking a password, for when there's nothing to check against
	(so the time taken doesn't tell whether an email has an account)."""
	check_secret("not it", _dummy_hash)


def new_token():
	"""A long random token for a cookie or an emailed link."""
	return secrets.token_urlsafe(32)


def keyed_hash(key, text):
	"""A hash of `text` that can't be worked out (or guessed through) without `key`."""
	return hmac.new(key, text.encode("utf-8"), hashlib.sha256).digest()


def hash_token(token):
	"""What's stored for a token: its SHA-256 (it's random enough not to need more)."""
	return hashlib.sha256(token.encode("utf-8")).digest()
