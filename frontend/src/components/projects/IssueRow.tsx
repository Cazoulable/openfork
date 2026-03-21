import { useNavigate } from 'react-router-dom';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import type { Issue } from '../../api/projects';

interface IssueRowProps {
  issue: Issue;
  /** Optional map of user ID to display name for rendering assignee */
  userNames?: Record<string, string>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function IssueRow({ issue, userNames }: IssueRowProps) {
  const navigate = useNavigate();
  const assigneeName = issue.assignee_id && userNames?.[issue.assignee_id];

  return (
    <button
      type="button"
      onClick={() => navigate(`/issues/${issue.id}`)}
      className="group flex w-full items-center gap-4 border-b border-border px-5 py-3 text-left transition-colors duration-100 hover:bg-bg-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
    >
      {/* Identifier */}
      <span className="w-24 shrink-0 text-xs font-mono text-text-muted">
        {issue.issue_number}
      </span>

      {/* Title */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary group-hover:text-accent transition-colors">
        {issue.title}
      </span>

      {/* Status */}
      <div className="shrink-0">
        <StatusBadge status={issue.status} />
      </div>

      {/* Priority */}
      <div className="shrink-0">
        <PriorityBadge priority={issue.priority} />
      </div>

      {/* Assignee */}
      <div className="w-8 shrink-0 flex justify-center">
        {assigneeName ? (
          <Avatar displayName={assigneeName} size="sm" />
        ) : (
          <div className="h-7 w-7 rounded-full border border-dashed border-border" title="Unassigned" />
        )}
      </div>

      {/* Date */}
      <span className="w-16 shrink-0 text-right text-xs text-text-muted">
        {formatDate(issue.created_at)}
      </span>
    </button>
  );
}
