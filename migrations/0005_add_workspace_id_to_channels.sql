ALTER TABLE channels ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX idx_channels_workspace ON channels(workspace_id);
