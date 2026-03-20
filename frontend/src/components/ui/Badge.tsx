import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type BadgeVariant =
  | 'default'
  | 'gray'
  | 'blue'
  | 'yellow'
  | 'green'
  | 'red'
  | 'orange';

type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';
type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-bg-hover text-text-secondary border-border',
  gray: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  green: 'bg-green-500/15 text-green-400 border-green-500/25',
  red: 'bg-red-500/15 text-red-400 border-red-500/25',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
};

const statusVariantMap: Record<IssueStatus, BadgeVariant> = {
  backlog: 'gray',
  todo: 'blue',
  in_progress: 'yellow',
  done: 'green',
  cancelled: 'red',
};

const priorityVariantMap: Record<Priority, BadgeVariant> = {
  none: 'gray',
  low: 'blue',
  medium: 'yellow',
  high: 'orange',
  urgent: 'red',
};

const statusLabels: Record<IssueStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
};

const priorityLabels: Record<Priority, string> = {
  none: 'No Priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium leading-tight',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: IssueStatus; className?: string }) {
  return (
    <Badge variant={statusVariantMap[status]} className={className}>
      {statusLabels[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Badge variant={priorityVariantMap[priority]} className={className}>
      {priorityLabels[priority]}
    </Badge>
  );
}
