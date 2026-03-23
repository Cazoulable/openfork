import { Routes, Route, Navigate } from 'react-router-dom';

import { CreateWorkspacePage } from './components/workspace/CreateWorkspacePage';
import { WorkspaceLayout } from './components/workspace/WorkspaceLayout';
import { WorkspaceSettingsPage } from './components/workspace/WorkspaceSettingsPage';
import { JoinWorkspacePage } from './components/workspace/JoinWorkspacePage';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { ProjectDetailPage } from './components/projects/ProjectDetailPage';
import { IssueDetailPage } from './components/projects/IssueDetailPage';
import { MessagingLayout } from './components/messaging/MessagingLayout';
import { ChannelDetailPage } from './components/messaging/ChannelDetailPage';
import { DmDetailPage } from './components/messaging/DmDetailPage';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/new" element={<CreateWorkspacePage />} />
      <Route path="/join/:code" element={<JoinWorkspacePage />} />

      {/* Root — redirect to /new for now */}
      <Route path="/" element={<Navigate to="/new" replace />} />

      {/* Workspace routes — auth + membership handled by WorkspaceLayout */}
      <Route path="/:slug" element={<WorkspaceLayout />}>
        <Route index element={<Navigate to="projects" replace />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="issues/:id" element={<IssueDetailPage />} />
        <Route path="channels" element={<MessagingLayout />}>
          <Route index element={null} />
          <Route path=":id" element={<ChannelDetailPage />} />
        </Route>
        <Route path="dm" element={<MessagingLayout />}>
          <Route index element={null} />
          <Route path=":id" element={<DmDetailPage />} />
        </Route>
        <Route path="settings" element={<WorkspaceSettingsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/new" replace />} />
    </Routes>
  );
}

export default App;
