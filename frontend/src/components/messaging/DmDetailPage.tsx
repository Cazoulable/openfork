import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { Avatar } from '../ui/Avatar';
import { MessageInput } from './MessageInput';
import * as api from '../../api/messaging';
import type { DmGroup, DmMessage } from '../../api/messaging';
import { useAuthStore } from '../../stores/auth';
import { useWorkspaceStore } from '../../stores/workspace';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 5000;

// ---------------------------------------------------------------------------
// DM Bubble (simpler than channel MessageBubble — no threads, no reactions)
// ---------------------------------------------------------------------------

interface DmBubbleProps {
  message: DmMessage;
  senderName: string;
  isOwn: boolean;
}

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

function DmBubble({ message, senderName, isOwn: _isOwn }: DmBubbleProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={clsx(
        'group flex gap-3 px-4 py-1.5 transition-colors duration-100',
        hovered && 'bg-bg-hover/50',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="shrink-0 pt-0.5">
        <Avatar displayName={senderName} size="md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text-primary">{senderName}</span>
          <span
            className="text-xs text-text-muted"
            title={new Date(message.created_at).toLocaleString()}
          >
            {formatDate(message.created_at)} at {formatTime(message.created_at)}
          </span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text-primary">
          {message.body}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DmDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspace?.slug);
  const currentUserId = user?.id || '';

  // Group state
  const [group, setGroup] = useState<DmGroup | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  // Scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // ---------------------------------------------------------------------------
  // Fetch group info (DM groups endpoint returns list; find ours)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setGroupLoading(true);
      setGroupError(null);
      try {
        // The API doesn't have a getGroup(id), so fetch all and find
        const groups = await api.listDmGroups();
        const found = groups.find((g) => g.id === id);
        if (!cancelled) {
          if (found) {
            setGroup(found);
          } else {
            setGroupError('Conversation not found');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setGroupError(err instanceof Error ? err.message : 'Failed to load conversation');
        }
      } finally {
        if (!cancelled) setGroupLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  // ---------------------------------------------------------------------------
  // Fetch messages
  // ---------------------------------------------------------------------------

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.listDms(id, { limit: 50 });
      setMessages(data);
    } catch (err) {
      console.error('Failed to load DMs:', err);
    }
  }, [id]);

  useEffect(() => {
    async function init() {
      setMessagesLoading(true);
      await fetchMessages();
      setMessagesLoading(false);
    }
    init();
  }, [fetchMessages]);

  // Poll for new messages
  useEffect(() => {
    const timer = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  // ---------------------------------------------------------------------------
  // Auto-scroll
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  // ---------------------------------------------------------------------------
  // Send DM
  // ---------------------------------------------------------------------------

  const handleSend = async (body: string) => {
    if (!id) return;
    const msg = await api.sendDm(id, body);
    setMessages((prev) => [...prev, msg]);
    shouldAutoScroll.current = true;
  };

  // ---------------------------------------------------------------------------
  // Resolve names
  // ---------------------------------------------------------------------------

  const resolveName = useCallback(
    (userId: string) => {
      if (userId === currentUserId && user?.display_name) return user.display_name;
      return `User ${userId.slice(0, 8)}`;
    },
    [currentUserId, user],
  );

  // Build title from group id
  const buildTitle = () => {
    if (!group) return 'Direct Message';
    return `Conversation ${group.id.slice(0, 8)}`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (groupLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Spinner size="lg" className="text-text-muted" />
      </div>
    );
  }

  if (groupError || !group) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <p className="text-sm text-danger mb-3">{groupError || 'Conversation not found'}</p>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/${wsSlug}/dm`)}>
          Back to Messages
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* DM header bar */}
      <div className="flex h-12 shrink-0 items-center border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Avatar displayName={buildTitle()} size="sm" />
          <span className="text-sm font-semibold text-text-primary">{buildTitle()}</span>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={clsx(
          'flex-1 overflow-y-auto',
          messagesLoading && 'flex items-center justify-center',
        )}
      >
        {messagesLoading ? (
          <Spinner size="lg" className="text-text-muted" />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8" />}
            title="Start the conversation"
            description="Send a message to get things going!"
          />
        ) : (
          <div className="py-4">
            {/* Conversation intro */}
            <div className="mb-6 px-4">
              <div className="flex items-center gap-2 mb-3">
                <Avatar displayName={buildTitle()} size="lg" />
              </div>
              <h2 className="text-lg font-bold text-text-primary">{buildTitle()}</h2>
              <p className="mt-1 text-sm text-text-muted">
                This is the start of your conversation.
              </p>
              <div className="mt-3 border-b border-border" />
            </div>

            {/* Messages */}
            {messages.map((msg) => (
              <DmBubble
                key={msg.id}
                message={msg}
                senderName={resolveName(msg.author_id)}
                isOwn={msg.author_id === currentUserId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        placeholder={`Message ${buildTitle()}`}
        autoFocus
      />
    </div>
  );
}
