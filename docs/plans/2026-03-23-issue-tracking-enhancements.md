# Issue Tracking Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade issue tracking to match Linear/Jira basics — add issue type, estimate, due date fields; wire up assignee picker using existing workspace members API; add kanban board view; enable filtering on all properties.

**Architecture:** New DB columns on `issues` table via migration. Backend models/handlers extended with new fields. Frontend gets assignee picker (fed by existing `listMembers` API), new field controls in all forms, enhanced filters bar, and a kanban board component toggled on the project detail page.

**Tech Stack:** Rust/Axum/SQLx (backend), React/TypeScript/Tailwind (frontend), PostgreSQL enums + nullable columns (DB).

---

### Task 1: Database Migration — Add new issue columns

**Files:**
- Create: `migrations/0010_issue_enhancements.sql`

**Step 1: Write the migration**

```sql
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
```

**Step 2: Verify migration applies**

Run: `sqlx migrate run` (or however the project runs migrations)
Expected: Migration 0010 applied successfully.

**Step 3: Commit**

```bash
git add migrations/0010_issue_enhancements.sql
git commit -m "feat: add issue_type, estimate, due_date columns to issues"
```

---

### Task 2: Backend Models — Add new enums and fields

**Files:**
- Modify: `modules/project-tracking/src/models.rs`

**Step 1: Add new enums after existing `IssuePriority` enum**

Add these two enums:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "issue_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IssueType {
    Task,
    Bug,
    Feature,
    Improvement,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "issue_estimate", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IssueEstimate {
    None,
    Xs,
    S,
    M,
    L,
    Xl,
}
```

**Step 2: Add fields to `Issue` struct**

Add these three fields (after `priority`, before `assignee_id`):

```rust
pub issue_type: IssueType,
pub estimate: IssueEstimate,
pub due_date: Option<chrono::NaiveDate>,
```

**Step 3: Add fields to `CreateIssueRequest`**

```rust
pub issue_type: Option<IssueType>,
pub estimate: Option<IssueEstimate>,
pub due_date: Option<chrono::NaiveDate>,
```

**Step 4: Add fields to `UpdateIssueRequest`**

```rust
pub issue_type: Option<IssueType>,
pub estimate: Option<IssueEstimate>,
pub due_date: Option<Option<chrono::NaiveDate>>,  // Option<Option<>> to distinguish "not sent" from "set to null"
```

Note: For `due_date` on update, use `Option<Option<NaiveDate>>` so the client can explicitly clear it by sending `null`. For simplicity, we can use `Option<NaiveDate>` and rely on the COALESCE pattern (meaning you can't clear it once set). Use the simpler approach:

```rust
pub due_date: Option<chrono::NaiveDate>,
```

And add a separate `clear_due_date: Option<bool>` field:

```rust
pub clear_due_date: Option<bool>,
```

Actually, keep it simple: just use `Option<NaiveDate>`. To clear a due date, the frontend sends the field as `null`. The update handler should check: if the field is `Some(date)` set it, if the JSON key is present with value `null` clear it, if the key is absent leave unchanged. The simplest approach with serde:

```rust
#[serde(default, deserialize_with = "deserialize_optional_field")]
pub due_date: Option<Option<chrono::NaiveDate>>,
```

For simplicity, just use `Option<NaiveDate>` and handle clearing via a special update SQL. If `due_date` is `None` in the request, leave unchanged. To clear, send `"due_date": null`. We need `#[serde(default)]` on the field:

Final approach — keep all update fields as `Option<T>` for consistency:

```rust
pub due_date: Option<chrono::NaiveDate>,
```

And handle the update SQL with COALESCE like existing fields. This means once a due_date is set, it can be changed but not cleared via this endpoint. That's acceptable for MVP. If clearing is needed later, add a dedicated endpoint or a `clear_fields` parameter.

**Step 5: Add fields to `IssueFilters`**

```rust
pub issue_type: Option<IssueType>,
pub estimate: Option<IssueEstimate>,
```

