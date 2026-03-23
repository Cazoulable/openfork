-- Issue type enum
CREATE TYPE issue_type AS ENUM ('task', 'bug', 'feature', 'improvement');

-- Issue estimate enum (t-shirt sizing)
CREATE TYPE issue_estimate AS ENUM ('none', 'xs', 's', 'm', 'l', 'xl');

-- Add columns to issues
ALTER TABLE issues
  ADD COLUMN issue_type issue_type NOT NULL DEFAULT 'task',
  ADD COLUMN estimate issue_estimate NOT NULL DEFAULT 'none',
  ADD COLUMN due_date DATE;

-- Index for filtering
CREATE INDEX idx_issues_type ON issues(issue_type);
CREATE INDEX idx_issues_due_date ON issues(due_date);
