import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar />
      {/* Main content area, offset by sidebar collapsed width */}
      <main className="ml-14 flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
