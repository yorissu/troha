
"""The SQLite database: one file (TROHA_DB_PATH), opened by troha-server only.

Its tables are made and updated by the numbered scripts in migrations/, run in
order at startup; PRAGMA user_version remembers the last one run. To change the
tables, add the next script; never edit one that has already run somewhere.
"""

import sqlite3
import time
from pathlib import Path


MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def connect(path):
	"""A connection to the database at `path`. Use it as `with connect(...) as db:` for a transaction."""
	connection = sqlite3.connect(path, timeout=10, check_same_thread=False)
	connection.row_factory = sqlite3.Row
	connection.execute("PRAGMA foreign_keys = ON")
	connection.execute("PRAGMA busy_timeout = 10000")
	return connection


def migrate(path):
	"""Creates the database if needed and runs the migrations it hasn't had yet. @returns how many ran."""
	Path(path).parent.mkdir(parents=True, exist_ok=True)
	connection = connect(path)
	try:
		connection.execute("PRAGMA journal_mode = WAL")  # readers don't wait for the writer
		done = connection.execute("PRAGMA user_version").fetchone()[0]
		scripts = sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9][0-9]_*.sql"))
		count = 0
		for script in scripts:
			number = int(script.name[:4])
			if number <= done:
				continue
			# executescript commits first; the script and its number are then saved together.
			connection.executescript(f"BEGIN;\n{script.read_text(encoding='utf-8')}\nPRAGMA user_version = {number};\nCOMMIT;")
			count += 1
		return count
	finally:
		connection.close()


def now():
	"""The time now, in whole seconds (as stored in the database)."""
	return int(time.time())
