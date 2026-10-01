
-- Licenses become runs of days: every license has an end, and is extended by a free
-- trial (signing up), a license code (formerly an invite), a payment, or an admin.

-- Invite codes are now license codes: each gives the days it was made with.
ALTER TABLE invites RENAME TO license_codes;
UPDATE license_codes SET days = 36500 WHERE days IS NULL;
ALTER TABLE license_codes DROP COLUMN plan;

-- Each row is one extension; `source` says where it came from.
ALTER TABLE licenses RENAME COLUMN plan TO source;   -- 'trial', 'code', 'payment' or 'admin'
UPDATE licenses SET source = 'code' WHERE source = 'free';
UPDATE licenses SET ends_at = starts_at + 36500 * 86400 WHERE ends_at IS NULL;
ALTER TABLE licenses ADD COLUMN reference TEXT;      -- the payment it came from, if any

-- The license end an account was last warned about (so each warning goes out once).
ALTER TABLE users ADD COLUMN license_warned_until INTEGER;

-- Payments for days of license, from the start of checkout until paid.
CREATE TABLE payments (
	id TEXT PRIMARY KEY,                 -- the payment provider's id for it
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	days INTEGER NOT NULL,
	amount_cents INTEGER NOT NULL,
	currency TEXT NOT NULL,
	status TEXT NOT NULL,                -- 'open' or 'paid'
	created_at INTEGER NOT NULL
);
CREATE INDEX payments_by_user ON payments(user_id);
