
"""Setting the device's clock, with timedatectl (Linux, e.g. the Raspberry Pi).

From the network, through the system's own time service; or to a time given by
hand. Elsewhere (e.g. Windows, while developing) a time given by hand is accepted
but not used, so the page can still be tried out.
"""

import re
import shutil
import subprocess
import time
from datetime import datetime
from pathlib import Path


# systemd-timesyncd touches this file every time it has set the clock from the network.
SYNC_FLAG = Path("/run/systemd/timesync/synchronized")
SYNC_WAIT_SECONDS = 15
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
TIME_PATTERN = re.compile(r"\d{2}:\d{2}")


def supported():
	"""True where the clock can really be set."""
	return shutil.which("timedatectl") is not None


def valid_date_time(date, clock_time):
	"""True for a real "YYYY-MM-DD" date and "HH:MM" time."""
	if not (isinstance(date, str) and isinstance(clock_time, str)):
		return False
	if not (DATE_PATTERN.fullmatch(date) and TIME_PATTERN.fullmatch(clock_time)):
		return False
	try:
		datetime.strptime(f"{date} {clock_time}", "%Y-%m-%d %H:%M")
	except ValueError:
		return False
	return True


def run_timedatectl(*args):
	"""Runs `timedatectl args`. Returns None if it worked, else why not ('not-allowed' or 'failed')."""
	try:
		result = subprocess.run(["timedatectl", *args], capture_output=True, text=True, timeout=20)
	except (OSError, subprocess.TimeoutExpired):
		return "failed"
	if result.returncode == 0:
		return None
	message = (result.stderr or result.stdout).lower()
	denied = ("authentication", "access denied", "not authorized")
	return "not-allowed" if any(word in message for word in denied) else "failed"


def sync_clock():
	"""Asks the system's time service to set the clock from the network now, and waits for it."""
	if not supported():
		return {"ok": False, "reason": "not-supported"}
	before = SYNC_FLAG.stat().st_mtime if SYNC_FLAG.exists() else None
	for args in (("set-ntp", "false"), ("set-ntp", "true")):  # restarting the service makes it try right away
		problem = run_timedatectl(*args)
		if problem:
			return {"ok": False, "reason": problem}
	deadline = time.monotonic() + SYNC_WAIT_SECONDS
	while time.monotonic() < deadline:
		# Compared with != (not >): the clock may have jumped backwards.
		if SYNC_FLAG.exists() and SYNC_FLAG.stat().st_mtime != before:
			return {"ok": True}
		time.sleep(0.5)
	return {"ok": False, "reason": "offline"}


def set_clock(date, clock_time):
	"""Sets the clock by hand (local time); network time sync is switched back on afterwards."""
	if not valid_date_time(date, clock_time):
		return {"ok": False, "reason": "invalid"}
	if not supported():
		print(f"Not setting the clock to {date} {clock_time} (only done on Linux)")
		return {"ok": True, "test": True}
	# The clock can only be set by hand while network time sync is off.
	problem = run_timedatectl("set-ntp", "false") or run_timedatectl("set-time", f"{date} {clock_time}:00")
	run_timedatectl("set-ntp", "true")
	return {"ok": False, "reason": problem} if problem else {"ok": True}
