
"""Troha's server (troha-server): accounts, and each account's habits, kept encrypted.

Split by job:

settings      what can be set from the environment (see .env.example)
crypto        the server's keys, sealing data, hashing passwords, PINs and tokens
database      the SQLite file: connecting and bringing its tables up to date (migrations/)
data_format   the shape of a user's habits, settings and log, checked on the way in
accounts      users, sign-in sessions, and emailed links (password reset, new email)
pin           the PIN that shows hidden habits
licenses      licenses (runs of days) and license codes
pricing       what days of license cost
payments      paying for them, through a payment provider
user_data     a user's habits, settings and log: sealed in the database, hidden names withheld
reminders     emails that go out by themselves (the license warning)
mailer        sending email (or printing it, while no mail server is set up)
rate_limit    how often sign-ins and the like may be tried
app           the web API (FastAPI): the routes the page calls
backup        the nightly database copy (troha-backup)
self_check    ends the server if it's stuck, so Docker starts a fresh one
cli           admin commands: python -m troha_server --help
"""
