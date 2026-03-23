import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Hash,
  Settings,
  LogOut,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ThreadPanel } from './ThreadPanel';
import * as api from '../../api/messaging';
import type { Channel, Message, Reaction } from '../../api/messaging';
import { listMembers } from '../../api/workspaces';
import { useAuthStore } from '../../stores/auth';
import { useWorkspaceStore } from '../../stores/workspace';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL = 5000; // poll for new messages every 5 seconds

// ---------------------------------------------------------------------------
// Edit Channel Modal
// ---------------------------------------------------------------------------

interface EditChannelModalProps {
  open: boolean;
  channel: Channel | null;
  onClose: () => void;
  onUpdated: (channel: Channel) => void;
}

function EditChannelModal({ open, channel, onClose, onUpdated }: EditChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setDescription(channel.description || '');
    }
  }, [channel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channel) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.updateChannel(channel.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update channel');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Channel">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Channel name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Channel Actions Menu
// ---------------------------------------------------------------------------

interface ChannelActionsProps {
  onEdit: () => void;
  onLeave: () => void;
  onDelete: () => void;
}

function ChannelActions({ onEdit, onLeave, onDelete }: ChannelActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-lg border border-border bg-bg-secondary py-1 shadow-xl">
            <button
              onClick={() => { onEdit(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary cursor-pointer"
            >
              <Settings className="h-4 w-4" /> Edit Channel
            </button>
            <button
              onClick={() => { onLeave(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary cursor-pointer"
            >
              <LogOut className="h-4 w-4" /> Leave Channel
            </button>
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Delete Channel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

interface DeleteConfirmModalProps {
  open: boolean;
  channelName: string;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

function DeleteConfirmModal({
  open,
  channelName,
  onClose,
  onConfirm,
  deleting,
}: DeleteConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Delete Channel" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Are you sure you want to delete <strong className="text-text-primary">#{channelName}</strong>?
          This action cannot be undone. All messages will be permanently lost.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" loading={deleting} onClick={onConfirm}>
            Delete Channel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function ChannelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const wsSlug = useWorkspaceStore((s) => s.currentWorkspace?.slug);
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?.id);
  const currentUserId = user?.id || '';

  // Channel state
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);
  const [channelError, setChannelError] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  // Reactions state: map of message_id -> Reaction[]
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});

  // Thread reply counts: map of thread_id -> count
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});

  // Thread panel state
  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);

  // Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // User name map: userId -> handle
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // Scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // ---------------------------------------------------------------------------
  // Fetch channel info
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setChannelLoading(true);
      setChannelError(null);
      try {
        const ch = await api.getChannel(id!);
        if (!cancelled) setChannel(ch);
      } catch (err) {
        if (!cancelled) setChannelError(err instanceof Error ? err.message : 'Failed to load channel');
      } finally {
        if (!cancelled) setChannelLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  // ---------------------------------------------------------------------------
  // Fetch workspace members for display names
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!wsId) return;
    listMembers(wsId)
      .then((members) => {
        const map: Record<string, string> = {};
        for (const m of members) {
          map[m.user_id] = m.display_name;
        }
        setUserNames(map);
      })
      .catch((err) => console.error('Failed to load members for names:', err));
  }, [wsId]);

  // ---------------------------------------------------------------------------
  // Fetch messages
  // ---------------------------------------------------------------------------

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.listMessages(id, { limit: 50 });
      setMessages(data);

      // Compute reply counts from thread_id references
      const counts: Record<string, number> = {};
      for (const m of data) {
        if (m.thread_id) {
          counts[m.thread_id] = (counts[m.thread_id] || 0) + 1;
        }
      }
      setReplyCounts(counts);
    } catch (err) {
      console.error('Failed to load messages:', err);
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
  // Send message
  // ---------------------------------------------------------------------------

  const handleSend = async (body: string) => {
    if (!id) return;
    const msg = await api.sendMessage(id, { body });
    setMessages((prev) => [...prev, msg]);
    shouldAutoScroll.current = true;
  };

  // ---------------------------------------------------------------------------
  // Reactions
  // ---------------------------------------------------------------------------

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    try {
      const reaction = await api.addReaction(messageId, emoji);
      setReactions((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), reaction],
      }));
    } catch (err) {
      console.error('Failed to add reaction:', err);
    }
  }, []);

  const handleRemoveReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await api.removeReaction(messageId, emoji);
      setReactions((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] || []).filter(
          (r) => !(r.emoji === emoji && r.user_id === currentUserId),
        ),
      }));
    } catch (err) {
      console.error('Failed to remove reaction:', err);
    }
  }, [currentUserId]);

  // ---------------------------------------------------------------------------
  // Edit / Delete messages
  // ---------------------------------------------------------------------------

  const handleEditMessage = useCallback(async (messageId: string, newBody: string) => {
    try {
      const updated = await api.updateMessage(messageId, { body: newBody });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      await api.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Channel actions
  // ---------------------------------------------------------------------------

  const handleLeave = async () => {
    if (!id) return;
    try {
      await api.leaveChannel(id);
      navigate(`/${wsSlug}/channels`);
    } catch (err) {
      console.error('Failed to leave channel:', err);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.deleteChannel(id);
      navigate(`/${wsSlug}/channels`);
    } catch (err) {
      console.error('Failed to delete channel:', err);
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Thread
  // ---------------------------------------------------------------------------

  const threadParent = threadMessageId
    ? messages.find((m) => m.id === threadMessageId) ?? null
    : null;

  const handleThreadMessageSent = (msg: Message) => {
    // Update reply count
    setReplyCounts((prev) => ({
      ...prev,
      [msg.thread_id!]: (prev[msg.thread_id!] || 0) + 1,
    }));
  };

  // ---------------------------------------------------------------------------
  // Resolve display name (fallback to user ID prefix or current user's name)
  // ---------------------------------------------------------------------------

  const resolveName = useCallback(
    (userId: string) => {
      return userNames[userId]
        || (userId === currentUserId ? user?.display_name : undefined)
        || `User ${userId.slice(0, 8)}`;
    },
    [currentUserId, user, userNames],
  );

  // ---------------------------------------------------------------------------
  // Filter out thread replies from main view (show only top-level messages)
  // ---------------------------------------------------------------------------

  const topLevelMessages = messages.filter((m) => !m.thread_id);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (channelLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Spinner size="lg" className="text-text-muted" />
      </div>
    );
  }

  if (channelError || !channel) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <p className="text-sm text-danger mb-3">{channelError || 'Channel not found'}</p>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/${wsSlug}/channels`)}>
          Back to Channels
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Channel header bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary truncate">{channel.name}</span>
          {channel.description && (
            <span className="hidden text-xs text-text-muted lg:block max-w-xs truncate ml-2">
              {channel.description}
            </span>
          )}
        </div>
        <ChannelActions
          onEdit={() => setEditModalOpen(true)}
          onLeave={handleLeave}
          onDelete={() => setDeleteModalOpen(true)}
        />
      </div>

      {/* Main content: messages + optional thread panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Message area */}
        <div className="flex flex-1 flex-col">
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
            ) : topLevelMessages.length === 0 ? (
              <EmptyState
                icon={<Hash className="h-8 w-8" />}
                title={`Welcome to #${channel.name}`}
                description="This is the start of the channel. Send a message to get the conversation going!"
              />
            ) : (
              <div className="py-4">
                {/* Channel intro */}
                <div className="mb-6 px-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-tertiary text-text-muted mb-3">
                    <Hash className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-bold text-text-primary">#{channel.name}</h2>
                  {channel.description && (
                    <p className="mt-1 text-sm text-text-muted">{channel.description}</p>
                  )}
                  <div className="mt-3 border-b border-border" />
                </div>

                {/* Messages */}
                {topLevelMessages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    senderName={resolveName(msg.author_id)}
                    reactions={reactions[msg.id] || []}
                    replyCount={replyCounts[msg.id] || 0}
                    currentUserId={currentUserId}
                    onReact={handleReact}
                    onRemoveReaction={handleRemoveReaction}
                    onOpenThread={(msgId) => setThreadMessageId(msgId)}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Message input */}
          <MessageInput
            onSend={handleSend}
            placeholder={`Message #${channel.name}`}
            autoFocus
          />
        </div>

        {/* Thread panel */}
        {threadParent && id && (
          <ThreadPanel
            parentMessage={threadParent}
            parentSenderName={resolveName(threadParent.author_id)}
            parentReactions={reactions[threadParent.id] || []}
            channelId={id}
            currentUserId={currentUserId}
            userNames={userNames}
            allReactions={reactions}
            onClose={() => setThreadMessageId(null)}
            onReact={handleReact}
            onRemoveReaction={handleRemoveReaction}
            onMessageSent={handleThreadMessageSent}
          />
        )}
      </div>

      {/* Edit Channel Modal */}
      <EditChannelModal
        open={editModalOpen}
        channel={channel}
        onClose={() => setEditModalOpen(false)}
        onUpdated={(updated) => setChannel(updated)}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        channelName={channel.name}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
