import { useNavigate } from 'react-router-dom';
import { FolderKanban, ChevronRight } from 'lucide-react';
import type { Project } from '../../api/projects';

interface ProjectCardProps {
  project: Project;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.id}`)}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-bg-secondary p-5 text-left transition-all duration-150 hover:border-accent/40 hover:bg-bg-tertiary cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <FolderKanban className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
              {project.name}
            </h3>
            <p className="text-xs text-text-muted font-mono">{project.prefix}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {project.description && (
        <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      )}

      <div className="mt-auto flex items-center gap-3 pt-1 text-xs text-text-muted">
        <span>Created {formatDate(project.created_at)}</span>
      </div>
    </button>
  );
}
