import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Hash, Lock, Users, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { TopBar } from '../layout/TopBar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';
import { useWorkspaceStore } from '../../stores/workspace';
import * as api from '../../api/messaging';
import type { Channel } from '../../api/messaging';

// ---------------------------------------------------------------------------
// New Channel Modal
// ---------------------------------------------------------------------------

interface NewChannelModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (channel: Channel) => void;
}

function NewChannelModal({ open, onClose, onCreated }: NewChannelModalProps) {
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setIsPrivate(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Channel name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const channel = await api.createChannel({
        name: trimmedName,
        slug,
        description: description.trim() || undefined,
        is_private: isPrivate,
        workspace_id: currentWorkspace?.id,
      });
      onCreated(channel);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="New Channel">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Channel name"
          placeholder="e.g. general"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Input
          label="Description"
          placeholder="What is this channel about?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            className={clsx(
              'relative h-5 w-9 rounded-full transition-colors duration-200',
              isPrivate ? 'bg-accent' : 'bg-bg-hover',
            )}
            onClick={() => setIsPrivate(!isPrivate)}
          >
            <div
              className={clsx(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200',
                isPrivate ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Private channel</p>
            <p className="text-xs text-text-muted">
              Only invited members can see and join this channel
            </p>
          </div>
        </label>

        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submitting}>
            Create Channel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Channel List Item
// ---------------------------------------------------------------------------

interface ChannelListItemProps {
  channel: Channel;
  onClick: () => void;
}

function ChannelListItem({ channel, onClick }: ChannelListItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-150 hover:bg-bg-hover cursor-pointer"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary text-text-muted">
        {channel.is_private ? (
          <Lock className="h-4 w-4" />
        ) : (
          <Hash className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">
            {channel.name}
          </span>
          {channel.is_private && (
            <Badge variant="gray">Private</Badge>
          )}
        </div>
        {channel.description && (
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {channel.description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 text-xs text-text-muted">
        <Users className="h-3.5 w-3.5" />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ChannelsPage() {
  const navigate = useNavigate();
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listChannels(currentWorkspace?.id);
      setChannels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const filtered = channels.filter((ch) =>
    ch.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreated = (channel: Channel) => {
    setChannels((prev) => [channel, ...prev]);
  };

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Channels">
        <Button
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setModalOpen(true)}
        >
          New Channel
        </Button>
      </TopBar>

      {/* Search bar */}
      <div className="border-b border-border px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Filter channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-bg-tertiary pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" className="text-text-muted" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <p className="text-sm text-danger mb-3">{error}</p>
            <Button size="sm" variant="secondary" onClick={fetchChannels}>
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          search ? (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No matching channels"
              description={`No channels match "${search}". Try a different search term.`}
            />
          ) : (
            <EmptyState
              icon={<Hash className="h-8 w-8" />}
              title="No channels yet"
              description="Create a channel to start collaborating with your team."
              action={
                <Button
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setModalOpen(true)}
                >
                  Create Channel
                </Button>
              }
            />
          )
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((ch) => (
              <ChannelListItem
                key={ch.id}
                channel={ch}
                onClick={() => navigate(`/channels/${ch.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Channel Modal */}
      <NewChannelModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
