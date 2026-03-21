import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useWorkspaceStore } from './stores/workspace';

import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { AppShell } from './components/layout/AppShell';
import { WorkspaceSelectPage } from './components/workspace/WorkspaceSelectPage';
import { WorkspaceSettingsPage } from './components/workspace/WorkspaceSettingsPage';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { ProjectDetailPage } from './components/projects/ProjectDetailPage';
import { IssueDetailPage } from './components/projects/IssueDetailPage';
import { ChannelsPage } from './components/messaging/ChannelsPage';
import { ChannelDetailPage } from './components/messaging/ChannelDetailPage';
import { DmListPage } from './components/messaging/DmListPage';
import { DmDetailPage } from './components/messaging/DmDetailPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function WorkspaceGuard() {
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  if (!currentWorkspace) {
    return <Navigate to="/workspace" replace />;
  }
  return <Outlet />;
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected: workspace selection (standalone layout, no AppShell) */}
      <Route
        path="/workspace"
        element={
          <ProtectedRoute>
            <WorkspaceSelectPage />
          </ProtectedRoute>
        }
      />

      {/* Protected + workspace required routes */}
      <Route
        element={
          <ProtectedRoute>
            <WorkspaceGuard />
          </ProtectedRoute>
        }
      >
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="issues/:id" element={<IssueDetailPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="channels/:id" element={<ChannelDetailPage />} />
          <Route path="dm" element={<DmListPage />} />
          <Route path="dm/:id" element={<DmDetailPage />} />
          <Route path="workspace/settings" element={<WorkspaceSettingsPage />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
