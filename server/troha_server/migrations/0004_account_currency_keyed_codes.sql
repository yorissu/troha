-- The currency prices are shown and paid in moves out of the sealed settings onto the
-- account itself, so it can be changed while the license isn't running (when the
-- settings can't be saved). Accounts start again from pricing.DEFAULT_CURRENCY.
ALTER TABLE users ADD COLUMN currency TEXT;

-- License codes are now hashed with a key derived from TROHA_SECRET_KEY
-- (crypto.Keys.codes), so a leaked database doesn't let anyone work them out. Unused
-- codes made before can't be checked any more: they go (make new ones).
DELETE FROM license_codes WHERE used_at IS NULL;
