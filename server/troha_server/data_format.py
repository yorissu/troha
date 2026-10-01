
"""The shape of a user's data, as the page sends and gets it:

	{
	  settings: { theme, brightness, screen, nightTime: {from, until}, sleepTime: {from, until} },
	  habits: [{ id, name, days, everyWeeks, startDate, endDate, color, priority, hidden }],
	  log: { "YYYY-MM-DD": { total, due: [habit ids], done: [habit ids] } },
	}

`days` are ISO weekdays (1 = Monday); dates are "YYYY-MM-DD"; times "HH:MM";
`endDate` is the last day a habit is on (null: for good). A hidden habit's `name`
is null when the page hasn't been given it (see user_data.py).

A day's log entry: the habits that were due (`due`, which the calendar shows as dots
in their colours), and which of them were done; `total` is how many were due. Days
logged before `due` was kept have only `total` and `done`.

clean() never trusts what it gets: anything missing, malformed or impossible is
dropped or replaced by a safe default, so everything stored has this shape. The
page has the same choices (client/src/models/settings.js and priorities.js); keep them alike.
(The currency isn't a setting: it's the account's, see accounts.currency.)
"""

import re
from datetime import date


CHOICES = {
	"theme": (("light", "dark", "auto"), "light"),
	"brightness": (("bright", "dim", "auto"), "auto"),
	"screen": (("never", "idle", "auto"), "auto"),
}
TIME_RANGES = {
	"nightTime": {"from": "20:00", "until": "07:00"},
	"sleepTime": {"from": "22:00", "until": "07:00"},
}
PRIORITIES = ("low", "medium", "high")
DEFAULT_PRIORITY = "medium"
MAX_EVERY_WEEKS = 52
MAX_NAME_LENGTH = 200
FALLBACK_START = "2000-01-03"  # a Monday, long ago: "has always been on"

ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
COLOR_PATTERN = re.compile(r"^[a-z]{1,20}$")
DAY_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def default_data():
	"""A new account's data: no habits yet, the default settings."""
	return clean({})


def clean(raw):
	"""`raw` in the shape above, with anything that doesn't fit dropped or defaulted."""
	data = raw if isinstance(raw, dict) else {}
	habits = []
	seen = set()
	for habit in data.get("habits") if isinstance(data.get("habits"), list) else []:
		habit = clean_habit(habit)
		if habit and habit["id"] not in seen:  # one habit per id
			seen.add(habit["id"])
			habits.append(habit)
	return {"settings": clean_settings(data.get("settings")), "habits": habits, "log": clean_log(data.get("log"))}


def clean_settings(raw):
	settings = raw if isinstance(raw, dict) else {}
	result = {key: settings.get(key) if settings.get(key) in choices else fallback for key, (choices, fallback) in CHOICES.items()}

	def time_range(key):
		value = settings.get(key)
		if isinstance(value, dict) and is_time(value.get("from")) and is_time(value.get("until")):
			return {"from": value["from"], "until": value["until"]}
		return dict(TIME_RANGES[key])

	result["nightTime"] = time_range("nightTime")
	result["sleepTime"] = fit_sleep_into_night(result["nightTime"], time_range("sleepTime"))
	return result


def clean_habit(raw):
	"""One habit, or None if it can't be one (no id, or no name and not hidden)."""
	if not isinstance(raw, dict) or not is_id(raw.get("id")):
		return None
	hidden = raw.get("hidden") is True
	name = raw.get("name")
	if isinstance(name, str):
		name = name.strip()[:MAX_NAME_LENGTH]
	if not (isinstance(name, str) and name) and not (hidden and name is None):
		return None
	days = raw.get("days") if isinstance(raw.get("days"), list) else []
	start = raw.get("startDate") if is_day(raw.get("startDate")) else FALLBACK_START
	end = raw.get("endDate")
	every = raw.get("everyWeeks")
	color = raw.get("color")
	return {
		"id": raw["id"],
		"name": name,
		"days": sorted({day for day in days if _is_int(day) and 1 <= day <= 7}),
		"everyWeeks": every if _is_int(every) and 1 <= every <= MAX_EVERY_WEEKS else 1,
		"startDate": start,
		"endDate": end if is_day(end) and end >= start else None,
		"color": color if isinstance(color, str) and COLOR_PATTERN.match(color) else "",
		"priority": raw.get("priority") if raw.get("priority") in PRIORITIES else DEFAULT_PRIORITY,
		"hidden": hidden,
	}


def clean_log(raw):
	if not isinstance(raw, dict):
		return {}
	log = {}
	for day, entry in raw.items():
		if not is_day(day) or not isinstance(entry, dict):
			continue
		done = _ids(entry.get("done"))
		due = entry.get("due")
		if isinstance(due, list):
			due = _ids(due)
			# Done only among the due, and the count always the number due, so they never disagree.
			log[day] = {"total": len(due), "due": due, "done": [item for item in done if item in due]}
		else:  # logged before `due` was kept
			total = entry.get("total")
			log[day] = {"total": total if _is_int(total) and total >= 0 else 0, "done": done}
	return log


def _ids(raw):
	"""The habit ids in `raw` (a list), without repeats, in order."""
	return list(dict.fromkeys(item for item in raw if is_id(item))) if isinstance(raw, list) else []


def fit_sleep_into_night(night, sleep):
	"""The sleep time moved inside the night (the page does the same: client/src/models/settings.js)."""
	def inside(time):
		return _within(time, night["from"], night["until"])

	start = _minutes(night["from"])
	begin = sleep["from"] if inside(sleep["from"]) else night["from"]
	end = sleep["until"] if inside(sleep["until"]) else night["until"]
	if _after(start, _minutes(begin)) > _after(start, _minutes(end)):
		end = night["until"]
	return {"from": begin, "until": end}


def is_id(value):
	return isinstance(value, str) and bool(ID_PATTERN.match(value))


def is_day(value):
	"""True for a real calendar day written "YYYY-MM-DD" (not e.g. 31 February)."""
	if not isinstance(value, str) or not DAY_PATTERN.match(value):
		return False
	try:
		date.fromisoformat(value)
	except ValueError:
		return False
	return True


def is_time(value):
	return isinstance(value, str) and bool(TIME_PATTERN.match(value))


def _is_int(value):
	return isinstance(value, int) and not isinstance(value, bool)


def _minutes(time):
	hours, minutes = time.split(":")
	return int(hours) * 60 + int(minutes)


def _after(start, minutes):
	"""Minutes from `start` to `minutes`, going forward round the clock."""
	return (minutes - start) % 1440


def _within(time, begin, end):
	start = _minutes(begin)
	return _after(start, _minutes(time)) <= _after(start, _minutes(end))
