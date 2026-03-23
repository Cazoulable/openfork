-- Seed data: Sandbox workspace with owner and member accounts
-- owner@gmail.com / owner123
-- member1@gmail.com / member1_123

INSERT INTO users (id, email, display_name, password_hash) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'owner@gmail.com', 'Owner',
   '$argon2id$v=19$m=19456,t=2,p=1$dG3MtjxQStX15uRGDUwmKA$eNGr914i7PhclmV/nxoqXZqvRl5J/NtZ8rL2Wz7PO8c'),
  ('a0000000-0000-0000-0000-000000000002', 'member1@gmail.com', 'Member 1',
   '$argon2id$v=19$m=19456,t=2,p=1$RlwOPmdJvYEPVJwco37WfA$qUbE+qxPvOdT6mSzb28TBL5EWMib2M/UNNETNKVglxU')
ON CONFLICT (email) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Sandbox', 'sandbox')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'member')
ON CONFLICT (workspace_id, user_id) DO NOTHING;
