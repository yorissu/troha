
"""The server checks on itself: every so often it asks its own /api/health. If it
doesn't answer (it's stuck), the whole process ends, so Docker starts a fresh one
(restart: unless-stopped in compose.yml restarts a container that stops, but not
one that's only stuck). Meanwhile the page shows that the server can't be
reached, and reloads once it's back.

A crashed server needs none of this: Docker restarts it anyway. It runs only when
TROHA_SELF_CHECK_URL is set (compose.yml sets it), so admin commands don't start it.
"""

import logging
import os
import threading
import time
import urllib.request


CHECK_EVERY_SECONDS = 30
ANSWER_WITHIN_SECONDS = 10
MISSES_ALLOWED = 2  # this many unanswered checks in a row mean it's stuck
NO_PROXY = urllib.request.build_opener(urllib.request.ProxyHandler({}))  # always ask this computer directly

log = logging.getLogger("troha.self_check")


def start_self_check(health_url):
	"""Starts checking `health_url` in the background."""
	threading.Thread(target=_check_forever, args=(health_url,), name="self-check", daemon=True).start()


def _check_forever(health_url):
	misses = 0
	while True:
		time.sleep(CHECK_EVERY_SECONDS)
		misses = 0 if _answers(health_url) else misses + 1
		if misses >= MISSES_ALLOWED:
			log.error("The server isn't answering (stuck): stopping, so it's started afresh")
			logging.shutdown()
			os._exit(1)  # at once: a stuck thread mustn't hold it up


def _answers(health_url):
	try:
		with NO_PROXY.open(health_url, timeout=ANSWER_WITHIN_SECONDS) as response:
			return response.status == 200
	except OSError:
		return False
