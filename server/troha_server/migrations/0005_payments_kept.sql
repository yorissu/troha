
-- Payments are kept when their account is deleted (they're needed for the books): the
-- account's id is cleared instead. SQLite can't change a foreign key in place, so the
-- table is made again.
CREATE TABLE payments_kept (
	id TEXT PRIMARY KEY,                 -- the payment provider's id for it
	user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL: its account was deleted
	days INTEGER NOT NULL,
	amount_cents INTEGER NOT NULL,
	currency TEXT NOT NULL,
	status TEXT NOT NULL,                -- 'open' or 'paid'
	created_at INTEGER NOT NULL
);
INSERT INTO payments_kept SELECT id, user_id, days, amount_cents, currency, status, created_at FROM payments;
DROP TABLE payments;
ALTER TABLE payments_kept RENAME TO payments;
CREATE INDEX payments_by_user ON payments(user_id);
