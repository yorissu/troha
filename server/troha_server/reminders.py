
"""Emails that go out by themselves: for now, a warning a few days before an
account's license ends (licenses.WARN_DAYS). Checked every hour, in the background.
They go through the mailer like every other email (printed to the log until a mail
server is set up; see mailer.py).
"""

import logging
import threading
import time
from datetime import datetime, timezone

from . import licenses
from .database import connect

CHECK_EVERY_SECONDS = 60 * 60

log = logging.getLogger("troha.reminders")


def start_reminders(settings, mailer):
	threading.Thread(target=_check_forever, args=(settings, mailer), name="reminders", daemon=True).start()


def send_due(settings, mailer):
	"""Sends every warning that's due now. @returns how many."""
	db = connect(settings.db_path)
	try:
		due = licenses.due_warnings(db)
		for user in due:
			# Sent, then noted, one at a time: the database isn't held while an email goes out
			# (which can take a while). A crash in between sends that warning twice, never not at all.
			ends = datetime.fromtimestamp(user["ends_at"], timezone.utc).strftime("%d %B %Y, %H:%M UTC")
			mailer.send(user["email"], "Your Troha license ends soon",
				f"Your Troha license ends on {ends}. After that, your habits stay safe, but you can't use them "
				f"until you renew it.\n\nRenew it in Troha, under Account:\n\n{settings.public_url}\n\nTroha")
			with db:
				licenses.warned(db, user["id"], user["ends_at"])
		return len(due)
	finally:
		db.close()


def _check_forever(settings, mailer):
	while True:
		try:
			sent = send_due(settings, mailer)
			if sent:
				log.info("Sent %d license warning%s", sent, "" if sent == 1 else "s")
		except Exception:  # keep checking next time; the error is in the log
			log.exception("Couldn't send license warnings")
		time.sleep(CHECK_EVERY_SECONDS)
