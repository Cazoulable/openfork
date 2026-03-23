import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Tags,
  ListFilter,
  AlertCircle,
  CircleDot,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { TopBar } from '../layout/TopBar';
import { useWorkspaceStore } from '../../stores/workspace';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';
import { IssueRow } from './IssueRow';
import { KanbanBoard } from './KanbanBoard';
import {
  getProject,
  updateProject,
  deleteProject,
  listIssues,
  createIssue,
  listLabels,
  createLabel,
  type Project,
  type Issue,
  type IssueStatus,
  type IssuePriority,
  type IssueType,
  type IssueEstimate,
  type ListIssuesFilters,
  type Label,
} from '../../api/projects';
import { listMembers, type WorkspaceMemberInfo } from '../../api/workspaces';
import { useAuthStore } from '../../stores/auth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: IssueStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS: { value: IssuePriority | ''; label: string }[] = [
  { value: '', label: 'All priorities' },
  { value: 'none', label: 'No Priority' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const TYPE_OPTIONS: { value: IssueType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'improvement', label: 'Improvement' },
];

const LABEL_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

// ---------------------------------------------------------------------------
// ProjectDetailPage
// ---------------------------------------------------------------------------

export function ProjectDetailPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspace?.slug);
  const currentUser = useAuthStore((s) => s.user);

  // Data state
  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState<IssueStatus | ''>('');
  const [filterPriority, setFilterPriority] = useState<IssuePriority | ''>('');
  const [filterType, setFilterType] = useState<IssueType | ''>('');
  const [filterAssignee, setFilterAssignee] = useState('');

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  // Modals
  const [showEditProject, setShowEditProject] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateIssue, setShowCreateIssue] = useState(false);
  const [showManageLabels, setShowManageLabels] = useState(false);

  // Edit project form
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete project
  const [deleting, setDeleting] = useState(false);

  // Create issue form
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [issueStatus, setIssueStatus] = useState<IssueStatus>('todo');
  const [issuePriority, setIssuePriority] = useState<IssuePriority>('none');
  const [issueType, setIssueType] = useState<IssueType>('task');
  const [issueEstimate, setIssueEstimate] = useState<IssueEstimate>('none');
  const [issueDueDate, setIssueDueDate] = useState('');
  const [issueAssignee, setIssueAssignee] = useState('');
  const [issueCreating, setIssueCreating] = useState(false);
  const [issueError, setIssueError] = useState('');

  // Create label form
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);
  const [labelCreating, setLabelCreating] = useState(false);

  // Fetch project
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    getProject(projectId)
      .then((data) => {
        if (cancelled) return;
        setProject(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load project');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId]);

  // Fetch issues
  const fetchIssues = useCallback(async (filters?: ListIssuesFilters) => {
    if (!projectId) return;
    setLoadingIssues(true);
    try {
      const data = await listIssues(projectId, filters);
      setIssues(data);
    } catch {
      setIssues([]);
    } finally {
      setLoadingIssues(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || loading) return;
    const filters: ListIssuesFilters = {};
    if (filterStatus) filters.status = filterStatus;
    if (filterPriority) filters.priority = filterPriority;
    if (filterType) filters.issue_type = filterType;
    if (filterAssignee) filters.assignee_id = filterAssignee;
    fetchIssues(filters);
  }, [projectId, loading, filterStatus, filterPriority, filterType, filterAssignee, fetchIssues]);

  // Fetch labels and members
  useEffect(() => {
    if (!projectId || loading || !project) return;
    Promise.all([
      listLabels(projectId).catch(() => [] as Label[]),
      project.workspace_id ? listMembers(project.workspace_id).catch(() => [] as WorkspaceMemberInfo[]) : Promise.resolve([] as WorkspaceMemberInfo[]),
    ]).then(([labelsData, membersData]) => {
      setLabels(labelsData);
      setMembers(membersData);
    });
  }, [projectId, loading, project]);

  // Edit project handler
  const handleEditProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setEditSaving(true);
    setEditError('');
    try {
      const updated = await updateProject(project.id, {
        name: editName.trim() || undefined,
        description: editDesc.trim(),
      });
      setProject(updated);
      setShowEditProject(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setEditSaving(false);
    }
  };

  // Delete project handler
  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      navigate(`/${wsSlug}/projects`);
    } catch {
      setDeleting(false);
    }
  };

  // Create issue handler
  const handleCreateIssue = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId || !issueTitle.trim()) return;
    setIssueCreating(true);
    setIssueError('');
    try {
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
      setIssues((prev) => [issue, ...prev]);
      setShowCreateIssue(false);
      setIssueTitle('');
      setIssueDesc('');
      setIssueStatus('todo');
      setIssuePriority('none');
      setIssueType('task');
      setIssueEstimate('none');
      setIssueDueDate('');
      setIssueAssignee('');
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setIssueCreating(false);
    }
  };

  // Create label handler
  const handleCreateLabel = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId || !labelName.trim()) return;
    setLabelCreating(true);
    try {
      const label = await createLabel(projectId, {
        name: labelName.trim(),
        color: labelColor,
      });
      setLabels((prev) => [...prev, label]);
      setLabelName('');
      setLabelColor(LABEL_COLORS[0]);
    } catch {
      // ignore
    } finally {
      setLabelCreating(false);
    }
  };

  // Open edit modal with current values
  const openEditModal = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description ?? '');
    setEditError('');
    setShowEditProject(true);
  };

  // Update an issue in-place (for kanban board later)
  const handleIssueUpdated = (updated: Issue) => {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  // Build userNames map
  const userNames = Object.fromEntries(members.map((m) => [m.user_id, m.display_name]));

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Loading..." />
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" className="text-accent" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Project" />
        <EmptyState
          icon={<AlertCircle className="h-8 w-8" />}
          title="Could not load project"
          description={error || 'Project not found.'}
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate(`/${wsSlug}/projects`)}>
              Back to Projects
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title={project.name}>
        <Button size="sm" variant="ghost" icon={<Tags className="h-4 w-4" />} onClick={() => setShowManageLabels(true)}>
          Labels
        </Button>
        <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={openEditModal}>
          Edit
        </Button>
        <Button size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setShowDeleteConfirm(true)}>
          Delete
        </Button>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateIssue(true)}>
          New Issue
        </Button>
      </TopBar>

      {/* Project description */}
      {project.description && (
        <div className="border-b border-border bg-bg-primary px-6 py-3">
          <p className="text-sm text-text-secondary">{project.description}</p>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex items-center gap-3 border-b border-border bg-bg-primary px-6 py-3">
        <ListFilter className="h-4 w-4 text-text-muted" />
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as IssueStatus | '')}
          wrapperClassName="w-40"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
        <Select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as IssuePriority | '')}
          wrapperClassName="w-40"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
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
        {(filterStatus || filterPriority || filterType || filterAssignee) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilterStatus('');
              setFilterPriority('');
              setFilterType('');
              setFilterAssignee('');
            }}
          >
            Clear filters
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
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
          <span className="text-xs text-text-muted">
            {issues.length} issue{issues.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

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

          {/* Issues */}
          <div className="flex-1 overflow-y-auto">
            {loadingIssues ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="lg" className="text-accent" />
              </div>
            ) : issues.length === 0 ? (
              <EmptyState
                icon={<CircleDot className="h-8 w-8" />}
                title="No issues yet"
                description="Create an issue to start tracking work in this project."
                action={
                  <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateIssue(true)}>
                    Create Issue
                  </Button>
                }
              />
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

      {/* Edit Project Modal */}
      <Modal open={showEditProject} onClose={() => setShowEditProject(false)} title="Edit Project">
        <form onSubmit={handleEditProject} className="flex flex-col gap-4">
          <Input
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Description</label>
            <textarea
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
          </div>
          {editError && <p className="text-sm text-danger">{editError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowEditProject(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={editSaving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Project">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Are you sure you want to delete <span className="font-semibold text-text-primary">{project.name}</span>?
            This action cannot be undone and all issues in this project will be permanently removed.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteProject} loading={deleting}>
              Delete Project
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Issue Modal */}
      <Modal open={showCreateIssue} onClose={() => setShowCreateIssue(false)} title="Create Issue" size="lg">
        <form onSubmit={handleCreateIssue} className="flex flex-col gap-4">
          <Input
            label="Title"
            placeholder="What needs to be done?"
            value={issueTitle}
            onChange={(e) => setIssueTitle(e.target.value)}
            required
            autoFocus
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Description</label>
            <textarea
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
              rows={4}
              placeholder="Add a description..."
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Status"
              value={issueStatus}
              onChange={(e) => setIssueStatus(e.target.value as IssueStatus)}
            >
              <option value="backlog">Backlog</option>
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Select
              label="Priority"
              value={issuePriority}
              onChange={(e) => setIssuePriority(e.target.value as IssuePriority)}
            >
              <option value="none">No Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
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
          {issueError && <p className="text-sm text-danger">{issueError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowCreateIssue(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={issueCreating}>
              Create Issue
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Labels Modal */}
      <Modal open={showManageLabels} onClose={() => setShowManageLabels(false)} title="Manage Labels" size="lg">
        <div className="flex flex-col gap-5">
          {/* Existing labels */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-text-secondary">Labels ({labels.length})</h3>
            {labels.length === 0 ? (
              <p className="text-sm text-text-muted py-2">No labels created yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <Badge key={label.id} className="gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Create new label */}
          <form onSubmit={handleCreateLabel} className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-sm font-medium text-text-secondary">Create Label</h3>
            <div className="flex items-end gap-3">
              <Input
                label="Name"
                placeholder="Bug, Feature, Enhancement..."
                value={labelName}
                onChange={(e) => setLabelName(e.target.value)}
                wrapperClassName="flex-1"
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Color</label>
                <div className="flex items-center gap-1.5">
                  {LABEL_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setLabelColor(color)}
                      className={`h-7 w-7 rounded-md transition-all cursor-pointer ${
                        labelColor === color
                          ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-secondary scale-110'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <Button size="sm" type="submit" loading={labelCreating} className="shrink-0">
                Add
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
