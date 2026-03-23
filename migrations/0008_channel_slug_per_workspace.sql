-- Change channel slug uniqueness from global to per-workspace
ALTER TABLE channels DROP CONSTRAINT channels_slug_key;
ALTER TABLE channels ADD CONSTRAINT channels_workspace_slug_unique UNIQUE (workspace_id, slug);
