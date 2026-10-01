
"""Admin commands, run inside troha-server, e.g.:

	docker compose exec troha-server python -m troha_server code --days 365

	keygen                    a new TROHA_SECRET_KEY (only when setting Troha up)
	code [--count N] [--days D]   license codes, each giving D days (default 365) once;
	                          negative D takes days off instead
	users                     every account, with when its license ends
	grant EMAIL --days D      adds D days to an account's license (negative: takes them off)
	revoke EMAIL              ends an account's license now
	delete-user EMAIL         deletes an account and everything in it
	backup [--once]           the nightly backup (troha-backup runs this)
	backups                   the backups there are
	restore NAME              puts a backup back as the database (stop troha-server first)
"""

import argparse
import sys
from datetime import datetime

from . import accounts, backup, licenses
from .crypto import Keys, new_secret
from .database import connect, migrate
from .settings import SettingsError, load_settings


def main(argv=None):
	parser = argparse.ArgumentParser(prog="python -m troha_server", description="Troha admin commands")
	commands = parser.add_subparsers(dest="command", required=True)
	commands.add_parser("keygen", help="print a new TROHA_SECRET_KEY")
	code = commands.add_parser("code", help="make license codes")
	code.add_argument("--count", type=int, default=1)
	code.add_argument("--days", type=int, default=365, help="days of license each code gives (36500: 100 years; negative: takes days off)")
	commands.add_parser("users", help="list the accounts")
	grant = commands.add_parser("grant", help="add days to an account's license")
	grant.add_argument("email")
	grant.add_argument("--days", type=int, required=True)
	commands.add_parser("revoke", help="end an account's license now").add_argument("email")
	commands.add_parser("delete-user", help="delete an account and all its data").add_argument("email")
	commands.add_parser("backup", help="back up the database every night").add_argument(
		"--once", action="store_true", help="back up now, then stop")
	commands.add_parser("backups", help="list the backups")
	commands.add_parser("restore", help="put a backup back as the database (stop troha-server first)").add_argument(
		"name", help="e.g. troha_2026-10-01.db")
	args = parser.parse_args(argv)

	if args.command == "keygen":
		print(new_secret())
		return 0
	try:
		settings = load_settings()
	except SettingsError as error:
		print(error, file=sys.stderr)
		return 2

	if args.command == "backup":
		if not args.once:
			backup.run_forever(settings)
		print(f"Backed up to {backup.back_up(settings)}")
		return 0
	if args.command == "backups":
		for path in backup.backups(settings):
			print(path.name)
		return 0
	if args.command == "restore":
		try:
			backup.restore(settings, args.name)
		except FileNotFoundError:
			print(f"No backup called {args.name} (see: python -m troha_server backups)", file=sys.stderr)
			return 1
		print(f"Restored {args.name}. Start troha-server again.")
		return 0

	migrate(settings.db_path)
	db = connect(settings.db_path)
	try:
		with db:
			return run(args, db, settings)
	finally:
		db.close()


def run(args, db, settings):
	"""The commands that work on the accounts."""
	if args.command == "code":
		if args.days == 0:
			print("--days can't be 0", file=sys.stderr)
			return 2
		for _ in range(max(1, args.count)):
			print(licenses.new_code(db, Keys(settings.secret), args.days))
		return 0
	if args.command == "users":
		rows = db.execute("SELECT id, email, created_at FROM users ORDER BY id").fetchall()
		for row in rows:
			license_info = licenses.describe(db, row["id"])
			state = (f"license until {_date(license_info['validUntil'])}" if license_info["validUntil"]
				else f"license ended {_date(license_info['endedAt'])}" if license_info["endedAt"] else "no license")
			print(f"{row['email']:40}  since {_date(row['created_at'])}  {state}")
		print(f"{len(rows)} account{'' if len(rows) == 1 else 's'}")
		return 0

	user = accounts.find_user(db, accounts.normalize_email(args.email) or "")
	if user is None:
		print(f"No account with the email {args.email}", file=sys.stderr)
		return 1
	if args.command == "grant":
		if args.days == 0:
			print("--days can't be 0", file=sys.stderr)
			return 2
		licenses.extend(db, user["id"], args.days, "admin")
		info = licenses.describe(db, user["id"])
		print(f"{user['email']}'s license now runs until {_date(info['validUntil'])}" if info["validUntil"]
			else f"{user['email']}'s license has ended" + (f" ({_date(info['endedAt'])})" if info["endedAt"] else ""))
	elif args.command == "revoke":
		running = licenses.revoke(db, user["id"])
		print(f"Ended {user['email']}'s license" if running else f"{user['email']} had no running license")
	elif args.command == "delete-user":
		licenses.remember_trial(db, Keys(settings.secret), user["email"])  # no second trial for this address
		accounts.delete_user(db, user["id"])
		print(f"Deleted {user['email']}")
	return 0


def _date(seconds):
	return datetime.fromtimestamp(seconds).strftime("%Y-%m-%d")
