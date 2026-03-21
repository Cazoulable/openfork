import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Plus, LayoutGrid } from 'lucide-react';
import { TopBar } from '../layout/TopBar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { ProjectCard } from './ProjectCard';
import { useWorkspaceStore } from '../../stores/workspace';
import {
  listProjects,
  createProject,
} from '../../api/projects';
import type { Project } from '../../api/projects';

// ---------------------------------------------------------------------------
// ProjectsPage
// ---------------------------------------------------------------------------

export function ProjectsPage() {
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Create project modal
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projName, setProjName] = useState('');
  const [projSlug, setProjSlug] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projCreating, setProjCreating] = useState(false);
  const [projError, setProjError] = useState('');

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const data = await listProjects();
      // Filter to current workspace
      if (currentWorkspace) {
        setProjects(data.filter((p) => p.workspace_id === currentWorkspace.id));
      } else {
        setProjects(data);
      }
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Create project handler
  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !projName.trim() || !projSlug.trim()) return;
    setProjCreating(true);
    setProjError('');
    try {
      const proj = await createProject({
        workspace_id: currentWorkspace.id,
        name: projName.trim(),
        slug: projSlug.trim().toLowerCase(),
        description: projDesc.trim() || undefined,
      });
      setProjects((prev) => [...prev, proj]);
      setShowCreateProject(false);
      setProjName('');
      setProjSlug('');
      setProjDesc('');
    } catch (err) {
      setProjError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setProjCreating(false);
    }
  };

  // Auto-generate slug from project name
  const handleProjNameChange = (val: string) => {
    setProjName(val);
    setProjSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Projects">
        <Button
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setShowCreateProject(true)}
        >
          New Project
        </Button>
      </TopBar>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loadingProjects ? (
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
            label="Slug"
            placeholder="frontend-app"
            value={projSlug}
            onChange={(e) => setProjSlug(e.target.value.toLowerCase())}
            required
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
