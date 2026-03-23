import { useState, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutGrid,
  MessageSquare,
  Settings,
  LogOut,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspaceStore } from '../../stores/workspace';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}

interface SidebarProps {
  pinned: boolean;
  onToggle: () => void;
}

export function Sidebar({ pinned, onToggle }: SidebarProps) {
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);

  const slug = currentWorkspace?.slug ?? '';

  const navItems: NavItem[] = [
    {
      to: `/${slug}/projects`,
      icon: <LayoutGrid className="h-5 w-5 shrink-0" />,
      label: 'Tasks',
      description: 'Projects, issues & tracking',
    },
    {
      to: `/${slug}/channels`,
      icon: <MessageSquare className="h-5 w-5 shrink-0" />,
      label: 'Chat',
      description: 'Channels & direct messages',
    },
  ];

  const showSettings =
    currentWorkspace?.role === 'owner' || currentWorkspace?.role === 'admin';

  if (showSettings) {
    navItems.push({
      to: `/${slug}/settings`,
      icon: <Settings className="h-5 w-5 shrink-0" />,
      label: 'Admin',
      description: 'Workspace settings',
    });
  }

  const handleLogout = () => {
    logout();
  };

  const showTooltip = useCallback((label: string, el: HTMLElement) => {
    if (pinned) return;
    tooltipTimer.current = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setTooltip({ label, top: rect.top + rect.height / 2 });
    }, 400);
  }, [pinned]);

  const hideTooltip = useCallback(() => {
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
    setTooltip(null);
  }, []);

  const expanded = pinned;
  const workspaceName = currentWorkspace?.name ?? 'Workspace';
  const workspaceInitial = workspaceName.charAt(0).toUpperCase();

  return (
    <>
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-bg-secondary transition-all duration-200 ease-in-out',
          expanded ? 'w-40' : 'w-14',
        )}
      >
        {/* Workspace identity */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex h-14 items-center gap-3 border-b border-border px-3.5 cursor-pointer hover:bg-bg-hover transition-colors"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white font-bold text-xs">
            {workspaceInitial}
          </div>
          {expanded && (
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold text-text-primary whitespace-nowrap">
                {workspaceName}
              </span>
            </div>
          )}
        </button>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onMouseEnter={(e) => showTooltip(item.description, e.currentTarget)}
              onMouseLeave={hideTooltip}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )
              }
            >
              {item.icon}
              {expanded && (
                <span className="whitespace-nowrap">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Toggle + user section */}
        <div className="border-t border-border p-2 space-y-1">
          {/* Toggle button */}
          <button
            onClick={() => { onToggle(); hideTooltip(); }}
            onMouseEnter={(e) => showTooltip(pinned ? 'Collapse sidebar' : 'Expand sidebar', e.currentTarget)}
            onMouseLeave={hideTooltip}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
          >
            {pinned
              ? <PanelLeftClose className="h-5 w-5 shrink-0" />
              : <PanelLeftOpen className="h-5 w-5 shrink-0" />
            }
            {expanded && (
              <span className="whitespace-nowrap">Collapse</span>
            )}
          </button>

          {/* User */}
          <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
            <div
              onMouseEnter={(e) => showTooltip(user?.display_name || 'User', e.currentTarget)}
              onMouseLeave={hideTooltip}
            >
              <Avatar displayName={user?.display_name || 'User'} size="sm" />
            </div>
            {expanded && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {user?.display_name || 'User'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-danger cursor-pointer transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Tooltip (shown when sidebar is collapsed and hovering a nav item) */}
      {!pinned && tooltip && (
        <div
          className="fixed z-50 left-[60px] -translate-y-1/2 rounded-lg bg-bg-tertiary border border-border px-3 py-1.5 text-xs text-text-primary shadow-lg pointer-events-none whitespace-nowrap"
          style={{ top: tooltip.top }}
        >
          {tooltip.label}
        </div>
      )}
    </>
  );
}
