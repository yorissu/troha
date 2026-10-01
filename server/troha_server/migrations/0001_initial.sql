
-- Troha's tables. Readable in the file: email addresses, ids and times. Everything
-- else is sealed (BLOB, see crypto.py) or hashed.

-- People with an account.
CREATE TABLE users (
	id INTEGER PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,          -- lowercase
	password_hash TEXT NOT NULL,         -- Argon2id
	data_key BLOB NOT NULL,              -- this user's own key, sealed with the server's
	pin BLOB,                            -- sealed {hash, length}; NULL: no PIN set yet
	pin_failures INTEGER NOT NULL DEFAULT 0,
	pin_locked_until INTEGER,            -- no PIN may be tried until then (unix seconds)
	created_at INTEGER NOT NULL
);

-- Signed-in browsers. The cookie holds the token; only its hash is kept here.
CREATE TABLE sessions (
	token_hash BLOB PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at INTEGER NOT NULL,
	last_used_at INTEGER NOT NULL,       -- signed out after accounts.IDLE_DAYS without use
	unlocked_until INTEGER               -- hidden habits are shown until then (after the PIN)
);
CREATE INDEX sessions_by_user ON sessions(user_id);

-- Links sent by email: resetting the password, confirming a new email address.
CREATE TABLE tokens (
	token_hash BLOB PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	purpose TEXT NOT NULL,               -- 'reset' or 'email'
	payload BLOB,                        -- sealed; for 'email', the new address
	expires_at INTEGER NOT NULL
);
CREATE INDEX tokens_by_user ON tokens(user_id);

-- Invite codes: each gives one new account its license. Only the code's hash is kept.
CREATE TABLE invites (
	code_hash BLOB PRIMARY KEY,
	plan TEXT NOT NULL,
	days INTEGER,                        -- how long the license lasts; NULL: no end
	created_at INTEGER NOT NULL,
	used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
	used_at INTEGER
);

-- Licenses: an account needs an active one to use Troha.
CREATE TABLE licenses (
	id INTEGER PRIMARY KEY,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	plan TEXT NOT NULL,                  -- 'free' for now
	status TEXT NOT NULL,                -- 'active' or 'revoked'
	starts_at INTEGER NOT NULL,
	ends_at INTEGER                      -- NULL: no end
);
CREATE INDEX licenses_by_user ON licenses(user_id);

-- Each user's habits, one row each, in their order. The payload (name, days, repeat,
-- start and end dates, hidden, priority, colour) is sealed with the user's key.
CREATE TABLE habits (
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	id TEXT NOT NULL,
	position INTEGER NOT NULL,
	payload BLOB NOT NULL,
	PRIMARY KEY (user_id, id)
);

-- The rest of each user's data: settings and the daily log, both sealed. `version`
-- goes up with every save, so a save based on older data is turned away.
CREATE TABLE user_state (
	user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	version INTEGER NOT NULL,
	settings BLOB NOT NULL,
	log BLOB NOT NULL
);
