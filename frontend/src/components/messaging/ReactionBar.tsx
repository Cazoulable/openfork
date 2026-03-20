import { clsx } from 'clsx';
import type { Reaction } from '../../api/messaging';

interface GroupedReaction {
  emoji: string;
  count: number;
  userIds: string[];
  reacted: boolean; // whether current user reacted
}

interface ReactionBarProps {
  reactions: Reaction[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
  className?: string;
}

function groupReactions(
  reactions: Reaction[],
  currentUserId: string,
): GroupedReaction[] {
  const map = new Map<string, GroupedReaction>();
  for (const r of reactions) {
    const existing = map.get(r.emoji);
    if (existing) {
      existing.count++;
      existing.userIds.push(r.user_id);
      if (r.user_id === currentUserId) existing.reacted = true;
    } else {
      map.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        userIds: [r.user_id],
        reacted: r.user_id === currentUserId,
      });
    }
  }
  return Array.from(map.values());
}

export function ReactionBar({
  reactions,
  currentUserId,
  onToggle,
  className,
}: ReactionBarProps) {
  const grouped = groupReactions(reactions, currentUserId);

  if (grouped.length === 0) return null;

  return (
    <div className={clsx('flex flex-wrap items-center gap-1 mt-1', className)}>
      {grouped.map((g) => (
        <button
          key={g.emoji}
          onClick={() => onToggle(g.emoji)}
          className={clsx(
            'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs transition-colors duration-150 cursor-pointer',
            g.reacted
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-border bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
          )}
          title={`${g.emoji} ${g.count}`}
        >
          <span>{g.emoji}</span>
          <span className="font-medium">{g.count}</span>
        </button>
      ))}
    </div>
  );
}
