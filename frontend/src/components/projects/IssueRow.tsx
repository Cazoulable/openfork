import { useNavigate } from 'react-router-dom';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Bug, Lightbulb, Wrench, CheckSquare } from 'lucide-react';
import type { Issue, IssueType } from '../../api/projects';
import { useWorkspaceStore } from '../../stores/workspace';

interface IssueRowProps {
  issue: Issue;
  /** Optional map of user ID to display name for rendering assignee */
  userNames?: Record<string, string>;
  assigneeIds?: string[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const TYPE_ICONS: Record<IssueType, React.ReactNode> = {
  task: <CheckSquare className="h-3.5 w-3.5 text-text-muted" />,
  bug: <Bug className="h-3.5 w-3.5 text-danger" />,
  feature: <Lightbulb className="h-3.5 w-3.5 text-warning" />,
  improvement: <Wrench className="h-3.5 w-3.5 text-accent" />,
};

export function IssueRow({ issue, userNames, assigneeIds = [] }: IssueRowProps) {
  const navigate = useNavigate();
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspace?.slug);

  return (
    <button
      type="button"
      onClick={() => navigate(`/${wsSlug}/issues/${issue.id}`)}
      className="group flex w-full items-center gap-4 border-b border-border px-5 py-3 text-left transition-colors duration-100 hover:bg-bg-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
    >
      {/* Type icon */}
      <div className="w-6 shrink-0 flex justify-center" title={issue.issue_type}>
        {TYPE_ICONS[issue.issue_type]}
      </div>

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

      {/* Assignees */}
      <div className="w-12 shrink-0 flex justify-center">
        {assigneeIds.length > 0 ? (
          <div className="flex -space-x-2">
            {assigneeIds.slice(0, 3).map((uid) => (
              <Avatar key={uid} displayName={userNames?.[uid] ?? '?'} size="sm" />
            ))}
            {assigneeIds.length > 3 && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-tertiary text-xs font-medium text-text-muted border-2 border-bg-primary">
                +{assigneeIds.length - 3}
              </span>
            )}
          </div>
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
