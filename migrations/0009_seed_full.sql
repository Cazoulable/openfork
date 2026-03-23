-- =============================================================================
-- Full seed data for development (mirrors seeds/*.yaml)
-- Adds: member2, Zero workspace, rich Chat & Tasks data for Sandbox
-- =============================================================================

-- ── User aliases (readable UUIDs) ──
-- a0..01 = Alice (owner@gmail.com)       — already in 0007
-- a0..02 = Bob   (member1@gmail.com)     — already in 0007
-- a0..03 = Charlie (member2@gmail.com)   — NEW
-- a0..04 = Zero Admin (zero@gmail.com)   — NEW

-- ── Update display names set by 0007 ──
UPDATE users SET display_name = 'Alice Chen'    WHERE id = 'a0000000-0000-0000-0000-000000000001';
UPDATE users SET display_name = 'Bob Martinez'  WHERE id = 'a0000000-0000-0000-0000-000000000002';

-- ── New users ──
INSERT INTO users (id, email, display_name, password_hash) VALUES
  ('a0000000-0000-0000-0000-000000000003', 'member2@gmail.com', 'Charlie Kim',
   '$argon2id$v=19$m=19456,t=2,p=1$cBN/Zcu4IXt4TGsZnQuRuQ$jm3bzTY3cQTsIn6DWbB1Ok0sic0hAcbT7wic2zbWpoo'),
  ('a0000000-0000-0000-0000-000000000004', 'zero@gmail.com', 'Zero Admin',
   '$argon2id$v=19$m=19456,t=2,p=1$kFKOO5c2UJEaSmFeZroy+w$Y31JksGdVMynhJlcJhGUCzJ2xBjP4uRfpy3dMCC7R3s')
ON CONFLICT (email) DO NOTHING;

-- ── Sandbox workspace: add Charlie as member ──
INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'member')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ── Zero workspace ──
INSERT INTO workspaces (id, name, slug) VALUES
  ('b0000000-0000-0000-0000-000000000002', 'Zero', 'zero')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'owner')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- =============================================================================
-- CHAT — Channels, messages, threads, reactions, DMs
-- =============================================================================

-- ── Clean up any user-created channels that would conflict with seed UUIDs ──
DELETE FROM channels
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000001'
  AND slug IN ('general', 'random', 'engineering')
  AND id NOT IN (
    'e0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000003'
  );

-- ── Channels ──
INSERT INTO channels (id, name, slug, description, is_private, creator_id, workspace_id) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'general',     'general',     'Workspace-wide announcements and discussion', false, 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', 'random',      'random',      'Off-topic conversations',                     false, 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003', 'engineering', 'engineering', 'Technical discussions and architecture',       false, 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- ── Channel members (all three users in all channels) ──
INSERT INTO channel_members (channel_id, user_id) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003')
ON CONFLICT (channel_id, user_id) DO NOTHING;

-- ── #general messages ──
INSERT INTO messages (id, channel_id, author_id, thread_id, body, created_at) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL,
   'Welcome to the Sandbox workspace! This is our main communication hub.',
   '2026-03-20 09:00:00+00'),
  -- thread replies to first message
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000001',
   'Hey everyone! Great to be here.',
   '2026-03-20 09:05:00+00'),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000001',
   'Thanks for the invite! Looking forward to working together.',
   '2026-03-20 09:10:00+00'),

  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', NULL,
   'Quick reminder — please use #engineering for technical discussions and #random for everything else.',
   '2026-03-20 10:00:00+00'),

  ('f0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', NULL,
   'Has anyone looked at the new Tasks module? Pretty slick.',
   '2026-03-20 14:00:00+00'),
  -- thread replies
  ('f0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000005',
   'Yes! I''ve already created a couple of projects. Check out the Tasks tab.',
   '2026-03-20 14:10:00+00'),
  ('f0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000005',
   'Nice, will take a look.',
   '2026-03-20 14:15:00+00')
ON CONFLICT (id) DO NOTHING;

-- ── #random messages ──
INSERT INTO messages (id, channel_id, author_id, thread_id, body, created_at) VALUES
  ('f0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', NULL,
   'Anyone up for coffee?',
   '2026-03-20 11:00:00+00'),
  ('f0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', NULL,
   'Always! Meet in 5?',
   '2026-03-20 11:02:00+00'),
  ('f0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', NULL,
   'Count me in!',
   '2026-03-20 11:03:00+00')
ON CONFLICT (id) DO NOTHING;

-- ── #engineering messages ──
INSERT INTO messages (id, channel_id, author_id, thread_id, body, created_at) VALUES
  ('f0000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', NULL,
   'Let''s discuss the API architecture for the new features.',
   '2026-03-21 09:00:00+00'),
  ('f0000000-0000-0000-0000-000000000021', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', NULL,
   'I think we should use REST for CRUD and WebSockets for real-time updates.',
   '2026-03-21 09:15:00+00'),
  ('f0000000-0000-0000-0000-000000000022', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', NULL,
   'Agree. I can start on the WebSocket implementation.',
   '2026-03-21 09:30:00+00'),
  -- thread reply
  ('f0000000-0000-0000-0000-000000000023', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000022',
   'That would be great. Let''s sync tomorrow morning.',
   '2026-03-21 09:35:00+00'),
  ('f0000000-0000-0000-0000-000000000024', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', NULL,
   'FYI — I''ve updated the database schema. Please pull latest.',
   '2026-03-21 15:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ── Reactions ──
INSERT INTO reactions (id, message_id, user_id, emoji) VALUES
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'wave'),
  ('aa000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'wave'),
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'thumbsup'),
  ('aa000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'thumbsup'),
  ('aa000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000002', 'coffee'),
  ('aa000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'coffee'),
  ('aa000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000002', 'rocket'),
  ('aa000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000002', 'eyes'),
  ('aa000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000024', 'a0000000-0000-0000-0000-000000000003', 'eyes')
ON CONFLICT (message_id, user_id, emoji) DO NOTHING;

-- ── DM group: Alice <-> Bob ──
INSERT INTO direct_message_groups (id) VALUES
  ('30000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO direct_message_members (group_id, user_id) VALUES
  ('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO direct_messages (id, group_id, author_id, body, created_at) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Hey Bob, can you review the PR for the auth module?', '2026-03-21 10:00:00+00'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'Sure, I''ll take a look this afternoon.', '2026-03-21 10:15:00+00'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Thanks! No rush, just when you get a chance.', '2026-03-21 10:20:00+00')
ON CONFLICT (id) DO NOTHING;

-- ── DM group: Bob <-> Charlie ──
INSERT INTO direct_message_groups (id) VALUES
  ('30000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO direct_message_members (group_id, user_id) VALUES
  ('30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO direct_messages (id, group_id, author_id, body, created_at) VALUES
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002',
   'Charlie, are you free to pair on the WebSocket stuff later?', '2026-03-21 13:00:00+00'),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003',
   'Yeah, 3pm works for me.', '2026-03-21 13:05:00+00')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TASKS — Projects, issues, labels, comments
-- =============================================================================

-- ── Projects ──
INSERT INTO projects (id, workspace_id, name, slug, description) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'Website Redesign', 'website-redesign', 'Complete overhaul of the company website with a modern design system.'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
   'Mobile App', 'mobile-app', 'Cross-platform mobile application using React Native.')
ON CONFLICT (workspace_id, slug) DO NOTHING;

-- ── Labels (per-project) ──
INSERT INTO labels (id, project_id, name, color) VALUES
  -- Website Redesign labels
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'bug',           '#ef4444'),
  ('10000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'feature',       '#3b82f6'),
  ('10000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'improvement',   '#8b5cf6'),
  ('10000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'documentation', '#6b7280'),
  -- Mobile App labels
  ('10000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002', 'bug',           '#ef4444'),
  ('10000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000002', 'feature',       '#3b82f6'),
  ('10000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000002', 'improvement',   '#8b5cf6'),
  ('10000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000002', 'documentation', '#6b7280')
ON CONFLICT (project_id, name) DO NOTHING;

-- ── Issues — Website Redesign ──
INSERT INTO issues (id, project_id, title, description, status, priority, assignee_id, creator_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Redesign homepage layout',
   'Create a new responsive layout for the homepage with improved hero section.',
   'in_progress', 'high',
   'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),

  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'Update color scheme to new brand guidelines', NULL,
   'done', 'medium',
   'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),

  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001',
   'Fix navigation dropdown on mobile',
   'The dropdown menu clips off-screen on viewports narrower than 375px.',
   'todo', 'high',
   'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002'),

  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001',
   'Add dark mode support',
   'Implement a theme toggle that respects system preference.',
   'backlog', 'low',
   NULL, 'a0000000-0000-0000-0000-000000000003'),

  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001',
   'Write onboarding documentation', NULL,
   'done', 'medium',
   'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ── Issues — Mobile App ──
INSERT INTO issues (id, project_id, title, description, status, priority, assignee_id, creator_id) VALUES
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000002',
   'Set up React Native project structure', NULL,
   'done', 'high',
   'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),

  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000002',
   'Implement user authentication flow',
   'Login, registration, and token refresh using the existing API.',
   'in_progress', 'high',
   'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),

  ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000002',
   'Design app icon and splash screen', NULL,
   'backlog', 'low',
   NULL, 'a0000000-0000-0000-0000-000000000003'),

  ('d0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000002',
   'Push notification integration',
   'Support for FCM (Android) and APNs (iOS).',
   'todo', 'medium',
   NULL, 'a0000000-0000-0000-0000-000000000002'),

  ('d0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000002',
   'Fix crash on login screen',
   'App crashes when submitting empty credentials on iOS 17.',
   'todo', 'urgent',
   'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- ── Issue labels ──
INSERT INTO issue_labels (issue_id, label_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003'),  -- homepage: improvement
  ('d0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003'),  -- color scheme: improvement
  ('d0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001'),  -- nav dropdown: bug
  ('d0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002'),  -- dark mode: feature
  ('d0000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000004'),  -- onboarding: documentation
  ('d0000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000012'),  -- auth flow: feature
  ('d0000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000012'),  -- push: feature
  ('d0000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000011')   -- crash: bug
ON CONFLICT (issue_id, label_id) DO NOTHING;

-- ── Comments ──
INSERT INTO comments (id, issue_id, author_id, body, created_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'I started working on the wireframes. Should have something to show by Friday.',
   '2026-03-21 11:00:00+00'),
  ('20000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Looking forward to it! Let me know if you need design assets.',
   '2026-03-21 11:30:00+00'),
  ('20000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000003',
   'Found the bug — it''s a null pointer in the token validation logic.',
   '2026-03-22 09:00:00+00'),
  ('20000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001',
   'Great catch! Can you submit a PR?',
   '2026-03-22 09:15:00+00')
ON CONFLICT (id) DO NOTHING;
