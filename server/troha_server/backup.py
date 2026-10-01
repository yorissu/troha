
"""The nightly backup (troha-backup): a copy of the database, made with SQLite's own
backup (a plain file copy taken mid-write could be broken), into TROHA_BACKUP_DIR as
troha_YYYY-MM-DD.db. Only the newest TROHA_BACKUP_KEEP are kept.

The copies are as sealed as the database itself, so they're safe to store elsewhere
too, but only as long as TROHA_SECRET_KEY isn't stored with them; and without that
key, they can't be opened at all. Keep the key safe, apart from the backups.

To restore one, with troha-server stopped: python -m troha_server restore NAME
(see restore() below, and readme.md).
"""

import logging
import sqlite3
import time
from datetime import datetime, timedelta

from .database import connect


log = logging.getLogger("troha.backup")
PREFIX = "troha_"


def back_up(settings, when=None):
	"""Makes today's backup (replacing one made earlier today). @returns its path."""
	when = when or datetime.now()
	settings.backup_dir.mkdir(parents=True, exist_ok=True)
	target = settings.backup_dir / f"{PREFIX}{when:%Y-%m-%d}.db"
	partial = target.with_suffix(".partial")
	source = connect(settings.db_path)
	copy = sqlite3.connect(partial)
	try:
		source.backup(copy)
	finally:
		copy.close()
		source.close()
	partial.replace(target)  # only a finished copy gets the real name
	_prune(settings)
	return target


def backups(settings):
	"""The backups there are, oldest first."""
	return sorted(settings.backup_dir.glob(f"{PREFIX}????-??-??.db"))


def restore(settings, name):
	"""Puts backup `name` back as the database (troha-server must be stopped). Uses SQLite's
	own backup the other way round, so the database's other files (-wal, -shm) can't
	mix old changes into it."""
	source_path = settings.backup_dir / name
	if source_path.parent != settings.backup_dir or not source_path.is_file():
		raise FileNotFoundError(name)
	source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
	target = connect(settings.db_path)
	try:
		source.backup(target)
	finally:
		target.close()
		source.close()


def run_forever(settings):
	"""Backs up now if today's backup is missing, then every day at TROHA_BACKUP_HOUR."""
	logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
	log.info("Backing up %s to %s every day at %02d:00, keeping %d", settings.db_path, settings.backup_dir,
		settings.backup_hour, settings.backup_keep)
	while True:
		today = settings.backup_dir / f"{PREFIX}{datetime.now():%Y-%m-%d}.db"
		if settings.db_path.exists() and not today.exists():
			try:
				log.info("Backed up to %s", back_up(settings))
			except (OSError, sqlite3.Error) as error:
				log.error("Backup failed: %s", error)
		time.sleep(max(60, (_next_run(settings.backup_hour) - datetime.now()).total_seconds()))


def _next_run(hour):
	now = datetime.now()
	run = now.replace(hour=hour, minute=0, second=0, microsecond=0)
	return run if run > now else run + timedelta(days=1)


def _prune(settings):
	for old in backups(settings)[:-settings.backup_keep]:
		old.unlink()
		log.info("Deleted old backup %s", old.name)