**Step 6: Verify it compiles**

Run: `cargo check -p openfork-project-tracking`
Expected: Compilation errors in handlers (expected — we haven't updated SQL yet).

**Step 7: Commit**

```bash
git add modules/project-tracking/src/models.rs
git commit -m "feat: add IssueType, IssueEstimate enums and new fields to models"
```

---

### Task 3: Backend Handlers — Update issue CRUD SQL

**Files:**
- Modify: `modules/project-tracking/src/handlers/issues.rs`

**Step 1: Update `create_issue` function**

Change the INSERT SQL to include new columns:

```rust
let issue = sqlx::query_as::<_, Issue>(
    "INSERT INTO issues (id, project_id, title, description, status, priority, issue_type, estimate, due_date, assignee_id, creator_id) \
     VALUES ($1, $2, $3, $4, COALESCE($5, 'backlog'), COALESCE($6, 'none'), COALESCE($7, 'task'), COALESCE($8, 'none'), $9, $10, $11) RETURNING *"
)
.bind(id)
.bind(project_id)
.bind(&req.title)
.bind(&req.description)
.bind(&req.status)
.bind(&req.priority)
.bind(&req.issue_type)
.bind(&req.estimate)
.bind(&req.due_date)
.bind(&req.assignee_id)
.bind(user.0.sub)
.fetch_one(state.db.pool())
.await
.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?;
```

**Step 2: Update `update_issue` function**

Change the UPDATE SQL to include new columns:

```rust
let issue = sqlx::query_as::<_, Issue>(
    "UPDATE issues SET \
     title = COALESCE($2, title), \
     description = COALESCE($3, description), \
     status = COALESCE($4, status), \
     priority = COALESCE($5, priority), \
     issue_type = COALESCE($6, issue_type), \
     estimate = COALESCE($7, estimate), \
     due_date = COALESCE($8, due_date), \
     assignee_id = COALESCE($9, assignee_id), \
     updated_at = now() \
     WHERE id = $1 RETURNING *"
)
.bind(id)
.bind(&req.title)
.bind(&req.description)
.bind(&req.status)
.bind(&req.priority)
.bind(&req.issue_type)
.bind(&req.estimate)
.bind(&req.due_date)
.bind(&req.assignee_id)
.fetch_optional(state.db.pool())
.await
.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))))?
.ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({"error": "issue not found"}))))?;
```

**Step 3: Update `list_issues` filter builder**

Add filter clauses for `issue_type` and `estimate` after the existing filter block:

```rust
if filters.issue_type.is_some() {
    query.push_str(&format!(" AND issue_type = ${param_idx}"));
    param_idx += 1;
}
if filters.estimate.is_some() {
    query.push_str(&format!(" AND estimate = ${param_idx}"));
    param_idx += 1;
}
```

And bind them after the existing binds:

```rust
if let Some(ref issue_type) = filters.issue_type {
    q = q.bind(issue_type);
}
if let Some(ref estimate) = filters.estimate {
    q = q.bind(estimate);
}
```

**Step 4: Verify it compiles**

Run: `cargo check -p openfork-project-tracking`
Expected: Compiles successfully.

**Step 5: Commit**

```bash
git add modules/project-tracking/src/handlers/issues.rs
git commit -m "feat: update issue handlers for type, estimate, due_date fields"
```

---

### Task 4: Frontend API Types — Add new fields

**Files:**
- Modify: `frontend/src/api/projects.ts`

**Step 1: Add new TypeScript types**

After the existing `IssuePriority` type:

```typescript
export type IssueType = "task" | "bug" | "feature" | "improvement";
export type IssueEstimate = "none" | "xs" | "s" | "m" | "l" | "xl";
```

**Step 2: Update `Issue` interface**

Add after `priority`:

```typescript
issue_type: IssueType;
estimate: IssueEstimate;
due_date: string | null;
```

**Step 3: Update `CreateIssuePayload`**

Add:

```typescript
issue_type?: IssueType;
estimate?: IssueEstimate;
due_date?: string;
assignee_id?: string;
```

(Note: `assignee_id` already exists in the type but verify it's there.)

**Step 4: Update `UpdateIssuePayload`**

Add:

```typescript
issue_type?: IssueType;
estimate?: IssueEstimate;
due_date?: string | null;
```

**Step 5: Update `ListIssuesFilters`**

Add:

```typescript
issue_type?: IssueType;
estimate?: IssueEstimate;
```

**Step 6: Update `listIssues` function**

In the query params builder, add:

```typescript
if (filters?.issue_type) params.set("issue_type", filters.issue_type);
if (filters?.estimate) params.set("estimate", filters.estimate);
```

**Step 7: Commit**

```bash
git add frontend/src/api/projects.ts
git commit -m "feat: add issue_type, estimate, due_date to frontend API types"
```

---

### Task 5: Frontend — Assignee Picker + Enhanced Create/Edit Modals

**Files:**
- Modify: `frontend/src/components/projects/ProjectDetailPage.tsx`
- Modify: `frontend/src/components/projects/IssueDetailPage.tsx`

This task wires up workspace members for the assignee picker and adds the new fields to create/edit modals.

**Step 1: Update ProjectDetailPage — import members API and add state**

Add import:

```typescript
import { listMembers, type WorkspaceMemberInfo } from '../../api/workspaces';
import { useAuthStore } from '../../stores/auth';
```

Add state:

```typescript
const currentUser = useAuthStore((s) => s.user);
const [members, setMembers] = useState<WorkspaceMemberInfo[]>([]);
```

Add new create-issue form fields:

```typescript
const [issueType, setIssueType] = useState<IssueType>('task');
const [issueEstimate, setIssueEstimate] = useState<IssueEstimate>('none');
const [issueDueDate, setIssueDueDate] = useState('');
const [issueAssignee, setIssueAssignee] = useState('');
```

**Step 2: Fetch members on mount**

In the effect that fetches labels, also fetch members:

```typescript
useEffect(() => {
  if (!projectId || loading) return;
  const wsId = project?.workspace_id;
  if (!wsId) return;
  Promise.all([
    listLabels(projectId).catch(() => []),
    listMembers(wsId).catch(() => []),
  ]).then(([labelsData, membersData]) => {
    setLabels(labelsData);
    setMembers(membersData);
  });
}, [projectId, loading, project?.workspace_id]);
```

Replace the existing labels-only fetch effect.

**Step 3: Update create issue handler**

Pass new fields to `createIssue`:

```typescript
const issue = await createIssue(projectId, {
  title: issueTitle.trim(),
  description: issueDesc.trim() || undefined,
  status: issueStatus,
  priority: issuePriority,
  issue_type: issueType,
  estimate: issueEstimate,
  due_date: issueDueDate || undefined,
  assignee_id: issueAssignee || undefined,
});
```

Reset new fields after create:

```typescript
setIssueType('task');
setIssueEstimate('none');
setIssueDueDate('');
setIssueAssignee('');
```

**Step 4: Update create issue modal form**

After the existing status/priority grid, add a second row:

```tsx
<div className="grid grid-cols-2 gap-4">
  <Select
    label="Type"
    value={issueType}
    onChange={(e) => setIssueType(e.target.value as IssueType)}
  >
    <option value="task">Task</option>
    <option value="bug">Bug</option>
    <option value="feature">Feature</option>
    <option value="improvement">Improvement</option>
  </Select>
  <Select
    label="Estimate"
    value={issueEstimate}
    onChange={(e) => setIssueEstimate(e.target.value as IssueEstimate)}
  >
    <option value="none">No Estimate</option>
    <option value="xs">XS</option>
    <option value="s">S</option>
    <option value="m">M</option>
    <option value="l">L</option>
    <option value="xl">XL</option>
  </Select>
</div>
<div className="grid grid-cols-2 gap-4">
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-text-secondary">Due Date</label>
    <input
      type="date"
      className="w-full rounded-lg border border-border bg-bg-tertiary px-3.5 py-2.5 text-sm text-text-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
      value={issueDueDate}
      onChange={(e) => setIssueDueDate(e.target.value)}
    />
  </div>
  <Select
    label="Assignee"
    value={issueAssignee}
    onChange={(e) => setIssueAssignee(e.target.value)}
  >
    <option value="">Unassigned</option>
    {members.map((m) => (
      <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
    ))}
  </Select>
</div>
```

**Step 5: Update filter bar — add type and assignee filters**

Add filter state:

```typescript
const [filterType, setFilterType] = useState<IssueType | ''>('');
const [filterAssignee, setFilterAssignee] = useState('');
```

Add to filter constants at top of file:

```typescript
const TYPE_OPTIONS: { value: IssueType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'improvement', label: 'Improvement' },
];
```

Update the filters effect to include new filters:

```typescript
if (filterType) filters.issue_type = filterType;
if (filterAssignee) filters.assignee_id = filterAssignee;
```

Add filter dropdowns in the filter bar (after existing priority filter):

```tsx
<Select
  value={filterType}
  onChange={(e) => setFilterType(e.target.value as IssueType | '')}
  wrapperClassName="w-36"
>
  {TYPE_OPTIONS.map((opt) => (
    <option key={opt.value} value={opt.value}>{opt.label}</option>
  ))}
</Select>
<Select
  value={filterAssignee}
  onChange={(e) => setFilterAssignee(e.target.value)}
  wrapperClassName="w-40"
>
  <option value="">All assignees</option>
  {members.map((m) => (
    <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
  ))}
</Select>
```

Update clear filters logic to include new filters:

```typescript
{(filterStatus || filterPriority || filterType || filterAssignee) && (
  <Button size="sm" variant="ghost" onClick={() => {
    setFilterStatus('');
    setFilterPriority('');
    setFilterType('');
    setFilterAssignee('');
  }}>
    Clear filters
  </Button>
)}
```

**Step 6: Pass members data to IssueRow**

Build a userNames map and pass it:

```tsx
const userNames = Object.fromEntries(members.map((m) => [m.user_id, m.display_name]));
```

Pass to IssueRow:

```tsx
<IssueRow key={issue.id} issue={issue} userNames={userNames} />
```

**Step 7: Commit**

```bash
git add frontend/src/components/projects/ProjectDetailPage.tsx
git commit -m "feat: add type, estimate, due date, assignee to create issue + filters"
```

---

### Task 6: Frontend — Update IssueDetailPage sidebar with new fields

**Files:**
- Modify: `frontend/src/components/projects/IssueDetailPage.tsx`

**Step 1: Import members API and add type imports**

Add to imports from `../../api/projects`:

```typescript
type IssueType,
type IssueEstimate,
```

Add:

```typescript
import { listMembers, type WorkspaceMemberInfo } from '../../api/workspaces';
```

**Step 2: Add state for members**

```typescript
const [members, setMembers] = useState<WorkspaceMemberInfo[]>([]);
```

**Step 3: Fetch members when issue loads**

In the issue fetch effect, after loading comments and labels, also fetch members. The issue has `project_id` and we need the workspace_id. We need to look it up. The simplest approach: fetch project to get workspace_id, then fetch members.

Actually, the workspace ID is available from the workspace store:

```typescript
const wsId = useWorkspaceStore((s) => s.currentWorkspace?.id);
```

Add members fetch alongside comments and labels:

```typescript
const [commentsData, labelsData, membersData] = await Promise.all([
  listComments(issueData.id),
  listLabels(issueData.project_id),
  wsId ? listMembers(wsId).catch(() => []) : Promise.resolve([]),
]);
setMembers(membersData);
```

**Step 4: Add inline change handlers for new fields**

```typescript
const handleTypeChange = async (issue_type: IssueType) => {
  if (!issue) return;
  try {
    const updated = await updateIssue(issue.id, { issue_type });
    setIssue(updated);
  } catch { /* ignore */ }
};

const handleEstimateChange = async (estimate: IssueEstimate) => {
  if (!issue) return;
  try {
    const updated = await updateIssue(issue.id, { estimate });
    setIssue(updated);
  } catch { /* ignore */ }
};

const handleAssigneeChange = async (assignee_id: string) => {
  if (!issue) return;
  try {
    const updated = await updateIssue(issue.id, { assignee_id: assignee_id || undefined });
    setIssue(updated);
  } catch { /* ignore */ }
};

const handleDueDateChange = async (due_date: string) => {
  if (!issue) return;
  try {
    const updated = await updateIssue(issue.id, { due_date: due_date || undefined });
    setIssue(updated);
  } catch { /* ignore */ }
};
```

**Step 5: Update sidebar — add Type dropdown (after Priority)**

```tsx
{/* Type */}
<div className="flex flex-col gap-1.5">
  <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Type</span>
  <Select
    value={issue.issue_type}
    onChange={(e) => handleTypeChange(e.target.value as IssueType)}
  >
    <option value="task">Task</option>
    <option value="bug">Bug</option>
    <option value="feature">Feature</option>
    <option value="improvement">Improvement</option>
  </Select>
</div>
```

**Step 6: Update sidebar — add Estimate dropdown**

```tsx
{/* Estimate */}
<div className="flex flex-col gap-1.5">
  <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Estimate</span>
  <Select
    value={issue.estimate}
    onChange={(e) => handleEstimateChange(e.target.value as IssueEstimate)}
  >
    <option value="none">No Estimate</option>
    <option value="xs">XS</option>
    <option value="s">S</option>
    <option value="m">M</option>
    <option value="l">L</option>
    <option value="xl">XL</option>
  </Select>
</div>
```

**Step 7: Replace static Assignee display with dropdown**

Replace the existing Assignee `<div>` with:

```tsx
{/* Assignee */}
<div className="flex flex-col gap-1.5">
  <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Assignee</span>
  <Select
    value={issue.assignee_id ?? ''}
    onChange={(e) => handleAssigneeChange(e.target.value)}
  >
    <option value="">Unassigned</option>
    {members.map((m) => (
      <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
    ))}
  </Select>
</div>
```

**Step 8: Add Due Date field in sidebar (before Labels)**

```tsx
{/* Due Date */}
<div className="flex flex-col gap-1.5">
  <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Due Date</span>
  <input
    type="date"
    className="w-full rounded-lg border border-border bg-bg-tertiary px-3.5 py-2.5 text-sm text-text-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
    value={issue.due_date ?? ''}
    onChange={(e) => handleDueDateChange(e.target.value)}
  />
</div>
```

**Step 9: Update edit modal — add new fields**

Add form state for new fields in `openEditModal`:

```typescript
const [editType, setEditType] = useState<IssueType>('task');
const [editEstimate, setEditEstimate] = useState<IssueEstimate>('none');
const [editDueDate, setEditDueDate] = useState('');
const [editAssignee, setEditAssignee] = useState('');
```

Initialize in `openEditModal`:

```typescript
setEditType(issue.issue_type);
setEditEstimate(issue.estimate);
setEditDueDate(issue.due_date ?? '');
setEditAssignee(issue.assignee_id ?? '');
```

Pass to `updateIssue` in `handleEditIssue`:

```typescript
const updated = await updateIssue(issue.id, {
  title: editTitle.trim() || undefined,
  description: editDesc.trim(),
  status: editStatus,
  priority: editPriority,
  issue_type: editType,
  estimate: editEstimate,
  due_date: editDueDate || undefined,
  assignee_id: editAssignee || undefined,
});
```

Add form fields in the edit modal (after existing status/priority grid):

```tsx
<div className="grid grid-cols-2 gap-4">
  <Select label="Type" value={editType} onChange={(e) => setEditType(e.target.value as IssueType)}>
    <option value="task">Task</option>
    <option value="bug">Bug</option>
    <option value="feature">Feature</option>
    <option value="improvement">Improvement</option>
  </Select>
  <Select label="Estimate" value={editEstimate} onChange={(e) => setEditEstimate(e.target.value as IssueEstimate)}>
    <option value="none">No Estimate</option>
    <option value="xs">XS</option>
    <option value="s">S</option>
    <option value="m">M</option>
    <option value="l">L</option>
    <option value="xl">XL</option>
  </Select>
</div>
<div className="grid grid-cols-2 gap-4">
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-text-secondary">Due Date</label>
    <input
      type="date"
      className="w-full rounded-lg border border-border bg-bg-tertiary px-3.5 py-2.5 text-sm text-text-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
      value={editDueDate}
      onChange={(e) => setEditDueDate(e.target.value)}
    />
  </div>
  <Select label="Assignee" value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)}>
    <option value="">Unassigned</option>
    {members.map((m) => (
      <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
    ))}
  </Select>
</div>
```

**Step 10: Add TypeBadge display in issue header**

In the issue header badges row, add type badge:

```tsx
<div className="flex items-center gap-3">
  <StatusBadge status={issue.status} />
  <PriorityBadge priority={issue.priority} />
  <Badge>{issue.issue_type}</Badge>
  {issue.estimate !== 'none' && <Badge>{issue.estimate.toUpperCase()}</Badge>}
  <span className="text-xs font-mono text-text-muted">{issue.issue_number}</span>
</div>
```

**Step 11: Commit**

```bash
git add frontend/src/components/projects/IssueDetailPage.tsx
git commit -m "feat: add type, estimate, due date, assignee picker to issue detail"
```

---

### Task 7: Frontend — Update IssueRow with type indicator

**Files:**
- Modify: `frontend/src/components/projects/IssueRow.tsx`

**Step 1: Add type icon mapping**

Import icons and add a helper:

```typescript
import { Bug, Lightbulb, Wrench, CheckSquare } from 'lucide-react';
import type { IssueType } from '../../api/projects';

const TYPE_ICONS: Record<IssueType, React.ReactNode> = {
  task: <CheckSquare className="h-3.5 w-3.5 text-text-muted" />,
  bug: <Bug className="h-3.5 w-3.5 text-danger" />,
  feature: <Lightbulb className="h-3.5 w-3.5 text-warning" />,
  improvement: <Wrench className="h-3.5 w-3.5 text-accent" />,
};
```

**Step 2: Add type icon to the row**

Before the issue number:

```tsx
<div className="w-6 shrink-0 flex justify-center" title={issue.issue_type}>
  {TYPE_ICONS[issue.issue_type]}
</div>
```

**Step 3: Update ProjectDetailPage list header**

Add a column header for type before ID:

```tsx
<span className="w-6 shrink-0" />
```

**Step 4: Commit**

```bash
git add frontend/src/components/projects/IssueRow.tsx
git commit -m "feat: show issue type icon in issue list rows"
```

---

### Task 8: Frontend — Kanban Board View

**Files:**
- Create: `frontend/src/components/projects/KanbanBoard.tsx`
- Modify: `frontend/src/components/projects/ProjectDetailPage.tsx`

**Step 1: Create KanbanBoard component**

The board shows issues grouped by status in columns. Each column is a status (Backlog, Todo, In Progress, Done, Cancelled). Cards show title, priority badge, type icon, assignee avatar, and estimate.

Clicking a card navigates to the issue detail page. Each column header shows count. No drag-and-drop for MVP — instead, each card has a status dropdown to move between columns.

```tsx
// frontend/src/components/projects/KanbanBoard.tsx

import { useNavigate } from 'react-router-dom';
import { PriorityBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Bug, Lightbulb, Wrench, CheckSquare } from 'lucide-react';
import type { Issue, IssueStatus, IssueType } from '../../api/projects';
import { updateIssue } from '../../api/projects';
import { useWorkspaceStore } from '../../stores/workspace';

const COLUMNS: { status: IssueStatus; label: string; color: string }[] = [
  { status: 'backlog', label: 'Backlog', color: 'bg-gray-400' },
  { status: 'todo', label: 'Todo', color: 'bg-blue-400' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-yellow-400' },
  { status: 'done', label: 'Done', color: 'bg-green-400' },
  { status: 'cancelled', label: 'Cancelled', color: 'bg-red-400' },
];

const TYPE_ICONS: Record<IssueType, React.ReactNode> = {
  task: <CheckSquare className="h-3 w-3 text-text-muted" />,
  bug: <Bug className="h-3 w-3 text-danger" />,
  feature: <Lightbulb className="h-3 w-3 text-warning" />,
  improvement: <Wrench className="h-3 w-3 text-accent" />,
};

interface KanbanBoardProps {
  issues: Issue[];
  userNames?: Record<string, string>;
  onIssueUpdated: (updated: Issue) => void;
}

export function KanbanBoard({ issues, userNames, onIssueUpdated }: KanbanBoardProps) {
  const navigate = useNavigate();
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspace?.slug);

  const handleStatusChange = async (issueId: string, status: IssueStatus) => {
    try {
      const updated = await updateIssue(issueId, { status });
      onIssueUpdated(updated);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto p-4">
      {COLUMNS.map((col) => {
        const colIssues = issues.filter((i) => i.status === col.status);
        return (
          <div key={col.status} className="flex w-72 shrink-0 flex-col rounded-lg bg-bg-secondary/50">
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
              <span className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
              <span className="text-sm font-semibold text-text-primary">{col.label}</span>
              <span className="ml-auto text-xs text-text-muted">{colIssues.length}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
              {colIssues.map((issue) => {
                const assigneeName = issue.assignee_id && userNames?.[issue.assignee_id];
                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => navigate(`/${wsSlug}/issues/${issue.id}`)}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-bg-primary p-3 text-left transition-colors hover:border-accent/40 cursor-pointer"
                  >
                    {/* Title row */}
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">{TYPE_ICONS[issue.issue_type]}</div>
                      <span className="text-sm font-medium text-text-primary leading-snug line-clamp-2">
                        {issue.title}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-muted">{issue.issue_number}</span>
                      <PriorityBadge priority={issue.priority} />
                      {issue.estimate !== 'none' && (
                        <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-xs font-medium text-text-muted">
                          {issue.estimate.toUpperCase()}
                        </span>
                      )}
                      <div className="ml-auto">
                        {assigneeName ? (
                          <Avatar displayName={assigneeName} size="sm" />
                        ) : (
                          <div className="h-6 w-6 rounded-full border border-dashed border-border" />
                        )}
                      </div>
                    </div>

                    {/* Due date if set */}
                    {issue.due_date && (
                      <span className="text-xs text-text-muted">
                        Due {new Date(issue.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Add view toggle to ProjectDetailPage**

Add state:

```typescript
const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
```

Import the component:

```typescript
import { KanbanBoard } from './KanbanBoard';
```

Import icons for toggle:

```typescript
import { LayoutList, LayoutGrid } from 'lucide-react';
```

Add toggle buttons in the filter bar (before the issue count):

```tsx
<div className="flex items-center gap-1 rounded-lg border border-border bg-bg-tertiary p-0.5">
  <button
    type="button"
    onClick={() => setViewMode('list')}
    className={`rounded-md p-1.5 transition-colors cursor-pointer ${
      viewMode === 'list' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
    }`}
    title="List view"
  >
    <LayoutList className="h-4 w-4" />
  </button>
  <button
    type="button"
    onClick={() => setViewMode('board')}
    className={`rounded-md p-1.5 transition-colors cursor-pointer ${
      viewMode === 'board' ? 'bg-bg-primary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
    }`}
    title="Board view"
  >
    <LayoutGrid className="h-4 w-4" />
  </button>
</div>
```

**Step 3: Add an `onIssueUpdated` handler in ProjectDetailPage**

```typescript
const handleIssueUpdated = (updated: Issue) => {
  setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
};
```

**Step 4: Conditionally render list or board**

Replace the existing issues list section. When `viewMode === 'list'`, render the existing list header + IssueRow list. When `viewMode === 'board'`, render the KanbanBoard:

```tsx
{viewMode === 'list' ? (
  <>
    {/* Issue list header */}
    <div className="flex items-center gap-4 border-b border-border bg-bg-secondary/50 px-5 py-2 text-xs font-medium uppercase tracking-wider text-text-muted">
      <span className="w-6 shrink-0" />
      <span className="w-24 shrink-0">ID</span>
      <span className="min-w-0 flex-1">Title</span>
      <span className="shrink-0 w-24 text-center">Status</span>
      <span className="shrink-0 w-20 text-center">Priority</span>
      <span className="w-8 shrink-0 text-center">Assignee</span>
      <span className="w-16 shrink-0 text-right">Date</span>
    </div>
    <div className="flex-1 overflow-y-auto">
      {loadingIssues ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" className="text-accent" />
        </div>
      ) : issues.length === 0 ? (
        <EmptyState ... />
      ) : (
        <div>
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} userNames={userNames} />
          ))}
        </div>
      )}
    </div>
  </>
) : (
  <div className="flex-1 overflow-hidden">
    {loadingIssues ? (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" className="text-accent" />
      </div>
    ) : (
      <KanbanBoard issues={issues} userNames={userNames} onIssueUpdated={handleIssueUpdated} />
    )}
  </div>
)}
```

**Step 5: Commit**

```bash
git add frontend/src/components/projects/KanbanBoard.tsx frontend/src/components/projects/ProjectDetailPage.tsx
git commit -m "feat: add kanban board view with list/board toggle"
```

---

### Task 9: Final Polish — Badge components for new types

**Files:**
- Modify: `frontend/src/components/ui/Badge.tsx`

**Step 1: Add TypeBadge and EstimateBadge components**

Check the existing Badge.tsx for the pattern used by StatusBadge and PriorityBadge, then add:

```tsx
const TYPE_STYLES: Record<string, string> = {
  task: 'bg-gray-500/10 text-gray-400',
  bug: 'bg-red-500/10 text-red-400',
  feature: 'bg-amber-500/10 text-amber-400',
  improvement: 'bg-blue-500/10 text-blue-400',
};

