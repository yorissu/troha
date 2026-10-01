
# Before going live

## Email (forgot password, changing the email address)

Right now no mail server is set up, so emails are only printed to the server's log (`docker compose logs troha-server`). Nobody receives them.

- [ ] Pick a sending provider (e.g. Postmark, Resend, Brevo or Amazon SES). Mail sent straight from a home connection lands in spam.
- [ ] Verify the sending domain with the provider: SPF, DKIM and DMARC records in the domain's DNS.
- [ ] Put its SMTP details in `.env`: `TROHA_SMTP_HOST`, `TROHA_SMTP_PORT`, `TROHA_SMTP_SECURITY`, `TROHA_SMTP_USER`, `TROHA_SMTP_PASSWORD`, `TROHA_SMTP_FROM` (e.g. `Troha <no-reply@example.com>`).
- [ ] Set `TROHA_PUBLIC_URL` to the real address, so the links in emails point there.
- [ ] Try it: Forgot password and Change email, from start to finish, with a real inbox (and check it isn't in spam).
- [ ] Decide what happens when sending fails: today it's only logged, and the page says "check your inbox" either way.

## Domain and HTTPS

- [ ] Buy the domain and point it at the server; forward ports 80 and 443.
- [ ] In `.env`: `TROHA_SITE_ADDRESS=<domain>`, `TROHA_HTTP_PORT=80`, `TROHA_HTTPS_PORT=443`, `TROHA_PUBLIC_URL=https://<domain>`, `TROHA_SECURE_COOKIES=true` (see readme.md).
- [ ] Check the certificate comes through, and that plain HTTP redirects to HTTPS.
- [ ] Never let real accounts use plain HTTP over the internet.

## Secrets and backups

- [ ] Keep a copy of `TROHA_SECRET_KEY` somewhere safe and apart from the server (a password manager). Without it the database can't be opened, backups included.
- [ ] Copy backups off the machine (the `troha_backups` volume lives on the same disk as the database).
- [ ] Try a restore once, from start to finish (readme.md: Restore a backup).
- [ ] Set `TZ` and `TROHA_BACKUP_HOUR` to when the backup should run.

## Server

- [ ] Keep the OS, Docker and the images up to date (`docker compose pull` for Caddy's base image, `docker compose up -d --build`).
- [ ] Rate limits are kept in memory: they start afresh when troha-server restarts. Fine for one server; revisit if there are ever more.
- [ ] Decide on logs: how long they're kept (Docker's log rotation), and that they hold no secrets.
- [ ] Watch it: something that says when troha-server is down for long (e.g. an uptime check on `/api/health` from outside).

## Accounts and licenses

- [ ] PayPal: make a PayPal business account and app (sandbox first), then add a PayPal provider in `server/troha_server/payments.py` (create the order, send the buyer to PayPal, capture it when they come back, and a webhook as a backstop). The fake provider shows the flow it has to fit.
- [ ] VAT: PayPal isn't a merchant of record, so EU VAT (OSS registration, rates per country, invoices) is yours to handle. Check with an accountant before charging anyone.
- [ ] Prices: `server/troha_server/pricing.py`, one list per currency, charged as shown (now EUR €0.50 a day for the first year, €0.10 up to 10 years, €0.01 after, with USD and GBP set roughly alike; at least 30 days). Set the real ones, and add or remove currencies there (the page follows; each needs a `currency_<code>` icon in `client/public/assets/icons/icons.svg`).
- [ ] Free trials: anyone can sign up for 7 free days, limited to 5 sign-ups a day per address. Consider confirming the email address on sign-up, so trials can't be farmed with made-up addresses.
- [ ] Automatic renewal (a PayPal subscription), if wanted later.
- [ ] Terms for refunds, and what happens to the data of accounts whose license ended long ago.
- [ ] A privacy note: what's stored (emails in plain text, everything else sealed), for how long, and how to delete it (Account -> Delete).
- [ ] Terms of use, if others will use it.

## Code

- [ ] Tests (planned for next week): the server's API (accounts, PIN, hidden habits, saves and conflicts), and the page's main flows.
- [ ] Try it on the real touchscreen: the on-screen keyboard (always on), screen dimming and going black, the waking tap.
