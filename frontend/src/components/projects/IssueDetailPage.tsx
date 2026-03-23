import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Pencil,
  Trash2,
  AlertCircle,
  Send,
  Calendar,
  Tag,
  ArrowLeft,
} from 'lucide-react';
import { TopBar } from '../layout/TopBar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { Badge, StatusBadge, PriorityBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { CommentItem } from './CommentItem';
import {
  getIssue,
  updateIssue,
  deleteIssue,
  listComments,
  createComment,
  listLabels,
  setIssueLabels,
  type Issue,
  type IssueStatus,
  type IssuePriority,
  type IssueType,
  type IssueEstimate,
  type Comment,
  type Label,
} from '../../api/projects';
import { listMembers, type WorkspaceMemberInfo } from '../../api/workspaces';
import { useAuthStore } from '../../stores/auth';
import { useWorkspaceStore } from '../../stores/workspace';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// IssueDetailPage
// ---------------------------------------------------------------------------

export function IssueDetailPage() {
  const { id: issueId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspace?.slug);
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?.id);

  // Data state
  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberInfo[]>([]);
  const [issueLabelsIds, setIssueLabelsIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showEditIssue, setShowEditIssue] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);

  // Edit issue form
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<IssueStatus>('todo');
  const [editPriority, setEditPriority] = useState<IssuePriority>('none');
  const [editType, setEditType] = useState<IssueType>('task');
  const [editEstimate, setEditEstimate] = useState<IssueEstimate>('none');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete
  const [deleting, setDeleting] = useState(false);

  // Comment form
  const [commentBody, setCommentBody] = useState('');
  const [commentSending, setCommentSending] = useState(false);

  // Label assignment
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [savingLabels, setSavingLabels] = useState(false);

  // We need a project ID for some API calls. The issue has project_id.
  // We use a placeholder until the issue loads.
  const projectId = issue?.project_id;

  // Fetch issue
  useEffect(() => {
    if (!issueId) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const issueData = await getIssue(issueId!);
        if (cancelled) return;
        setIssue(issueData);
        // Load comments and labels
        const [commentsData, labelsData, membersData] = await Promise.all([
          listComments(issueData.id),
          listLabels(issueData.project_id),
          wsId ? listMembers(wsId).catch(() => [] as WorkspaceMemberInfo[]) : Promise.resolve([] as WorkspaceMemberInfo[]),
        ]);
        if (cancelled) return;
        setComments(commentsData);
        setProjectLabels(labelsData);
        setMembers(membersData);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load issue');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [issueId, wsId]);

  // Open edit modal with current values
  const openEditModal = () => {
    if (!issue) return;
    setEditTitle(issue.title);
    setEditDesc(issue.description ?? '');
    setEditStatus(issue.status);
    setEditPriority(issue.priority);
    setEditType(issue.issue_type);
    setEditEstimate(issue.estimate);
    setEditDueDate(issue.due_date ?? '');
    setEditAssignee(issue.assignee_id ?? '');
    setEditError('');
    setShowEditIssue(true);
  };

  // Edit issue handler
  const handleEditIssue = async (e: FormEvent) => {
    e.preventDefault();
    if (!issue) return;
    setEditSaving(true);
    setEditError('');
    try {
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
      setIssue(updated);
      setShowEditIssue(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update issue');
    } finally {
      setEditSaving(false);
    }
  };

  // Delete issue handler
  const handleDeleteIssue = async () => {
    if (!issue || !projectId) return;
    setDeleting(true);
    try {
      await deleteIssue(issue.id);
      navigate(`/${wsSlug}/projects/${projectId}`);
    } catch {
      setDeleting(false);
    }
  };

  // Add comment handler
  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!issueId || !commentBody.trim()) return;
    setCommentSending(true);
    try {
      const comment = await createComment(issueId, { body: commentBody.trim() });
      setComments((prev) => [...prev, comment]);
      setCommentBody('');
    } catch {
      // ignore
    } finally {
      setCommentSending(false);
    }
  };

  // Inline status change
  const handleStatusChange = async (status: IssueStatus) => {
    if (!issue) return;
    try {
      const updated = await updateIssue(issue.id, { status });
      setIssue(updated);
    } catch {
      // ignore
    }
  };

  // Inline priority change
  const handlePriorityChange = async (priority: IssuePriority) => {
    if (!issue) return;
    try {
      const updated = await updateIssue(issue.id, { priority });
      setIssue(updated);
    } catch {
      // ignore
    }
  };

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

  // Labels modal
  const openLabelsModal = () => {
    setSelectedLabelIds([...issueLabelsIds]);
    setShowLabelsModal(true);
  };

  const toggleLabelSelection = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const handleSaveLabels = async () => {
    if (!issueId) return;
    setSavingLabels(true);
    try {
      await setIssueLabels(issueId, selectedLabelIds);
      setIssueLabelsIds(selectedLabelIds);
      setShowLabelsModal(false);
    } catch {
      // ignore
    } finally {
      setSavingLabels(false);
    }
  };

  // Comment CRUD callbacks
  const handleCommentDeleted = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleCommentUpdated = (updated: Comment) => {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  // Loading
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

  // Error
  if (error || !issue) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Issue" />
        <EmptyState
          icon={<AlertCircle className="h-8 w-8" />}
          title="Could not load issue"
          description={error || 'Issue not found.'}
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          }
        />
      </div>
    );
  }

  // Selected labels for display
  const assignedLabels = projectLabels.filter((l) => issueLabelsIds.includes(l.id));

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title={`Issue ${issue.issue_number}`}>
        <Button
          size="sm"
          variant="ghost"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(`/${wsSlug}/projects/${issue.project_id}`)}
        >
          Back
        </Button>
        <Button size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={openEditModal}>
          Edit
        </Button>
        <Button size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setShowDeleteConfirm(true)}>
          Delete
        </Button>
      </TopBar>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Issue header */}
          <div className="border-b border-border px-6 py-6">
            <h2 className="text-xl font-bold text-text-primary leading-tight mb-3">
              {issue.title}
            </h2>
            <div className="flex items-center gap-3">
              <StatusBadge status={issue.status} />
              <PriorityBadge priority={issue.priority} />
              <Badge>{issue.issue_type}</Badge>
              {issue.estimate !== 'none' && <Badge>{issue.estimate.toUpperCase()}</Badge>}
              <span className="text-xs font-mono text-text-muted">{issue.issue_number}</span>
            </div>
            {issue.description && (
              <p className="mt-4 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                {issue.description}
              </p>
            )}
          </div>

          {/* Comments section */}
          <div className="flex-1 px-6 py-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">
              Comments ({comments.length})
            </h3>

            {comments.length === 0 ? (
              <p className="text-sm text-text-muted py-4">No comments yet. Be the first to comment.</p>
            ) : (
              <div className="divide-y divide-border">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    authorName={
                      comment.author_id === currentUser?.id
                        ? currentUser.display_name
                        : `User ${comment.author_id.slice(0, 6)}`
                    }
                    isOwner={comment.author_id === currentUser?.id}
                    onDeleted={handleCommentDeleted}
                    onUpdated={handleCommentUpdated}
                  />
                ))}
              </div>
            )}

            {/* Add comment form */}
            <form onSubmit={handleAddComment} className="mt-4 flex flex-col gap-3">
              <textarea
                className="w-full rounded-lg border border-border bg-bg-tertiary px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
                rows={3}
                placeholder="Leave a comment..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  type="submit"
                  loading={commentSending}
                  disabled={!commentBody.trim()}
                  icon={<Send className="h-3.5 w-3.5" />}
                >
                  Comment
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Side panel */}
        <aside className="hidden w-72 shrink-0 border-l border-border bg-bg-secondary/30 lg:block overflow-y-auto">
          <div className="flex flex-col gap-5 p-5">
            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Status</span>
              <Select
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value as IssueStatus)}
              >
                <option value="backlog">Backlog</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Priority</span>
              <Select
                value={issue.priority}
                onChange={(e) => handlePriorityChange(e.target.value as IssuePriority)}
              >
                <option value="none">No Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>

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

            {/* Labels */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Labels</span>
                <button
                  type="button"
                  onClick={openLabelsModal}
                  className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
                >
                  Edit
                </button>
              </div>
              {assignedLabels.length === 0 ? (
                <button
                  type="button"
                  onClick={openLabelsModal}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted hover:border-accent/40 hover:text-text-secondary transition-colors cursor-pointer"
                >
                  <Tag className="h-3.5 w-3.5" />
                  Add labels
                </button>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {assignedLabels.map((label) => (
                    <Badge key={label.id} className="gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex items-start gap-2.5">
                <Calendar className="h-4 w-4 mt-0.5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted">Created</p>
                  <p className="text-sm text-text-secondary">{formatDate(issue.created_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar className="h-4 w-4 mt-0.5 text-text-muted shrink-0" />
                <div>
                  <p className="text-xs text-text-muted">Updated</p>
                  <p className="text-sm text-text-secondary">{formatDateTime(issue.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Edit Issue Modal */}
      <Modal open={showEditIssue} onClose={() => setShowEditIssue(false)} title="Edit Issue" size="lg">
        <form onSubmit={handleEditIssue} className="flex flex-col gap-4">
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
            autoFocus
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Description</label>
            <textarea
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
              rows={4}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as IssueStatus)}
            >
              <option value="backlog">Backlog</option>
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Select
              label="Priority"
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as IssuePriority)}
            >
              <option value="none">No Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
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
          {editError && <p className="text-sm text-danger">{editError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowEditIssue(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={editSaving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Issue">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Are you sure you want to delete <span className="font-semibold text-text-primary">{issue.issue_number}: {issue.title}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteIssue} loading={deleting}>
              Delete Issue
            </Button>
          </div>
        </div>
      </Modal>

      {/* Labels Assignment Modal */}
      <Modal open={showLabelsModal} onClose={() => setShowLabelsModal(false)} title="Set Labels">
        <div className="flex flex-col gap-4">
          {projectLabels.length === 0 ? (
            <p className="text-sm text-text-muted py-2">
              No labels available. Create labels from the project page first.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
              {projectLabels.map((label) => {
                const selected = selectedLabelIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabelSelection(label.id)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                      selected
                        ? 'bg-accent/10 text-accent border border-accent/30'
                        : 'text-text-primary hover:bg-bg-hover border border-transparent'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="flex-1">{label.name}</span>
                    {selected && (
                      <span className="text-xs font-medium text-accent">Selected</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowLabelsModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveLabels} loading={savingLabels} disabled={projectLabels.length === 0}>
              Save Labels
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
