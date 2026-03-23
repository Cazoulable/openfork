-- Create junction table for multiple assignees per issue
CREATE TABLE issue_assignees (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (issue_id, user_id)
);

CREATE INDEX idx_issue_assignees_user ON issue_assignees(user_id);

-- Migrate existing single-assignee data
INSERT INTO issue_assignees (issue_id, user_id)
SELECT id, assignee_id FROM issues WHERE assignee_id IS NOT NULL;

-- Drop old column
ALTER TABLE issues DROP COLUMN assignee_id;

-- Drop old index (it was on the now-removed column)
DROP INDEX IF EXISTS idx_issues_assignee;