const TYPE_LABELS: Record<string, string> = {
  task: 'Task',
  bug: 'Bug',
  feature: 'Feature',
  improvement: 'Improvement',
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[type] ?? ''}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

const ESTIMATE_STYLES = 'bg-purple-500/10 text-purple-400';

export function EstimateBadge({ estimate }: { estimate: string }) {
  if (estimate === 'none') return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTIMATE_STYLES}`}>
      {estimate.toUpperCase()}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/ui/Badge.tsx
git commit -m "feat: add TypeBadge and EstimateBadge components"
```

---

### Task 10: Integration Verification

**Step 1: Run backend compilation**

Run: `cargo check`
Expected: Compiles with no errors.

**Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Builds with no errors.

**Step 3: Run any existing tests**

Run: `cargo test`
Expected: All existing tests pass (tests may need minor updates if they assert on Issue field counts).

**Step 4: Manual smoke test checklist**

- [ ] Create issue with all new fields (type, estimate, due date, assignee)
- [ ] Edit issue — all fields update correctly
- [ ] Sidebar dropdowns change type, estimate, assignee, due date inline
- [ ] Filter by type and assignee on project page
- [ ] Toggle between list and board view
- [ ] Kanban cards show correct info
- [ ] Click kanban card navigates to detail page

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete issue tracking enhancements with kanban board"
```
