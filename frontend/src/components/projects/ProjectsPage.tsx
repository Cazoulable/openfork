import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Plus, LayoutGrid, ChevronDown, Building2 } from 'lucide-react';
import { TopBar } from '../layout/TopBar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { ProjectCard } from './ProjectCard';
import {
  listWorkspaces,
  createWorkspace,
  listProjects,
  createProject,
  type Workspace,
  type Project,
} from '../../api/projects';

// ---------------------------------------------------------------------------
// Workspace selector dropdown
// ---------------------------------------------------------------------------

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  selected: Workspace | null;
  onSelect: (ws: Workspace) => void;
  onCreateNew: () => void;
}

function WorkspaceSelector({ workspaces, selected, onSelect, onCreateNew }: WorkspaceSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Building2 className="h-4 w-4 text-text-muted" />
        <span className="max-w-[180px] truncate">{selected?.name ?? 'Select workspace'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
      </button>

      {open && (
        <>
          {/* Invisible backdrop to close dropdown */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-bg-secondary shadow-xl">
            <div className="max-h-60 overflow-y-auto p-1.5">
              {workspaces.length === 0 && (
                <p className="px-3 py-2 text-xs text-text-muted">No workspaces found</p>
              )}
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => { onSelect(ws); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                    ws.id === selected?.id
                      ? 'bg-accent/10 text-accent font-medium'
                      : 'text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <Building2 className="h-4 w-4 shrink-0 text-text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{ws.name}</p>
                    <p className="truncate text-xs text-text-muted font-mono">{ws.slug}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-border p-1.5">
              <button
                type="button"
                onClick={() => { onCreateNew(); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create workspace</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectsPage
// ---------------------------------------------------------------------------

export function ProjectsPage() {
  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingWs, setLoadingWs] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Modals
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  // Create workspace form
  const [wsName, setWsName] = useState('');
  const [wsSlug, setWsSlug] = useState('');
  const [wsCreating, setWsCreating] = useState(false);
  const [wsError, setWsError] = useState('');

  // Create project form
  const [projName, setProjName] = useState('');
  const [projPrefix, setProjPrefix] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projCreating, setProjCreating] = useState(false);
  const [projError, setProjError] = useState('');

  // Fetch workspaces on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingWs(true);
    listWorkspaces()
      .then((data) => {
        if (cancelled) return;
        setWorkspaces(data);
        if (data.length > 0) {
          setSelectedWs(data[0]);
        }
      })
      .catch(() => {
        // swallow
      })
      .finally(() => {
        if (!cancelled) setLoadingWs(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Fetch projects when workspace changes
  const fetchProjects = useCallback(async (wsId: string) => {
    setLoadingProjects(true);
    try {
      const data = await listProjects(wsId);
      setProjects(data);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if (selectedWs) {
      fetchProjects(selectedWs.id);
    } else {
      setProjects([]);
    }
  }, [selectedWs, fetchProjects]);

  // Create workspace handler
  const handleCreateWorkspace = async (e: FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || !wsSlug.trim()) return;
    setWsCreating(true);
    setWsError('');
    try {
      const ws = await createWorkspace({ name: wsName.trim(), slug: wsSlug.trim() });
      setWorkspaces((prev) => [...prev, ws]);
      setSelectedWs(ws);
      setShowCreateWs(false);
      setWsName('');
      setWsSlug('');
    } catch (err) {
      setWsError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setWsCreating(false);
    }
  };

  // Create project handler
  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedWs || !projName.trim() || !projPrefix.trim()) return;
    setProjCreating(true);
    setProjError('');
    try {
      const proj = await createProject(selectedWs.id, {
        name: projName.trim(),
        prefix: projPrefix.trim().toUpperCase(),
        description: projDesc.trim() || undefined,
      });
      setProjects((prev) => [...prev, proj]);
      setShowCreateProject(false);
      setProjName('');
      setProjPrefix('');
      setProjDesc('');
    } catch (err) {
      setProjError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setProjCreating(false);
    }
  };

  // Auto-generate slug from workspace name
  const handleWsNameChange = (val: string) => {
    setWsName(val);
    setWsSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };

  // Auto-generate prefix from project name
  const handleProjNameChange = (val: string) => {
    setProjName(val);
    const words = val.trim().split(/\s+/);
    if (words.length >= 2) {
      setProjPrefix(words.map((w) => w[0]).join('').toUpperCase().slice(0, 4));
    } else if (val.trim().length > 0) {
      setProjPrefix(val.trim().toUpperCase().slice(0, 3));
    } else {
      setProjPrefix('');
    }
  };

  // Loading state
  if (loadingWs) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Projects" />
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" className="text-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Projects">
        <Button
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setShowCreateProject(true)}
          disabled={!selectedWs}
        >
          New Project
        </Button>
      </TopBar>

      {/* Workspace selector bar */}
      <div className="flex items-center gap-4 border-b border-border bg-bg-primary px-6 py-3">
        <WorkspaceSelector
          workspaces={workspaces}
          selected={selectedWs}
          onSelect={setSelectedWs}
          onCreateNew={() => setShowCreateWs(true)}
        />
        {selectedWs && (
          <span className="text-xs text-text-muted">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedWs ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No workspace selected"
            description="Create a workspace to get started organizing your projects."
            action={
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateWs(true)}>
                Create Workspace
              </Button>
            }
          />
        ) : loadingProjects ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" className="text-accent" />
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<LayoutGrid className="h-8 w-8" />}
            title="No projects yet"
            description="Create your first project to start tracking issues and managing your work."
            action={
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateProject(true)}>
                Create Project
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      <Modal open={showCreateWs} onClose={() => setShowCreateWs(false)} title="Create Workspace">
        <form onSubmit={handleCreateWorkspace} className="flex flex-col gap-4">
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
          {wsError && <p className="text-sm text-danger">{wsError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowCreateWs(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={wsCreating}>
              Create Workspace
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Project Modal */}
      <Modal open={showCreateProject} onClose={() => setShowCreateProject(false)} title="Create Project">
        <form onSubmit={handleCreateProject} className="flex flex-col gap-4">
          <Input
            label="Project Name"
            placeholder="Frontend App"
            value={projName}
            onChange={(e) => handleProjNameChange(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Prefix"
            placeholder="FE"
            value={projPrefix}
            onChange={(e) => setProjPrefix(e.target.value.toUpperCase())}
            required
            maxLength={5}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Description</label>
            <textarea
              className="w-full rounded-lg border border-border bg-bg-tertiary px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent resize-none"
              rows={3}
              placeholder="What is this project about?"
              value={projDesc}
              onChange={(e) => setProjDesc(e.target.value)}
            />
          </div>
          {projError && <p className="text-sm text-danger">{projError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowCreateProject(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={projCreating}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
