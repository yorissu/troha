
# Troha (TRacker Of HAbits)

A habit board with accounts. Three services, run with Docker Compose:

| Service | Folder | What it is |
| --- | --- | --- |
| `troha-client` | `client/` | The page (Svelte 5, built with Vite), served by Caddy, which also passes `/api` on to the server. The only way in from outside. |
| `troha-server` | `server/` | The API (Python, FastAPI) with the SQLite database (`troha.db` in the `troha_data` volume). Only on the internal network. |
| `troha-backup` | `server/` | The same image, copying the database every night into the `troha_backups` volume. |

Everything in the database except email addresses is sealed (AES-256-GCM, a key per account, wrapped with a key derived from `TROHA_SECRET_KEY`) or hashed (Argon2id for passwords and PINs, SHA-256 for tokens).

## Run

Needs Docker with Compose.

1. Copy `.env.example` to `.env`. Make a secret key and put it after `TROHA_SECRET_KEY=` (back it up; it must never change):
	```bash
	docker compose run --rm --no-deps troha-server python -m troha_server keygen
	```
2. Start (and, later, update):
	```bash
	docker compose up -d --build
	```
3. Open <http://localhost:8080> and sign up: a new account gets a 7-day free license. To give someone more days, make a license code (they enter it under Account -> License):
	```bash
	docker compose exec troha-server python -m troha_server code --days 365
	```

`docker compose logs -f` shows what the services say (including emails, until `TROHA_SMTP_*` is set). `docker compose down` stops them; the data stays in the volumes.

Admin commands: `docker compose exec troha-server python -m troha_server <command>`:
`code [--count N] [--days D]`, `users`, `grant EMAIL --days D`, `revoke EMAIL`, `delete-user EMAIL`, `backups`, `restore NAME`.

**Licenses** are runs of days: signing up gives 7, license codes and payments add more (to the end, so renewing early loses nothing). Without a running license an account can still sign in, but only to its Account and Notices views, to renew it (in the currency chosen there). Prices are in `server/troha_server/pricing.py`; paying is off until a payment provider is set up (`TROHA_PAYMENTS`; the dev stack uses `fake`, which "pays" at once). 5 days before a license ends, a warning email goes out and the Notices view shows a warning (its button gets a dot). License codes are stored only as keyed hashes (with `TROHA_SECRET_KEY`), so changing that key makes unused codes stop working.

**Restore a backup** (everything since it is lost):
```bash
docker compose stop troha-server
docker compose exec troha-backup python -m troha_server restore troha_2026-10-01.db
docker compose start troha-server
```

**HTTPS with a domain**: point the domain at this computer (forward ports 80 and 443), then in `.env` set `TROHA_SITE_ADDRESS=troha.example.com`, `TROHA_HTTP_PORT=80`, `TROHA_HTTPS_PORT=443`, `TROHA_PUBLIC_URL=https://troha.example.com`, `TROHA_SECURE_COOKIES=true`, and `docker compose up -d`. Caddy fetches and renews the certificate itself. Don't let others use plain HTTP over the internet.

## Develop

Everything in Docker, nothing to install but Docker (`compose.dev.yml`: its own database, no `.env` needed):
```bash
docker compose -f compose.dev.yml up --build                                # then open http://localhost:5173
docker compose -f compose.dev.yml exec troha-server python -m troha_server code --days 30   # sign-up needs none
```
The page reloads as you edit `client/`, the server restarts as you edit `server/troha_server/`. Emails (reset links) show up in `docker compose -f compose.dev.yml logs -f troha-server`. `docker compose -f compose.dev.yml down -v` throws the dev database away. (Set `COMPOSE_FILE=compose.dev.yml` in your shell to leave out the `-f`.)

Or the page outside Docker (it notices changes faster on Windows), with only the server in Docker (on port 8000):
```bash
docker compose -f compose.dev.yml up --build -d troha-server
cd client
npm install
npm run dev
```

The database's tables are made by the numbered scripts in `server/troha_server/migrations/`, run at startup. To change them, add the next script (never edit one that has run).

## Restarting

Add `-f compose.dev.yml` for the dev stack.

| What | Command |
| --- | --- |
| Restart everything | `docker compose restart` |
| Restart one service | `docker compose restart troha-server` (or `troha-client`, `troha-backup`) |
| After changing code: rebuild and restart what changed | `docker compose up -d --build` |
| Rebuild one service | `docker compose up -d --build troha-client` |
| Stop / start one service | `docker compose stop troha-server`, `docker compose start troha-server` |
| After changing `.env` | `docker compose up -d` (restart doesn't reread it) |
| See what's running | `docker compose ps` |
| Follow one service's log | `docker compose logs -f troha-server` |

## Layout

- `client/src/`: `app.svelte` (the whole page) and `main.js`; `components/` (one `.svelte` file each: markup, logic and styles; `keyboard/` is the on-screen keyboard); `controllers/` (what taps do; `app_controller.svelte.js` wires the board); `services/` (one of each for the whole page: clock, idle timer, toast, notices, confetti); `models/` (account, habits, PIN lock, talking to the API); `core/` (dates, schedules, taps); `styles/` (shared styles; colours in `tokens.css`); `config.js` and `messages.js` (tunables and wording).
- `client/caddyfile`, `client/dockerfile`: how the page is built and served.
- `server/troha_server/`: `app.py` (the API's routes), and one module per job (accounts, PIN, licenses, pricing, payments, reminders, user data, crypto, database, backup, admin commands in `cli.py`); each starts with what it does.
- `compose.yml`, `.env.example`: the services and their settings; `compose.dev.yml`: the same for developing.
- `todo.md`: what's left before going live.

Indentation is tabs, shown 4 wide; every file starts with an empty line.
