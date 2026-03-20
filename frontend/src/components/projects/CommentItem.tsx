import { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import type { Comment } from '../../api/projects';
import { updateComment, deleteComment } from '../../api/projects';

interface CommentItemProps {
  comment: Comment;
  authorName: string;
  isOwner: boolean;
  onDeleted: (commentId: string) => void;
  onUpdated: (comment: Comment) => void;
}

function formatTimestamp(iso: string): string {
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

export function CommentItem({ comment, authorName, isOwner, onDeleted, onUpdated }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  const handleSaveEdit = async () => {
    if (!editBody.trim() || editBody === comment.body) {
      setEditing(false);
      setEditBody(comment.body);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateComment(comment.id, { body: editBody.trim() });
      onUpdated(updated);
      setEditing(false);
    } catch {
      // keep editing on error
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComment(comment.id);
      onDeleted(comment.id);
    } catch {
      // ignore
    }
  };

  return (
    <div className="group flex gap-3 py-4">
      <Avatar displayName={authorName} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{authorName}</span>
          <span className="text-xs text-text-muted">{formatTimestamp(comment.created_at)}</span>
          {comment.updated_at !== comment.created_at && (
            <span className="text-xs text-text-muted italic">(edited)</span>
          )}
          {isOwner && !editing && (
            <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => { setEditing(true); setEditBody(comment.body); }}
                className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded p-1 text-text-muted hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSaveEdit} loading={saving} icon={<Check className="h-3.5 w-3.5" />}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditBody(comment.body); }} icon={<X className="h-3.5 w-3.5" />}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
            {comment.body}
          </p>
        )}
      </div>
    </div>
  );
}
