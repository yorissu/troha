
"""The data folder: one JSON file per data set (e.g. data/habits.json), of which
one is in use (its name is kept in data/in_use.txt).

Every write goes to a temporary file first, which is then swapped in, so a power
cut can never leave half a file behind.
"""

import json
import os
import re
import threading
from pathlib import Path


DEFAULT_NAME = "habits"
NAME_PATTERN = re.compile(r"[a-z0-9][a-z0-9_-]{0,39}")  # lowercase letters, numbers, _ and -
IN_USE_NAME = "in_use.txt"
EMPTY_DATA = {"version": 1, "habits": [], "log": {}}


def valid_name(name):
	"""True for a usable data file name (without .json)."""
	return isinstance(name, str) and NAME_PATTERN.fullmatch(name) is not None


def looks_valid(data):
	"""A quick sanity check before saving: the page's data_format.js checks the details."""
	return (
		isinstance(data, dict)
		and isinstance(data.get("habits"), list)
		and all(isinstance(habit, dict) for habit in data["habits"])
		and isinstance(data.get("log"), dict)
	)


def data_text(data):
	"""The file's text: an empty first line, tab indentation and a final newline."""
	return "\n" + json.dumps(data, ensure_ascii=False, indent="\t") + "\n"


def write_atomically(path, text):
	"""Writes a temporary file first, then swaps it in."""
	temp = path.with_name(path.name + ".tmp")
	with temp.open("w", encoding="utf-8", newline="\n") as file:
		file.write(text)
		file.flush()
		os.fsync(file.fileno())
	os.replace(temp, path)


class DataFiles:
	"""The data files in one folder. Safe to use from several threads."""

	def __init__(self, folder):
		self.folder = Path(folder)
		self.lock = threading.Lock()

	def prepare(self, old_file=None):
		"""Makes the folder; moves an older single data file (e.g. ./habits.json) into it."""
		self.folder.mkdir(parents=True, exist_ok=True)
		old = Path(old_file) if old_file else None
		if old and old.exists() and not self.path(DEFAULT_NAME).exists():
			os.replace(old, self.path(DEFAULT_NAME))
			return True
		return False

	def path(self, name):
		if not valid_name(name):
			raise ValueError(f"Not a valid data file name: {name!r}")
		return self.folder / f"{name}.json"

	def names(self):
		"""The data files' names (without .json), sorted."""
		return sorted(path.stem for path in self.folder.glob("*.json") if valid_name(path.stem))

	def in_use(self):
		"""The data file in use (the default one if none is chosen yet)."""
		try:
			name = (self.folder / IN_USE_NAME).read_text(encoding="utf-8").strip()
		except OSError:
			name = ""
		return name if valid_name(name) else DEFAULT_NAME

	def read(self, name):
		"""A data file's contents, or an empty data set if it doesn't exist yet."""
		path = self.path(name)
		if not path.exists():
			return EMPTY_DATA
		with path.open(encoding="utf-8") as file:
			return json.load(file)

	def save(self, name, data):
		"""Saves `data` into file `name`, but only if that's still the file in use.

		Returns None if saved, or why not: 'invalid' or 'other-file' (a save meant
		for a file that isn't in use any more, e.g. from before switching).
		"""
		if not looks_valid(data):
			return "invalid"
		with self.lock:
			if name != self.in_use():
				return "other-file"
			write_atomically(self.path(name), data_text(data))
		return None

	def use(self, name, create=False):
		"""Switches to file `name` (making it, empty, if `create`). Returns a JSON answer."""
		if not valid_name(name):
			return {"ok": False, "reason": "invalid"}
		with self.lock:
			exists = self.path(name).exists()
			if create and exists:
				return {"ok": False, "reason": "exists"}
			if not create and not exists:
				return {"ok": False, "reason": "missing"}
			if create:
				write_atomically(self.path(name), data_text(EMPTY_DATA))
			write_atomically(self.folder / IN_USE_NAME, f"\n{name}\n")
		return {"ok": True, "name": name}

	def delete(self, name):
		"""Deletes file `name` for good (never the one in use). Returns a JSON answer."""
		if not valid_name(name):
			return {"ok": False, "reason": "invalid"}
		with self.lock:
			if name == self.in_use():
				return {"ok": False, "reason": "in-use"}
			path = self.path(name)
			if not path.exists():
				return {"ok": False, "reason": "missing"}
			path.unlink()
		return {"ok": True}
