
-- Email addresses that have had a free trial, kept after their account is deleted, so
-- signing up again with one gives no second trial. Only a keyed hash of each address
-- is kept (crypto.Keys.trials), never the address itself.
CREATE TABLE trials_used (
	email_hash BLOB PRIMARY KEY,
	created_at INTEGER NOT NULL
);
