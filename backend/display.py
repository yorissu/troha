
"""The screen's backlight (Linux, e.g. a Raspberry Pi touch display).

Dims the backlight and switches it off and on, through /sys/class/backlight, so a
dimmed or "off" screen really gives off less light (and uses less power) instead
of only showing a darker page. Screens without a backlight there (most HDMI
monitors, or Windows while developing) aren't supported: the page then darkens
itself instead.

Writing needs permission, once: see pi/backlight_permission.rules.
"""

from pathlib import Path


BACKLIGHTS = Path("/sys/class/backlight")
# bl_power values: the backlight on, or powered down.
POWER_ON = "0"
POWER_OFF = "4"
LOWEST_LEVEL = 0.05  # dimmer than this, some panels switch off altogether


def find():
	"""The first backlight's folder (e.g. /sys/class/backlight/10-0045), or None."""
	try:
		folders = sorted(folder for folder in BACKLIGHTS.iterdir() if (folder / "brightness").exists())
	except OSError:
		return None
	return folders[0] if folders else None


def supported():
	"""True where there is a backlight to control."""
	return find() is not None


def valid_level(level):
	"""True for a brightness from LOWEST_LEVEL to 1 (a number, not true/false)."""
	return isinstance(level, (int, float)) and not isinstance(level, bool) and LOWEST_LEVEL <= level <= 1


def set_backlight(level, on):
	"""Sets the backlight to `level` of its full brightness (0.05 to 1), and on or off.

	Returns {"ok": True}, or {"ok": False, "reason": ...} with 'not-supported',
	'not-allowed' (the permission isn't installed) or 'failed'.
	"""
	folder = find()
	if folder is None:
		return {"ok": False, "reason": "not-supported"}
	try:
		full = int((folder / "max_brightness").read_text().strip())
		brightness = str(max(1, round(full * level)))
		power = folder / "bl_power"
		if power.exists():
			# Switched with bl_power, so the brightness is kept for waking up.
			if on:
				power.write_text(POWER_ON)
			(folder / "brightness").write_text(brightness)
			if not on:
				power.write_text(POWER_OFF)
		else:
			(folder / "brightness").write_text(brightness if on else "0")
	except PermissionError:
		return {"ok": False, "reason": "not-allowed"}
	except (OSError, ValueError):
		return {"ok": False, "reason": "failed"}
	return {"ok": True}
