import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Users } from 'lucide-react';
import { TopBar } from '../layout/TopBar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { Avatar } from '../ui/Avatar';
import * as api from '../../api/messaging';
import type { DmGroup } from '../../api/messaging';


// ---------------------------------------------------------------------------
// New DM Modal
// ---------------------------------------------------------------------------

interface NewDmModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (group: DmGroup) => void;
}

function NewDmModal({ open, onClose, onCreated }: NewDmModalProps) {
  const [userIds, setUserIds] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setUserIds('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ids = userIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      setError('Please enter at least one user ID');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const group = await api.createDmGroup(ids);
      onCreated(group);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="New Conversation">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="User IDs"
          placeholder="Enter user IDs separated by commas"
          value={userIds}
          onChange={(e) => setUserIds(e.target.value)}
          autoFocus
        />
        <p className="text-xs text-text-muted">
          Enter the user IDs of the people you want to message. Separate multiple IDs with commas.
        </p>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submitting}>
            Start Conversation
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// DM Group List Item
// ---------------------------------------------------------------------------

interface DmGroupItemProps {
  group: DmGroup;
  onClick: () => void;
}

function DmGroupItem({ group, onClick }: DmGroupItemProps) {
  const displayName = `Conversation ${group.id.slice(0, 8)}`;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-150 hover:bg-bg-hover cursor-pointer"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar displayName={displayName} size="md" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">
            {displayName}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-text-muted">
          Created {new Date(group.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="shrink-0 text-text-muted">
        <Users className="h-4 w-4" />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DmListPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<DmGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listDmGroups();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreated = (group: DmGroup) => {
    setGroups((prev) => [group, ...prev]);
    navigate(`/dm/${group.id}`);
  };

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Direct Messages">
        <Button
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setModalOpen(true)}
        >
          New Conversation
        </Button>
      </TopBar>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" className="text-text-muted" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <p className="text-sm text-danger mb-3">{error}</p>
            <Button size="sm" variant="secondary" onClick={fetchGroups}>
              Retry
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8" />}
            title="No conversations yet"
            description="Start a direct message with someone on your team."
            action={
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setModalOpen(true)}
              >
                Start Conversation
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border/50">
            {groups.map((g) => (
              <DmGroupItem
                key={g.id}
                group={g}
                onClick={() => navigate(`/dm/${g.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New DM Modal */}
      <NewDmModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
