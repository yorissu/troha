
"""A user's habits, settings and log: sealed in the database with the user's own key.

The page loads and saves all of it at once (see data_format.py for its shape).
Every save carries the version it was based on; a save based on an older version
(e.g. from another device that changed things meanwhile) is turned away, so
nothing is overwritten unseen.

Hidden habits: until the session is unlocked with the PIN, their names are sent
as null, and they can't be changed, added or deleted (a save that tries is turned
away). Saves from a locked session get the names put back as they were.
"""

import json

from . import crypto, data_format


class Conflict(Exception):
	"""The save was based on an older version of the data."""


class Locked(Exception):
	"""A locked session tried to change a hidden habit."""


def create(db, user_id, key):
	"""A new user's data: no habits yet, the default settings."""
	data = data_format.default_data()
	db.execute(
		"INSERT INTO user_state (user_id, version, settings, log) VALUES (?, 1, ?, ?)",
		(user_id, _seal(key, data["settings"], f"settings:{user_id}"), _seal(key, data["log"], f"log:{user_id}")),
	)


def load(db, user_id, key, unlocked):
	"""@returns (version, data); hidden habits' names are None unless `unlocked`."""
	version, data = _read(db, user_id, key)
	if not unlocked:
		for habit in data["habits"]:
			if habit["hidden"]:
				habit["name"] = None
	return version, data


def hidden_names(db, user_id, key):
	"""The hidden habits' names: {id: name} (sent once the PIN unlocks them)."""
	return {habit["id"]: habit["name"] for habit in _read_habits(db, user_id, key) if habit["hidden"]}


def save(db, user_id, key, based_on, raw, unlocked):
	"""Replaces the user's data with `raw` (cleaned first). @returns the new version. Raises Conflict or Locked."""
	data = data_format.clean(raw)
	stored = {habit["id"]: habit for habit in _read_habits(db, user_id, key)}
	_keep_hidden(stored, data["habits"], unlocked)
	data["habits"] = [habit for habit in data["habits"] if habit["name"] is not None]  # nameless and nothing stored: drop

	cursor = db.execute(
		"UPDATE user_state SET version = version + 1, settings = ?, log = ? WHERE user_id = ? AND version = ?",
		(_seal(key, data["settings"], f"settings:{user_id}"), _seal(key, data["log"], f"log:{user_id}"), user_id, based_on),
	)
	if cursor.rowcount != 1:
		raise Conflict()
	db.execute("DELETE FROM habits WHERE user_id = ?", (user_id,))
	db.executemany(
		"INSERT INTO habits (user_id, id, position, payload) VALUES (?, ?, ?, ?)",
		[(user_id, habit["id"], position, _seal(key, _fields(habit), f"habit:{user_id}:{habit['id']}"))
		 for position, habit in enumerate(data["habits"])],
	)
	return based_on + 1


def export(db, user_id, key):
	"""Everything, hidden names too (for the account's "Download my data")."""
	return _read(db, user_id, key)[1]


def _keep_hidden(stored, habits, unlocked):
	"""Fills in hidden names the page doesn't have; while locked, turns away any change to hidden habits."""
	incoming = {habit["id"]: habit for habit in habits}
	for habit in habits:
		before = stored.get(habit["id"])
		if habit["name"] is None and before is not None:
			habit["name"] = before["name"]  # a hidden name the page wasn't given
		if not unlocked and (habit["hidden"] or (before and before["hidden"])) and before != habit:
			raise Locked()  # added, changed, shown or hidden without the PIN
	if not unlocked and any(habit["hidden"] and habit_id not in incoming for habit_id, habit in stored.items()):
		raise Locked()  # deleted without the PIN


def _read(db, user_id, key):
	state = db.execute("SELECT * FROM user_state WHERE user_id = ?", (user_id,)).fetchone()
	data = {
		"settings": _open(key, state["settings"], f"settings:{user_id}"),
		"habits": _read_habits(db, user_id, key),
		"log": _open(key, state["log"], f"log:{user_id}"),
	}
	return state["version"], data_format.clean(data)


def _read_habits(db, user_id, key):
	rows = db.execute("SELECT id, payload FROM habits WHERE user_id = ? ORDER BY position", (user_id,)).fetchall()
	return [{"id": row["id"], **_open(key, row["payload"], f"habit:{user_id}:{row['id']}")} for row in rows]


def _fields(habit):
	"""What's sealed for a habit: everything but its id (which is the row's key)."""
	return {name: value for name, value in habit.items() if name != "id"}


def _seal(key, value, context):
	return crypto.seal(key, json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), context)


def _open(key, sealed, context):
	return json.loads(crypto.open_sealed(key, sealed, context))
