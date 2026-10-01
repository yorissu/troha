
"""How often things may be tried: sign-ins, password resets, sign-ups, license codes.

Kept in memory (troha-server is one process), as a list of recent tries per kind of
try and who's trying, e.g. ("sign-in:ip", "203.0.113.5") or ("sign-in:email",
"anna@example.com"). Limits per address and per email together slow down both
guessing one account's password and trying one password on many accounts.
"""

import threading
import time


# Kind of try -> (tries allowed, within this many seconds).
LIMITS = {
	"sign-in:ip": (20, 15 * 60),
	"sign-in:email": (8, 15 * 60),
	"register:ip": (5, 24 * 60 * 60),  # each sign-up gets a free trial
	"forgot:ip": (10, 60 * 60),
	"email:to": (3, 60 * 60),        # emails with links sent to one address
	"password:user": (10, 15 * 60),  # account changes that ask for the password
	"code:user": (10, 60 * 60),      # license codes tried
	"checkout:user": (20, 60 * 60),  # payments opened
}
MAX_KEYS = 100_000  # beyond this many, the ones with no recent tries are forgotten (so memory can't run out)


class RateLimiter:
	def __init__(self, clock=time.monotonic):
		self._clock = clock
		self._tries = {}  # (kind, who) -> times of the recent tries
		self._lock = threading.Lock()

	def allow(self, kind, who):
		"""Counts a try of `kind` by `who`. @returns False if there have been too many lately."""
		limit, window = LIMITS[kind]
		key = (kind, str(who))
		moment = self._clock()
		with self._lock:
			if len(self._tries) > MAX_KEYS:
				self._forget_old(moment)
			recent = [t for t in self._tries.get(key, []) if moment - t < window]
			allowed = len(recent) < limit
			if allowed:
				recent.append(moment)
			self._tries[key] = recent
			return allowed

	def reset(self, kind, who):
		"""Forgets the tries (e.g. after a successful sign-in)."""
		with self._lock:
			self._tries.pop((kind, str(who)), None)

	def _forget_old(self, moment):
		"""Forgets whoever has no tries within their window. Still too many (a flood of new
		keys): forgets all but those being held back right now, so a flood can't free them."""
		def recent(key, tries):
			return [t for t in tries if moment - t < LIMITS[key[0]][1]]

		self._tries = {key: kept for key, tries in self._tries.items() if (kept := recent(key, tries))}
		if len(self._tries) > MAX_KEYS:
			self._tries = {key: tries for key, tries in self._tries.items() if len(tries) >= LIMITS[key[0]][0]}
