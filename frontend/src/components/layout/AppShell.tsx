import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const [sidebarPinned, setSidebarPinned] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar pinned={sidebarPinned} onToggle={() => setSidebarPinned(!sidebarPinned)} />
      <main
        className={clsx(
          'flex flex-1 flex-col transition-[margin] duration-200 ease-in-out',
          sidebarPinned ? 'ml-40' : 'ml-14',
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
