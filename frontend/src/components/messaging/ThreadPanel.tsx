import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Spinner } from '../ui/Spinner';
import * as api from '../../api/messaging';
import type { Message, Reaction } from '../../api/messaging';

interface ThreadPanelProps {
  parentMessage: Message;
  parentSenderName: string;
  parentReactions: Reaction[];
  channelId: string;
  currentUserId: string;
  /** Map of user_id -> display name (for all known users in channel) */
  userNames: Record<string, string>;
  /** Map of message_id -> Reaction[] */
  allReactions: Record<string, Reaction[]>;
  onClose: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
  onMessageSent: (msg: Message) => void;
}

export function ThreadPanel({
  parentMessage,
  parentSenderName,
  parentReactions,
  channelId,
  currentUserId,
  userNames,
  allReactions,
  onClose,
  onReact,
  onRemoveReaction,
  onMessageSent,
}: ThreadPanelProps) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchReplies = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getThread(parentMessage.id);
      // Filter out the parent message — it's already shown above
      setReplies(data.filter((m) => m.id !== parentMessage.id));
    } catch (err) {
      console.error('Failed to load thread:', err);
    } finally {
      setLoading(false);
    }
  }, [parentMessage.id]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies]);

  const handleSend = async (body: string) => {
    const msg = await api.sendMessage(channelId, {
      body,
      thread_id: parentMessage.id,
    });
    setReplies((prev) => [...prev, msg]);
    onMessageSent(msg);
  };

  const resolveName = (userId: string, authorName?: string | null) =>
    authorName || userNames[userId] || userId.slice(0, 8);

  return (
    <div className="flex h-full w-96 flex-col border-l border-border bg-bg-primary">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold text-text-primary">Thread</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Parent message */}
      <div className="border-b border-border py-2">
        <MessageBubble
          message={parentMessage}
          senderName={parentSenderName}
          reactions={parentReactions}
          currentUserId={currentUserId}
          onReact={onReact}
          onRemoveReaction={onRemoveReaction}
          compact
        />
      </div>

      {/* Replies */}
      <div
        ref={scrollRef}
        className={clsx(
          'flex-1 overflow-y-auto',
          loading && 'flex items-center justify-center',
        )}
      >
        {loading ? (
          <Spinner size="lg" className="text-text-muted" />
        ) : replies.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-text-muted">No replies yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="py-2">
            {replies.map((r) => (
              <MessageBubble
                key={r.id}
                message={r}
                senderName={resolveName(r.author_id, r.author_name)}
                reactions={allReactions[r.id] || []}
                currentUserId={currentUserId}
                onReact={onReact}
                onRemoveReaction={onRemoveReaction}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        placeholder="Reply in thread..."
        autoFocus
      />
    </div>
  );
}
