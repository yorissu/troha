
"""The web API the page talks to (FastAPI). troha-client (Caddy) passes it every
request under /api; it isn't reachable from outside on its own.

	GET  /api/health                 {"ok": true} while the server (and its database) works

	Account (no license needed: an account whose license has ended can still use these):
	GET  /api/account                who's signed in (401 if nobody), with their license
	POST /api/account/register       {email, password}: a new account, with a free trial (once per email)
	POST /api/account/sign-in        {email, password}
	POST /api/account/sign-out
	POST /api/account/forgot         {email}: emails a link to set a new password
	POST /api/account/reset          {token, password}: the link's new password (signs in)
	POST /api/account/password       {current, password}
	POST /api/account/check-password {password}: before asking for more (e.g. a new PIN)
	POST /api/account/email          {password, email}: emails a link to the new address
	POST /api/account/email/confirm  {token}: the link from that email
	POST /api/account/currency       {currency}: what prices are shown and paid in
	POST /api/account/export         {password}: all of the account's data, as a file
	POST /api/account/delete         {password}

	License (no license needed, of course):
	GET  /api/license/prices         what days of license cost (see pricing.py)
	POST /api/license/redeem         {code}: a license code's days (negative ones take days off)
	POST /api/license/checkout       {days, currency}: pays for days ({url} of the payment page, or {paid})

	PIN, for hidden habits (license needed):
	POST /api/pin                    {pin}: sets the first PIN
	POST /api/pin/unlock             {pin}: shows hidden habits ({names: {id: name}, unlockSeconds})
	POST /api/pin/lock
	POST /api/pin/touch              keeps them shown while the page is in use ({unlocked, unlockSeconds})
	(How long they stay shown is decided here, in pin.py: unlockSeconds is what's left.)
	POST /api/pin/change             {password, pin}: a new PIN (also when it's forgotten)

	Habits, settings and log (license needed):
	GET  /api/data                   {version, data}
	PUT  /api/data                   {version, data}: saves; 409 if `version` is out of date

Answers are JSON. Problems are {"ok": false, "reason": "..."} with a fitting status.
Every change must be JSON from this site itself (see check_request), which with the
SameSite cookie keeps other sites from acting for a signed-in visitor.
"""

import logging
import os
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import Body, Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import accounts, licenses, payments, pin, pricing, user_data
from .crypto import Keys
from .database import connect, migrate
from .mailer import Mailer
from .rate_limit import RateLimiter
from .reminders import start_reminders
from .self_check import start_self_check
from .settings import load_settings


COOKIE = "troha_session"
COOKIE_DAYS = 400  # the longest browsers keep a cookie; the server ends idle sessions itself
MAX_BODY_BYTES = 2 * 1024 * 1024

log = logging.getLogger("troha")


class Problem(Exception):
	"""Answers the request with {"ok": false, "reason": reason, ...extra}."""

	def __init__(self, status, reason, **extra):
		super().__init__(reason)
		self.status = status
		self.reason = reason
		self.extra = extra


class Caller:
	"""Who's asking: their user row and session."""

	def __init__(self, user, session):
		self.user = user
		self.session = session

	@property
	def id(self):
		return self.user["id"]

	@property
	def token_hash(self):
		return self.session["token_hash"]


