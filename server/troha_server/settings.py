
"""What can be set from the environment (compose.yml passes in .env; see .env.example).

Only the secret key is required: everything sealed in the database depends on it,
so it must never be lost or changed. It's given as TROHA_SECRET_KEY, or as
TROHA_SECRET_KEY_FILE, a file holding it (compose.dev.yml makes one by itself).
"""

import base64
import binascii
import os
from dataclasses import dataclass
from pathlib import Path


SMTP_SECURITY = ("starttls", "ssl", "none")


class SettingsError(Exception):
	"""A setting is missing or malformed."""


@dataclass(frozen=True)
class Smtp:
	host: str
	port: int
	user: str
	password: str
	sender: str
	security: str  # 'starttls', 'ssl' or 'none'


@dataclass(frozen=True)
class Settings:
	db_path: Path
	secret: bytes          # 32 bytes: every other key is derived from it (see crypto.Keys)
	public_url: str        # where people open Troha, for links in emails
	secure_cookies: bool   # true once Troha is served over HTTPS
	smtp: Smtp | None      # None: emails are printed to the log instead
	payments: str          # the payment provider: 'none' (off) or 'fake' (developing; see payments.py)
	backup_dir: Path
	backup_hour: int       # the nightly backup runs at this hour (TZ's time)
	backup_keep: int       # backups kept; older ones are deleted


def load_settings(env=os.environ):
	"""The settings, from `env`. Raises SettingsError."""
	try:
		smtp_host = env.get("TROHA_SMTP_HOST", "").strip()
		security = env.get("TROHA_SMTP_SECURITY", "starttls").strip().lower()
		if smtp_host and security not in SMTP_SECURITY:
			# Anything else would send the mail password unencrypted: say so instead.
			raise SettingsError(f"TROHA_SMTP_SECURITY must be one of: {', '.join(SMTP_SECURITY)}")
		return Settings(
			db_path=Path(env.get("TROHA_DB_PATH", "/data/troha.db")),
			secret=_secret(env),
			public_url=env.get("TROHA_PUBLIC_URL", "http://localhost:8080").rstrip("/"),
			secure_cookies=env.get("TROHA_SECURE_COOKIES", "false").strip().lower() == "true",
			smtp=Smtp(
				host=smtp_host,
				port=int(env.get("TROHA_SMTP_PORT") or 587),
				user=env.get("TROHA_SMTP_USER", ""),
				password=env.get("TROHA_SMTP_PASSWORD", ""),
				sender=env.get("TROHA_SMTP_FROM", "") or env.get("TROHA_SMTP_USER", ""),
				security=security,
			) if smtp_host else None,
			payments=(env.get("TROHA_PAYMENTS") or "none").strip().lower(),
			backup_dir=Path(env.get("TROHA_BACKUP_DIR", "/backups")),
			backup_hour=int(env.get("TROHA_BACKUP_HOUR") or 3) % 24,
			backup_keep=max(1, int(env.get("TROHA_BACKUP_KEEP") or 14)),
		)
	except ValueError as error:
		raise SettingsError(f"A number setting isn't a number ({error})") from error


def _secret(env):
	"""The secret key: 32 random bytes, base64 (python -m troha_server keygen makes one)."""
	text = env.get("TROHA_SECRET_KEY", "").strip()
	key_file = env.get("TROHA_SECRET_KEY_FILE", "").strip()
	if not text and key_file:
		try:
			text = Path(key_file).read_text(encoding="ascii").strip()
		except (OSError, UnicodeDecodeError) as error:
			raise SettingsError(f"Can't read TROHA_SECRET_KEY_FILE ({error})") from error
	if not text:
		raise SettingsError("TROHA_SECRET_KEY is not set. Make one with: python -m troha_server keygen")
	try:
		secret = base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
	except (binascii.Error, ValueError) as error:
		raise SettingsError("TROHA_SECRET_KEY is not valid base64") from error
	if len(secret) != 32:
		raise SettingsError("TROHA_SECRET_KEY must be 32 bytes (make one with: python -m troha_server keygen)")
	return secret
