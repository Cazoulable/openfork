import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutGrid,
  MessageSquare,
  Settings,
  LogOut,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspaceStore } from '../../stores/workspace';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);

  const navItems: NavItem[] = [
    {
      to: '/projects',
      icon: <LayoutGrid className="h-5 w-5 shrink-0" />,
      label: 'Project Tracking',
    },
    {
      to: '/channels',
      icon: <MessageSquare className="h-5 w-5 shrink-0" />,
      label: 'Messaging',
    },
  ];

  // Show workspace settings only for admin/owner
  const showSettings =
    currentWorkspace?.role === 'owner' || currentWorkspace?.role === 'admin';

  if (showSettings) {
    navItems.push({
      to: '/workspace/settings',
      icon: <Settings className="h-5 w-5 shrink-0" />,
      label: 'Workspace Settings',
    });
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const workspaceName = currentWorkspace?.name ?? 'Workspace';
  const workspaceInitial = workspaceName.charAt(0).toUpperCase();

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={clsx(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-bg-secondary transition-all duration-300 ease-in-out',
        expanded ? 'w-56' : 'w-14',
      )}
    >
      {/* Workspace identity */}
      <button
        type="button"
        onClick={() => navigate('/workspace')}
        className="flex h-14 items-center gap-3 border-b border-border px-3.5 cursor-pointer hover:bg-bg-hover transition-colors"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white font-bold text-xs">
          {workspaceInitial}
        </div>
        <div
          className={clsx(
            'min-w-0 transition-opacity duration-200',
            expanded ? 'opacity-100' : 'opacity-0',
          )}
        >
          <span className="block truncate text-sm font-bold text-text-primary whitespace-nowrap">
            {workspaceName}
          </span>
          <span className="block text-[10px] text-text-muted whitespace-nowrap">by OpenFork</span>
        </div>
      </button>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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
            <span
              className={clsx(
                'whitespace-nowrap transition-opacity duration-200',
                expanded ? 'opacity-100' : 'opacity-0',
              )}
            >
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
          <Avatar displayName={user?.display_name || 'User'} size="sm" />
          <div
            className={clsx(
              'flex-1 min-w-0 transition-opacity duration-200',
              expanded ? 'opacity-100' : 'opacity-0',
            )}
          >
            <p className="truncate text-sm font-medium text-text-primary">
              {user?.display_name || 'User'}
            </p>
            <p className="truncate text-xs text-text-muted">
              {user?.email || ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className={clsx(
              'shrink-0 rounded-md p-1.5 text-text-muted transition-all duration-200 hover:bg-bg-hover hover:text-danger cursor-pointer',
              expanded ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
