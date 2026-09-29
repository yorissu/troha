
"""The web server: serves ./web, and answers the page's requests:

	GET  /api/data            the data file in use (its name in the X-Troha-File header)
	PUT  /api/data            save it (the X-Troha-File header must name the file in use)
	GET  /api/files           the data files, and which one is in use
	POST /api/files           switch to one: {"name": ..., "create": true|false}
	POST /api/files/delete    delete one (never the one in use): {"name": ...}
	POST /api/clock           set the clock by hand: {"date": "YYYY-MM-DD", "time": "HH:MM"}
	POST /api/clock/sync      set the clock from the network
	GET  /api/display         whether the screen's backlight can be controlled
	POST /api/display         set it: {"brightness": 0.05-1, "on": true|false}

Only requests addressed to this computer are answered, and POSTs only from the
page itself (see Handler.read_json_body).
"""

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from . import clock, display
from .data_files import valid_name


FILE_HEADER = "X-Troha-File"
MAX_DATA_BYTES = 5 * 1024 * 1024
MAX_SMALL_BYTES = 1024


class Handler(SimpleHTTPRequestHandler):
	"""One request. `data_files`, `allowed_hosts` and `web_dir` are set by create_server()."""

	data_files = None
	allowed_hosts = frozenset()
	web_dir = None

	extensions_map = {
		**SimpleHTTPRequestHandler.extensions_map,
		".html": "text/html; charset=utf-8",
		".css": "text/css; charset=utf-8",
		".js": "text/javascript; charset=utf-8",
		".json": "application/json",
		".svg": "image/svg+xml",
		".ttf": "font/ttf",
	}

	def __init__(self, *args, **kwargs):
		super().__init__(*args, directory=str(self.web_dir), **kwargs)

	# ---------- Requests ----------

	def do_GET(self):
		if not self.host_allowed():
			return
		if self.path == "/api/data":
			self.get_data()
		elif self.path == "/api/files":
			self.send_json({"files": self.data_files.names(), "inUse": self.data_files.in_use()})
		elif self.path == "/api/display":
			self.send_json({"supported": display.supported()})
		elif self.path.startswith("/api/"):
			self.send_error(HTTPStatus.NOT_FOUND)
		else:
			super().do_GET()

	def do_HEAD(self):
		if self.host_allowed():
			super().do_HEAD()

	def do_PUT(self):
		if not self.host_allowed():
			return
		if self.path != "/api/data":
			self.send_error(HTTPStatus.NOT_FOUND)
			return
		data = self.read_json_body(MAX_DATA_BYTES)
		if data is None:
			return
		try:
			problem = self.data_files.save(self.headers.get(FILE_HEADER, ""), data)
		except (OSError, ValueError) as error:
			self.log_error("Could not save: %s", error)
			self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Could not write the data file")
			return
		if problem == "invalid":
			self.send_json({"ok": False, "reason": "invalid"}, status=HTTPStatus.BAD_REQUEST)
		elif problem:
			self.send_json({"ok": False, "reason": problem}, status=HTTPStatus.CONFLICT)
		else:
			self.send_json({"ok": True})

	def do_POST(self):
		if not self.host_allowed():
			return
		routes = {
			"/api/files": self.post_use_file,
			"/api/files/delete": self.post_delete_file,
			"/api/clock": self.post_set_clock,
			"/api/clock/sync": lambda body: self.send_json(clock.sync_clock()),
			"/api/display": self.post_set_display,
		}
		route = routes.get(self.path)
		if not route:
			self.send_error(HTTPStatus.NOT_FOUND)
			return
		body = self.read_json_body(MAX_SMALL_BYTES)
		if body is not None:
			route(body)

	# ---------- Answers ----------

	def get_data(self):
		name = self.data_files.in_use()
		try:
			data = self.data_files.read(name)
		except (OSError, ValueError) as error:
			self.log_error("Could not read %s.json: %s", name, error)
			self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Could not read the data file")
			return
		self.send_json(data, headers={FILE_HEADER: name})

	def post_use_file(self, body):
		name = body.get("name")
		if not valid_name(name):
			self.send_error(HTTPStatus.BAD_REQUEST, "Names use a-z, 0-9, _ and - (up to 40)")
			return
		self.send_json(self.data_files.use(name, create=body.get("create") is True))

	def post_delete_file(self, body):
		name = body.get("name")
		if not valid_name(name):
			self.send_error(HTTPStatus.BAD_REQUEST, "Names use a-z, 0-9, _ and - (up to 40)")
			return
		self.send_json(self.data_files.delete(name))

	def post_set_clock(self, body):
		date, clock_time = body.get("date"), body.get("time")
		if not clock.valid_date_time(date, clock_time):
			self.send_error(HTTPStatus.BAD_REQUEST, 'Expected {"date": "YYYY-MM-DD", "time": "HH:MM"}')
			return
		self.send_json(clock.set_clock(date, clock_time))

	def post_set_display(self, body):
		level, on = body.get("brightness"), body.get("on")
		if not display.valid_level(level) or not isinstance(on, bool):
			self.send_error(HTTPStatus.BAD_REQUEST, 'Expected {"brightness": 0.05-1, "on": true|false}')
			return
		self.send_json(display.set_backlight(level, on))

	# ---------- Helpers ----------

	def host_allowed(self):
		"""True for requests to this computer by name; anything else gets 403 (blocks DNS-rebinding tricks)."""
		if self.headers.get("Host") in self.allowed_hosts:
			return True
		self.send_error(HTTPStatus.FORBIDDEN)
		return False

	def read_json_body(self, max_bytes):
		"""The body as a JSON object, or None (after answering with an error).

		Only the page itself may send: JSON (which other sites can't send here without
		asking first), and from this server's own origin if an origin is given.
		"""
		origin = self.headers.get("Origin")
		allowed_origins = {f"http://{host}" for host in self.allowed_hosts}
		if not (self.headers.get("Content-Type") or "").startswith("application/json") or (origin and origin not in allowed_origins):
			self.send_error(HTTPStatus.FORBIDDEN)
			return None
		try:
			length = int(self.headers.get("Content-Length") or 0)
		except ValueError:
			length = -1
		if not 0 <= length <= max_bytes:
			self.send_error(HTTPStatus.BAD_REQUEST, "Missing or too large body")
			return None
		try:
			body = json.loads(self.rfile.read(length) or b"{}")
		except (ValueError, UnicodeDecodeError):
			body = None
		if not isinstance(body, dict):
			self.send_error(HTTPStatus.BAD_REQUEST, "Body is not a JSON object")
			return None
		return body

	def send_json(self, data, status=HTTPStatus.OK, headers=None):
		body = json.dumps(data, ensure_ascii=False).encode("utf-8")
		self.send_response(status)
		self.send_header("Content-Type", "application/json; charset=utf-8")
		self.send_header("Content-Length", str(len(body)))
		for name, value in (headers or {}).items():
			self.send_header(name, value)
		self.end_headers()
		self.wfile.write(body)

	def end_headers(self):
		# Always fetch fresh files, so changes to the page show up after a reload.
		self.send_header("Cache-Control", "no-store")
		super().end_headers()

	def list_directory(self, path):
		self.send_error(HTTPStatus.NOT_FOUND)
		return None

	def log_request(self, code="-", size="-"):
		pass  # keep the console quiet; errors are still printed


def create_server(host, port, data_files, web_dir):
	"""A server for `web_dir` and `data_files`, listening on host:port (not started yet)."""
	handler = type("TrohaHandler", (Handler,), {
		"data_files": data_files,
		"web_dir": web_dir,
		"allowed_hosts": frozenset({f"127.0.0.1:{port}", f"localhost:{port}"}),
	})
	return ThreadingHTTPServer((host, port), handler)
