import { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  SmilePlus,
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { ReactionBar } from './ReactionBar';
import type { Message, Reaction } from '../../api/messaging';

// ---------------------------------------------------------------------------
// Preset emojis for quick reactions
// ---------------------------------------------------------------------------

const PRESET_EMOJIS = [
  { emoji: '\u{1F44D}', label: 'thumbs up' },
  { emoji: '\u{2764}\u{FE0F}', label: 'heart' },
  { emoji: '\u{1F602}', label: 'laugh' },
  { emoji: '\u{1F389}', label: 'party' },
  { emoji: '\u{1F525}', label: 'fire' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message;
  /** Display name for the sender. Falls back to author_id if not resolved. */
  senderName: string;
  reactions: Reaction[];
  replyCount?: number;
  currentUserId: string;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
  onOpenThread?: (messageId: string) => void;
  onEdit?: (messageId: string, newBody: string) => void;
  onDelete?: (messageId: string) => void;
  /** If true, renders compactly for use in a thread panel */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== d.getFullYear() ? 'numeric' : undefined,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageBubble({
  message,
  senderName,
  reactions,
  replyCount = 0,
  currentUserId,
  onReact,
  onRemoveReaction,
  onOpenThread,
  onEdit,
  onDelete,
  compact = false,
}: MessageBubbleProps) {
  const [hovered, setHovered] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(message.body);

  const isOwn = message.author_id === currentUserId;
  const wasEdited = message.updated_at !== message.created_at;

  const handleToggleReaction = useCallback(
    (emoji: string) => {
      const existing = reactions.find(
        (r) => r.emoji === emoji && r.user_id === currentUserId,
      );
      if (existing) {
        onRemoveReaction(message.id, emoji);
      } else {
        onReact(message.id, emoji);
      }
    },
    [reactions, currentUserId, message.id, onReact, onRemoveReaction],
  );

  const handleSaveEdit = () => {
    const trimmed = editBody.trim();
    if (trimmed && trimmed !== message.body && onEdit) {
      onEdit(message.id, trimmed);
    }
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditBody(message.body);
    setEditing(false);
  };

  return (
    <div
      className={clsx(
        'group relative flex gap-3 px-4 py-1.5 transition-colors duration-100',
        hovered && 'bg-bg-hover/50',
        compact && 'px-3 py-1',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setShowEmojiPicker(false);
      }}
    >
      {/* Avatar */}
      <div className={clsx('shrink-0 pt-0.5', compact && 'pt-0')}>
        <Avatar displayName={senderName} size={compact ? 'sm' : 'md'} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Name + timestamp */}
        <div className="flex items-baseline gap-2">
          <span className={clsx('font-semibold text-text-primary', compact ? 'text-xs' : 'text-sm')}>
            {senderName}
          </span>
          <span className="text-xs text-text-muted" title={new Date(message.created_at).toLocaleString()}>
            {formatDate(message.created_at)} at {formatTime(message.created_at)}
          </span>
          {wasEdited && (
            <span className="text-xs text-text-muted italic">(edited)</span>
          )}
        </div>

        {/* Body */}
        {editing ? (
          <div className="mt-1">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                }
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className="w-full resize-none rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
              rows={2}
              autoFocus
            />
            <div className="mt-1 flex items-center gap-2">
              <button
                onClick={handleSaveEdit}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-hover cursor-pointer"
              >
                <Check className="h-3 w-3" /> Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1 rounded-md bg-bg-tertiary px-2 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover cursor-pointer"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
              <span className="text-xs text-text-muted">Esc to cancel, Enter to save</span>
            </div>
          </div>
        ) : (
          <p className={clsx('whitespace-pre-wrap break-words text-text-primary', compact ? 'text-xs mt-0.5' : 'text-sm mt-0.5')}>
            {message.body}
          </p>
        )}

        {/* Reactions */}
        <ReactionBar
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={handleToggleReaction}
        />

        {/* Thread indicator */}
        {!compact && replyCount > 0 && onOpenThread && (
          <button
            onClick={() => onOpenThread(message.id)}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>

      {/* Hover actions toolbar */}
      {hovered && !editing && (
        <div className="absolute -top-3 right-4 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-bg-secondary p-0.5 shadow-lg">
          {/* Reaction quick-pick */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
              title="Add reaction"
            >
              <SmilePlus className="h-4 w-4" />
            </button>
            {showEmojiPicker && (
              <div className="absolute right-0 top-full mt-1 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-bg-secondary p-1 shadow-lg">
                {PRESET_EMOJIS.map((e) => (
                  <button
                    key={e.emoji}
                    onClick={() => {
                      handleToggleReaction(e.emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="rounded-md p-1.5 text-lg hover:bg-bg-hover transition-colors cursor-pointer"
                    title={e.label}
                  >
                    {e.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Thread */}
          {onOpenThread && (
            <button
              onClick={() => onOpenThread(message.id)}
              className="rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
              title="Reply in thread"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}

          {/* Edit (own only) */}
          {isOwn && onEdit && (
            <button
              onClick={() => {
                setEditBody(message.body);
                setEditing(true);
              }}
              className="rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
              title="Edit message"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}

          {/* Delete (own only) */}
          {isOwn && onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-danger transition-colors cursor-pointer"
              title="Delete message"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
