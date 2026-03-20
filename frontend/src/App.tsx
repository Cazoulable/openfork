import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { AppShell } from './components/layout/AppShell';
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

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="issues/:id" element={<IssueDetailPage />} />
        <Route path="channels" element={<ChannelsPage />} />
        <Route path="channels/:id" element={<ChannelDetailPage />} />
        <Route path="dm" element={<DmListPage />} />
        <Route path="dm/:id" element={<DmDetailPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
