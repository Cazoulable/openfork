-- Add profile fields to users: handle, first_name, middle_name, last_name
ALTER TABLE users
  ADD COLUMN handle VARCHAR(50),
  ADD COLUMN first_name VARCHAR(100),
  ADD COLUMN middle_name VARCHAR(100),
  ADD COLUMN last_name VARCHAR(100);

-- Populate handle from display_name for existing users (lowercase, alphanumeric + hyphens)
-- Append short id suffix to avoid duplicates
UPDATE users
SET handle = LOWER(REGEXP_REPLACE(display_name, '[^a-zA-Z0-9]+', '-', 'g'))
          || '-' || LEFT(id::text, 4)
WHERE handle IS NULL;

-- Make handle NOT NULL and UNIQUE after backfill
ALTER TABLE users ALTER COLUMN handle SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_handle_unique UNIQUE (handle);

-- Index for fast handle lookups
CREATE INDEX idx_users_handle ON users(handle);
