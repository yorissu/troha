
"""The server checks on itself: every so often it asks its own /api/health. If it
doesn't answer (it's stuck), the whole process ends, so the system starts a fresh
one (troha.service does, 2 seconds later). Meanwhile the page shows that the
server is down, and reloads once it's back.

A crashed server needs none of this: the system restarts it anyway.
"""

import os
import sys
import threading
import time
import urllib.request


CHECK_EVERY_SECONDS = 30
ANSWER_WITHIN_SECONDS = 10
MISSES_ALLOWED = 2  # this many unanswered checks in a row mean it's stuck
NO_PROXY = urllib.request.build_opener(urllib.request.ProxyHandler({}))  # always ask this computer directly


def start_self_check(health_url):
	"""Starts checking `health_url` in the background."""
	threading.Thread(target=check_forever, args=(health_url,), name="self-check", daemon=True).start()


def check_forever(health_url):
	misses = 0
	while True:
		time.sleep(CHECK_EVERY_SECONDS)
		misses = 0 if answers(health_url) else misses + 1
		if misses >= MISSES_ALLOWED:
			print("The server isn't answering (stuck): stopping, so it's started afresh", file=sys.stderr)
			sys.stderr.flush()
			os._exit(1)  # at once: a stuck thread mustn't hold it up


def answers(health_url):
	try:
		with NO_PROXY.open(health_url, timeout=ANSWER_WITHIN_SECONDS) as response:
			return response.status == 200
	except OSError:
		return False
