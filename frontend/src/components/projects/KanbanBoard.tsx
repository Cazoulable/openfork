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
    <div className="flex h-full gap-4 overflow-x-auto p-4">
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