def create_app():
	"""The app, with its settings from the environment."""
	settings = load_settings()
	logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

	@asynccontextmanager
	async def lifespan(_app):
		ran = migrate(settings.db_path)
		if ran:
			log.info("Database updated (%d migration%s)", ran, "" if ran == 1 else "s")
		db = connect(settings.db_path)
		with db:
			accounts.remove_stale(db)
		db.close()
		if os.environ.get("TROHA_SELF_CHECK_URL"):
			start_self_check(os.environ["TROHA_SELF_CHECK_URL"])
		start_reminders(settings, app.state.mailer)
		yield

	app = FastAPI(title="Troha", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
	keys = Keys(settings.secret)
	limiter = RateLimiter()
	app.state.settings = settings
	app.state.mailer = Mailer(settings.smtp)
	payment_provider = payments.provider_for(settings.payments)

	# ---------- Plumbing ----------

	@app.exception_handler(Problem)
	async def problem_answer(_request, problem):
		return JSONResponse({"ok": False, "reason": problem.reason, **problem.extra}, status_code=problem.status)

	@app.exception_handler(RequestValidationError)
	async def invalid_answer(_request, _error):
		return JSONResponse({"ok": False, "reason": "invalid"}, status_code=400)

	@app.middleware("http")
	async def check_request(request, call_next):
		"""Changes only as JSON from this site, and not too large."""
		if request.method not in ("GET", "HEAD", "OPTIONS"):
			origin = request.headers.get("origin")
			if origin and urlsplit(origin).netloc != request.headers.get("host"):
				return JSONResponse({"ok": False, "reason": "origin"}, status_code=403)
			if not (request.headers.get("content-type") or "").startswith("application/json"):
				return JSONResponse({"ok": False, "reason": "json"}, status_code=415)
			try:
				length = int(request.headers.get("content-length") or 0)
			except ValueError:
				length = MAX_BODY_BYTES + 1
			if length > MAX_BODY_BYTES:
				return JSONResponse({"ok": False, "reason": "too-large"}, status_code=413)
		response = await call_next(request)
		response.headers["Cache-Control"] = "no-store"
		return response

	def database():
		db = connect(settings.db_path)
		try:
			yield db
		finally:
			db.close()

	def signed_in(request: Request, db=Depends(database)):
		"""The caller, if signed in (else 401). Keeps the session alive (not hidden habits' unlock: see /api/pin/touch)."""
		with db:
			session = accounts.find_session(db, request.cookies.get(COOKIE))
			if session is None:
				raise Problem(401, "signed-out")
			user = accounts.get_user(db, session["user_id"])
		return Caller(user, session)

	def licensed(caller=Depends(signed_in), db=Depends(database)):
		"""The caller, if their license is running (else 403 "license")."""
		if licenses.valid_until(db, caller.id) is None:
			raise Problem(403, "license")
		return caller

	def client_ip(request):
		return request.client.host if request.client else "unknown"

	def limit(kind, who):
		if not limiter.allow(kind, who):
			raise Problem(429, "too-many")

	def require_password(db, caller, password):
		limit("password:user", caller.id)
		if not accounts.password_matches(caller.user, password):
			raise Problem(403, "wrong-password")

	def sign_in(response, db, user_id):
		token = accounts.start_session(db, user_id)
		response.set_cookie(
			COOKIE, token, max_age=COOKIE_DAYS * 86400, httponly=True,
			secure=settings.secure_cookies, samesite="lax", path="/",
		)

	def about(db, user_id, session=None):
		"""Who's signed in, as the page gets it."""
		user = accounts.get_user(db, user_id)
		return {
			"ok": True,
			"email": user["email"],
			"currency": accounts.currency(user),
			"hasPin": pin.has_pin(user),
			"pinLength": pin.pin_length(keys, user),
			"pinWait": pin.wait_seconds(user),
			"unlocked": bool(session) and pin.is_unlocked(session),
			"license": licenses.describe(db, user_id),
		}

	def email_link(to, subject, intro, fragment, token, minutes):
		link = f"{settings.public_url}/#{fragment}={token}"
		lasts = f"{minutes // 60} hours" if minutes >= 120 else f"{minutes} minutes"
		app.state.mailer.send(to, subject, f"{intro}\n\n{link}\n\nThe link works once, for {lasts}. "
			"If you didn't ask for this, you can ignore this email.\n\nTroha")

	# ---------- Health ----------

	@app.get("/api/health")
	def health(db=Depends(database)):
		db.execute("SELECT 1").fetchone()
		return {"ok": True}

	# ---------- Account ----------

	@app.get("/api/account")
	def account(caller=Depends(signed_in), db=Depends(database)):
		return about(db, caller.id, caller.session)

	@app.post("/api/account/register")
	def register(request: Request, response: Response, body: dict = Body(...), db=Depends(database)):
		limit("register:ip", client_ip(request))
		email = accounts.normalize_email(body.get("email"))
		password = body.get("password")
		if email is None:
			raise Problem(400, "email")
		if not accounts.valid_password(password):
			raise Problem(400, "password", minLength=accounts.MIN_PASSWORD_LENGTH)
		with db:
			try:
				user_id = accounts.create_user(db, keys, email, password)
			except accounts.EmailTaken:
				raise Problem(409, "email-taken") from None
			user_data.create(db, user_id, accounts.data_key(keys, accounts.get_user(db, user_id)))
			licenses.start_trial(db, keys, user_id, email)
			sign_in(response, db, user_id)
		log.info("New account %d", user_id)
		return about(db, user_id)

	@app.post("/api/account/sign-in")
	def sign_in_route(request: Request, response: Response, body: dict = Body(...), db=Depends(database)):
		email = accounts.normalize_email(body.get("email"))
		limit("sign-in:ip", client_ip(request))
		limit("sign-in:email", email or "-")
		user = accounts.check_password(db, email, body.get("password"))
		if user is None:
			raise Problem(401, "wrong")
		limiter.reset("sign-in:email", email)
		with db:
			accounts.remove_stale(db)
			sign_in(response, db, user["id"])
		return about(db, user["id"])

	@app.post("/api/account/sign-out")
	def sign_out(request: Request, response: Response, db=Depends(database)):
		session = accounts.find_session(db, request.cookies.get(COOKIE))
		with db:
			if session is not None:
				accounts.end_session(db, session["token_hash"])
		response.delete_cookie(COOKIE, path="/")
		return {"ok": True}

	@app.post("/api/account/forgot")
	def forgot(request: Request, body: dict = Body(...), db=Depends(database)):
		"""Always answers ok, so nobody can find out whether an email has an account."""
		email = accounts.normalize_email(body.get("email"))
		limit("forgot:ip", client_ip(request))
		if email is None:
			raise Problem(400, "email")
		if not limiter.allow("email:to", email):
			return {"ok": True}
		with db:
			user = accounts.find_user(db, email)
			if user is not None:
				token = accounts.issue_link(db, keys, user["id"], "reset")
				email_link(email, "Set a new Troha password", "Open this link to set a new password for Troha:",
					"reset", token, accounts.LINK_MINUTES["reset"])
		return {"ok": True}

	@app.post("/api/account/reset")
	def reset(response: Response, body: dict = Body(...), db=Depends(database)):
		password = body.get("password")
		if not accounts.valid_password(password):
			raise Problem(400, "password", minLength=accounts.MIN_PASSWORD_LENGTH)
		with db:
			used = accounts.use_link(db, keys, body.get("token"), "reset")
			if used is None:
				raise Problem(400, "link")
			user_id = used[0]
			accounts.set_password(db, user_id, password)
			accounts.end_other_sessions(db, user_id)  # everywhere signed in with the old password
			sign_in(response, db, user_id)
		return about(db, user_id)

	@app.post("/api/account/password")
	def change_password(request: Request, body: dict = Body(...), caller=Depends(signed_in), db=Depends(database)):
		require_password(db, caller, body.get("current"))
		if not accounts.valid_password(body.get("password")):
			raise Problem(400, "password", minLength=accounts.MIN_PASSWORD_LENGTH)
		with db:
			accounts.set_password(db, caller.id, body["password"])
			accounts.end_other_sessions(db, caller.id, keep_token_hash=caller.token_hash)
		return {"ok": True}

	@app.post("/api/account/check-password")
	def check_password(body: dict = Body(...), caller=Depends(signed_in), db=Depends(database)):
		require_password(db, caller, body.get("password"))
		return {"ok": True}

	@app.post("/api/account/email")
	def change_email(body: dict = Body(...), caller=Depends(signed_in), db=Depends(database)):
		require_password(db, caller, body.get("password"))
		email = accounts.normalize_email(body.get("email"))
		if email is None:
			raise Problem(400, "email")
		if email == caller.user["email"]:
			raise Problem(400, "same-email")
		if accounts.find_user(db, email):
			raise Problem(409, "email-taken")
		limit("email:to", email)  # so nobody can flood an address with links
		with db:
			token = accounts.issue_link(db, keys, caller.id, "email", {"email": email})
		email_link(email, "Confirm your new Troha email", "Open this link to use this address for your Troha account:",
			"confirm-email", token, accounts.LINK_MINUTES["email"])
		return {"ok": True}

	@app.post("/api/account/email/confirm")
	def confirm_email(body: dict = Body(...), db=Depends(database)):
		with db:
			used = accounts.use_link(db, keys, body.get("token"), "email")
			if used is None:
				raise Problem(400, "link")
			user_id, payload = used
			old = accounts.get_user(db, user_id)["email"]
			try:
				accounts.set_email(db, user_id, payload["email"])
			except accounts.EmailTaken:
				raise Problem(409, "email-taken") from None
		app.state.mailer.send(old, "Your Troha email was changed",
			f"Your Troha account now uses {payload['email']} instead of this address.\n\n"
			"If that wasn't you, reply to whoever runs your Troha.\n\nTroha")
		return {"ok": True, "email": payload["email"]}

	@app.post("/api/account/currency")
	def change_currency(body: dict = Body(...), caller=Depends(signed_in), db=Depends(database)):
		if not pricing.is_currency(body.get("currency")):
			raise Problem(400, "currency")
		with db:
			accounts.set_currency(db, caller.id, body["currency"])
		return {"ok": True, "currency": body["currency"]}

	@app.post("/api/account/export")
	def export(body: dict = Body(...), caller=Depends(signed_in), db=Depends(database)):
		require_password(db, caller, body.get("password"))
		data = user_data.export(db, caller.id, accounts.data_key(keys, caller.user))
		return JSONResponse(
			{"email": caller.user["email"], **data},
			headers={"Content-Disposition": 'attachment; filename="troha_export.json"'},
		)

	@app.post("/api/account/delete")
	def delete_account(response: Response, body: dict = Body(...), caller=Depends(signed_in), db=Depends(database)):
		require_password(db, caller, body.get("password"))
		with db:
			licenses.remember_trial(db, keys, caller.user["email"])  # no second trial for this address
			accounts.delete_user(db, caller.id)
		response.delete_cookie(COOKIE, path="/")
		log.info("Deleted account %d", caller.id)
		return {"ok": True}

	# ---------- License ----------

	@app.get("/api/license/prices")
	def prices(_caller=Depends(signed_in)):
		return {"ok": True, "payments": payment_provider is not None, **pricing.describe()}

	@app.post("/api/license/redeem")
	def redeem(body: dict = Body(...), caller=Depends(signed_in), db=Depends(database)):
		limit("code:user", caller.id)
		with db:
			days = licenses.redeem_code(db, keys, caller.id, body.get("code"))
			if days is None:
				raise Problem(403, "code")
		log.info("Account %d used a license code (%+d days)", caller.id, days)
		return {**about(db, caller.id, caller.session), "days": days}

	@app.post("/api/license/checkout")
	def checkout(body: dict = Body(...), caller=Depends(signed_in), db=Depends(database)):
		limit("checkout:user", caller.id)
		try:
			answer = payments.start(db, payment_provider, caller.id, body.get("days"), body.get("currency"))
		except payments.PaymentsOff:
			raise Problem(503, "payments-off") from None
		except ValueError:
			raise Problem(400, "days", minDays=pricing.MIN_DAYS, maxDays=pricing.MAX_DAYS) from None
		return {"ok": True, **answer}

	# ---------- PIN ----------

	def unlocked_answer(db, caller):
		seconds = pin.unlock(db, caller.token_hash)
		names = user_data.hidden_names(db, caller.id, accounts.data_key(keys, caller.user))
		return {"ok": True, "names": names, "pinLength": pin.pin_length(keys, accounts.get_user(db, caller.id)),
			"unlockSeconds": seconds}

	@app.post("/api/pin")
	def set_first_pin(body: dict = Body(...), caller=Depends(licensed), db=Depends(database)):
		if pin.has_pin(caller.user):
			raise Problem(409, "has-pin")
		if not pin.valid_new_pin(body.get("pin")):
			raise Problem(400, "pin")
		with db:
			pin.set_pin(db, keys, caller.id, body["pin"])
			return unlocked_answer(db, caller)

	@app.post("/api/pin/unlock")
	def unlock(body: dict = Body(...), caller=Depends(licensed), db=Depends(database)):
		result = pin.check_pin(db, keys, caller.id, body.get("pin"))
		if result == "ok":
			with db:
				return unlocked_answer(db, caller)
		wait = pin.wait_seconds(accounts.get_user(db, caller.id))
		raise Problem(429 if result == "wait" else 403, "wait" if result == "wait" else result, wait=wait)

	@app.post("/api/pin/lock")
	def lock(caller=Depends(signed_in), db=Depends(database)):
		with db:
			pin.lock(db, caller.token_hash)
		return {"ok": True}

	@app.post("/api/pin/touch")
	def touch(caller=Depends(licensed), db=Depends(database)):
		"""The page is in use: hidden habits stay shown for another pin.UNLOCK_SECONDS (if they still are)."""
		if not pin.is_unlocked(caller.session):
			return {"ok": True, "unlocked": False}
		with db:
			seconds = pin.unlock(db, caller.token_hash)
		return {"ok": True, "unlocked": True, "unlockSeconds": seconds}

	@app.post("/api/pin/change")
	def change_pin(body: dict = Body(...), caller=Depends(licensed), db=Depends(database)):
		require_password(db, caller, body.get("password"))
		if not pin.valid_new_pin(body.get("pin")):
			raise Problem(400, "pin")
		with db:
			pin.set_pin(db, keys, caller.id, body["pin"])
			pin.lock_all(db, caller.id)  # other browsers need the new PIN
			return unlocked_answer(db, caller)

	# ---------- Data ----------

	@app.get("/api/data")
	def get_data(caller=Depends(licensed), db=Depends(database)):
		version, data = user_data.load(db, caller.id, accounts.data_key(keys, caller.user), pin.is_unlocked(caller.session))
		return {"ok": True, "version": version, "data": data}

	@app.put("/api/data")
	def put_data(body: dict = Body(...), caller=Depends(licensed), db=Depends(database)):
		version = body.get("version")
		if not isinstance(version, int) or isinstance(version, bool) or not isinstance(body.get("data"), dict):
			raise Problem(400, "invalid")
		try:
			with db:
				new_version = user_data.save(db, caller.id, accounts.data_key(keys, caller.user), version,
					body["data"], pin.is_unlocked(caller.session))
		except user_data.Conflict:
			raise Problem(409, "conflict") from None
		except user_data.Locked:
			raise Problem(403, "locked") from None
		return {"ok": True, "version": new_version}

	return app
