
"""Troha server: shows the page and keeps the data files.

It serves the files in ./web and keeps the data in ./data (see backend/). It only
listens on 127.0.0.1 (this computer) and never connects anywhere itself. It uses
the Python standard library only.

Run:   python3 server.py
Open:  http://127.0.0.1:8080

Settings, from the environment:
	TROHA_PORT       the port (default 8080)
	TROHA_DATA_DIR   the data folder (default ./data)
"""

import os
import sys
from pathlib import Path

from backend import display
from backend.data_files import DataFiles
from backend.http_handler import create_server


HOST = "127.0.0.1"
ROOT = Path(__file__).resolve().parent
WEB_DIR = ROOT / "web"
DEFAULT_DATA_DIR = ROOT / "data"
OLD_DATA_FILE = ROOT / "habits.json"  # where older versions kept the data


def main():
	try:
		port = int(os.environ.get("TROHA_PORT", "8080"))
	except ValueError:
		sys.exit("TROHA_PORT must be a number")
	data_dir = Path(os.environ.get("TROHA_DATA_DIR") or DEFAULT_DATA_DIR).resolve()
	if not WEB_DIR.is_dir():
		sys.exit(f"Can't find the web folder at {WEB_DIR}")

	data_files = DataFiles(data_dir)
	# Only the real data folder takes over an older ./habits.json.
	if data_files.prepare(OLD_DATA_FILE if data_dir == DEFAULT_DATA_DIR else None):
		print(f"Moved {OLD_DATA_FILE.name} into {data_dir}")

	# Full brightness to begin with: a screen left dark (e.g. by a crash) comes back on.
	# The page sets it as it should be once it's loaded.
	if display.supported():
		result = display.set_backlight(1, True)
		if not result["ok"]:
			print(f"Can't control the screen's backlight ({result['reason']}); the page will darken itself instead. See readme.md.")

	try:
		server = create_server(HOST, port, data_files, WEB_DIR)
	except OSError as error:
		sys.exit(f"Can't start on port {port} ({error}). Is Troha already running?")

	print(f"Troha is running at http://{HOST}:{port}  (Ctrl+C to stop), using {data_dir / data_files.in_use()}.json")
	sys.stdout.flush()
	try:
		server.serve_forever()
	except KeyboardInterrupt:
		pass
	finally:
		server.server_close()


if __name__ == "__main__":
	main()
