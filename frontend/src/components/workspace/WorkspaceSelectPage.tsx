import { useState, useEffect, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Hexagon, Plus, Building2, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspaceStore } from '../../stores/workspace';
import { listMyWorkspaces, createWorkspace } from '../../api/workspaces';
import type { WorkspaceWithRole } from '../../api/workspaces';

// ---------------------------------------------------------------------------
// Role badge variant mapping
// ---------------------------------------------------------------------------

const roleVariant: Record<string, 'blue' | 'orange' | 'gray'> = {
  owner: 'orange',
  admin: 'blue',
  member: 'gray',
};

function roleBadgeVariant(role: string) {
  return roleVariant[role] ?? 'gray';
}

// ---------------------------------------------------------------------------
// WorkspaceSelectPage
// ---------------------------------------------------------------------------

export function WorkspaceSelectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create workspace modal
  const [showCreate, setShowCreate] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsSlug, setWsSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Fetch workspaces on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listMyWorkspaces()
      .then((data) => {
        if (!cancelled) setWorkspaces(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workspaces');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSelect = (ws: WorkspaceWithRole) => {
    setWorkspace(ws);
    navigate(`/${ws.slug}/projects`);
  };

  const handleWsNameChange = (val: string) => {
    setWsName(val);
    setWsSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    );
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || !wsSlug.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const ws = await createWorkspace({
        name: wsName.trim(),
        slug: wsSlug.trim(),
      });
      setWorkspace(ws);
      navigate(`/${ws.slug}/projects`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const hasWorkspaces = workspaces.length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      {/* Subtle background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/25">
            <Hexagon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            {hasWorkspaces ? 'Select a workspace' : 'Create your first workspace'}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {hasWorkspaces
              ? 'Choose a workspace to continue'
              : 'Workspaces help you organize projects and collaborate with your team'}
          </p>
        </div>

        {/* Content card */}
        <div className="rounded-xl border border-border bg-bg-secondary shadow-xl">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" className="text-accent" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center px-6 py-12">
              <p className="text-sm text-danger mb-3">{error}</p>
              <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : hasWorkspaces ? (
            <>
              {/* Workspace list */}
              <div className="max-h-80 overflow-y-auto p-2">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => handleSelect(ws)}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-150 hover:bg-bg-hover cursor-pointer"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent font-bold text-sm">
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {ws.name}
                        </span>
                        <Badge variant={roleBadgeVariant(ws.role)}>
                          {ws.role}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-muted font-mono">
                        {ws.slug}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
                  </button>
                ))}
              </div>

              {/* Create new workspace button */}
              <div className="border-t border-border p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setShowCreate(true)}
                  className="w-full justify-center"
                >
                  Create Workspace
                </Button>
              </div>
            </>
          ) : (
            /* No workspaces — prompt to create */
            <div className="flex flex-col items-center justify-center px-6 py-12">
              <div className="mb-4 rounded-xl bg-bg-tertiary p-4 text-text-muted">
                <Building2 className="h-8 w-8" />
              </div>
              <p className="text-sm text-text-muted mb-5">
                You don't belong to any workspace yet.
              </p>
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setShowCreate(true)}
              >
                Create Workspace
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create Workspace Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Workspace">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Workspace Name"
            placeholder="My Team"
            value={wsName}
            onChange={(e) => handleWsNameChange(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Slug"
            placeholder="my-team"
            value={wsSlug}
            onChange={(e) => setWsSlug(e.target.value)}
            required
          />
          {createError && <p className="text-sm text-danger">{createError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={creating}>
              Create Workspace
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
