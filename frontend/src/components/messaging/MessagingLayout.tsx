import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Hash,
  Lock,
  Plus,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Search,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Avatar } from '../ui/Avatar';
import { useWorkspaceStore } from '../../stores/workspace';
import * as api from '../../api/messaging';
import type { Channel, DmGroup } from '../../api/messaging';

// ---------------------------------------------------------------------------
// New Channel Modal (extracted from ChannelsPage)
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

        {error && <p className="text-xs text-danger">{error}</p>}

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
// New DM Modal (extracted from DmListPage)
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
// Search results dropdown
// ---------------------------------------------------------------------------

interface SearchResult {
  type: 'channel' | 'dm' | 'message';
  id: string;
  label: string;
  sublabel?: string;
  navigateTo: string;
}

// ---------------------------------------------------------------------------
// MessagingLayout
// ---------------------------------------------------------------------------

export function MessagingLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);

  // Determine active item from URL
  const pathParts = location.pathname.split('/');
  // URL pattern: /:slug/channels/:id or /:slug/dm/:id
  const isChannelRoute = pathParts.includes('channels');
  const isDmRoute = pathParts.includes('dm');
  const activeId = pathParts[pathParts.length - 1];
  const hasActiveItem = (isChannelRoute || isDmRoute) && activeId !== 'channels' && activeId !== 'dm';

  // Data state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dmGroups, setDmGroups] = useState<DmGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Collapsible sections
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);

  // Modals
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [dmModalOpen, setDmModalOpen] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch channels + DM groups
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [chans, dms] = await Promise.all([
        api.listChannels(currentWorkspace?.id),
        api.listDmGroups(),
      ]);
      setChannels(chans);
      setDmGroups(dms);
    } catch (err) {
      console.error('Failed to load messaging data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search logic (debounced)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    if (searchTimer.current) clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results: SearchResult[] = [];

      // Filter channels by name
      const q = searchQuery.toLowerCase();
      for (const ch of channels) {
        if (ch.name.toLowerCase().includes(q)) {
          results.push({
            type: 'channel',
            id: ch.id,
            label: `# ${ch.name}`,
            sublabel: ch.description || undefined,
            navigateTo: `/${slug}/channels/${ch.id}`,
          });
        }
      }

      // Filter DMs
      for (const dm of dmGroups) {
        const dmName = `Conversation ${dm.id.slice(0, 8)}`;
        if (dmName.toLowerCase().includes(q)) {
          results.push({
            type: 'dm',
            id: dm.id,
            label: dmName,
            navigateTo: `/${slug}/dm/${dm.id}`,
          });
        }
      }

      // Search message content
      try {
        const msgs = await api.searchMessages(searchQuery, 0, 5);
        for (const msg of msgs) {
          results.push({
            type: 'message',
            id: msg.id,
            label: msg.body.length > 60 ? msg.body.slice(0, 60) + '...' : msg.body,
            sublabel: `in channel`,
            navigateTo: `/${slug}/channels/${msg.channel_id}`,
          });
        }
      } catch {
        // search may not be available
      }

      setSearchResults(results);
      setSearchOpen(results.length > 0);
      setSearching(false);
    }, 300);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery, channels, dmGroups, slug]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchResultClick = (result: SearchResult) => {
    navigate(result.navigateTo);
    setSearchQuery('');
    setSearchOpen(false);
  };

  const handleChannelCreated = (channel: Channel) => {
    setChannels((prev) => [channel, ...prev]);
    navigate(`/${slug}/channels/${channel.id}`);
  };

  const handleDmCreated = (group: DmGroup) => {
    setDmGroups((prev) => [group, ...prev]);
    navigate(`/${slug}/dm/${group.id}`);
  };

  return (
    <div className="flex flex-1 flex-col h-full">
      {/* Top bar with centered search */}
      <header className="flex h-14 shrink-0 items-center justify-center border-b border-border bg-bg-secondary/50 px-6 backdrop-blur-sm">
        <div ref={searchRef} className="relative w-full max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search channels, people, messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
            className="h-9 w-full rounded-lg border border-border bg-bg-tertiary pl-9 pr-9 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Search results dropdown */}
          {searchOpen && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-bg-secondary shadow-xl">
              {searching ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" className="text-text-muted" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-text-muted">No results found</p>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSearchResultClick(result)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-hover transition-colors cursor-pointer"
                  >
                    <div className="shrink-0 text-text-muted">
                      {result.type === 'channel' && <Hash className="h-4 w-4" />}
                      {result.type === 'dm' && <MessageSquare className="h-4 w-4" />}
                      {result.type === 'message' && <Search className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">{result.label}</p>
                      {result.sublabel && (
                        <p className="truncate text-xs text-text-muted">{result.sublabel}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main content: sidebar + chat */}
      <div className="flex flex-1 overflow-hidden">
        {/* Channel / DM sidebar */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-bg-secondary overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner size="md" className="text-text-muted" />
            </div>
          ) : (
            <>
              {/* Channels section */}
              <div className="px-2 pt-3">
                <div className="flex items-center justify-between px-2 py-1">
                  <button
                    onClick={() => setChannelsOpen(!channelsOpen)}
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  >
                    {channelsOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Channels
                  </button>
                  <button
                    onClick={() => setChannelModalOpen(true)}
                    className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                    title="New channel"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {channelsOpen && (
                  <div className="mt-1 space-y-0.5">
                    {channels.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-text-muted">No channels yet</p>
                    ) : (
                      channels.map((ch) => {
                        const isActive = isChannelRoute && activeId === ch.id;
                        return (
                          <button
                            key={ch.id}
                            onClick={() => navigate(`/${slug}/channels/${ch.id}`)}
                            className={clsx(
                              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer',
                              isActive
                                ? 'bg-accent/10 text-accent font-medium'
                                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                            )}
                          >
                            {ch.is_private ? (
                              <Lock className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <Hash className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate">{ch.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Direct Messages section */}
              <div className="px-2 pt-4 pb-3">
                <div className="flex items-center justify-between px-2 py-1">
                  <button
                    onClick={() => setDmsOpen(!dmsOpen)}
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  >
                    {dmsOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Direct Messages
                  </button>
                  <button
                    onClick={() => setDmModalOpen(true)}
                    className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                    title="New conversation"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {dmsOpen && (
                  <div className="mt-1 space-y-0.5">
                    {dmGroups.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-text-muted">No conversations yet</p>
                    ) : (
                      dmGroups.map((dm) => {
                        const isActive = isDmRoute && activeId === dm.id;
                        const dmName = `Conversation ${dm.id.slice(0, 8)}`;
                        return (
                          <button
                            key={dm.id}
                            onClick={() => navigate(`/${slug}/dm/${dm.id}`)}
                            className={clsx(
                              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer',
                              isActive
                                ? 'bg-accent/10 text-accent font-medium'
                                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                            )}
                          >
                            <Avatar displayName={dmName} size="sm" />
                            <span className="truncate">{dmName}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {hasActiveItem ? (
            <Outlet />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-text-muted/50 mb-3" />
                <h2 className="text-lg font-semibold text-text-primary mb-1">
                  Select a conversation
                </h2>
                <p className="text-sm text-text-muted">
                  Pick a channel or direct message from the sidebar to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <NewChannelModal
        open={channelModalOpen}
        onClose={() => setChannelModalOpen(false)}
        onCreated={handleChannelCreated}
      />
      <NewDmModal
        open={dmModalOpen}
        onClose={() => setDmModalOpen(false)}
        onCreated={handleDmCreated}
      />
    </div>
  );
}
