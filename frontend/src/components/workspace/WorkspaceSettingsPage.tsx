import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Save, UserMinus, UserPlus } from 'lucide-react';
import { TopBar } from '../layout/TopBar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Spinner } from '../ui/Spinner';
import { useWorkspaceStore } from '../../stores/workspace';
import {
  updateWorkspace,
  listMembers,
  inviteMember,
  removeMember,
} from '../../api/workspaces';
import type { WorkspaceMemberInfo, WorkspaceRole } from '../../api/workspaces';

// ---------------------------------------------------------------------------
// Role badge variant mapping
// ---------------------------------------------------------------------------

const roleVariant: Record<string, 'blue' | 'orange' | 'gray'> = {
  owner: 'orange',
  admin: 'blue',
  member: 'gray',
};

function roleBadgeVariant(role: string) {
  return roleVariant[role] ?? 'gray';
}

// ---------------------------------------------------------------------------
// WorkspaceSettingsPage
// ---------------------------------------------------------------------------

export function WorkspaceSettingsPage() {
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

  // Workspace name editing
  const [name, setName] = useState(currentWorkspace?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Members
  const [members, setMembers] = useState<WorkspaceMemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Removing members
  const [removingId, setRemovingId] = useState<string | null>(null);

  const workspaceId = currentWorkspace?.id ?? '';

  // Sync name when workspace changes
  useEffect(() => {
    setName(currentWorkspace?.name ?? '');
  }, [currentWorkspace?.name]);

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingMembers(true);
    setMembersError(null);
    try {
      const data = await listMembers(workspaceId);
      setMembers(data);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoadingMembers(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Save workspace name
  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !name.trim()) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await updateWorkspace(workspaceId, { name: name.trim() });
      if (currentWorkspace) {
        setWorkspace({ ...currentWorkspace, name: updated.name });
      }
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Invite member
  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      await inviteMember(workspaceId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteSuccess(`Invited ${inviteEmail.trim()}`);
      setInviteEmail('');
      fetchMembers();
      setTimeout(() => setInviteSuccess(''), 3000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setInviting(false);
    }
  };

  // Remove member
  const handleRemove = async (userId: string) => {
    if (!workspaceId) return;
    setRemovingId(userId);
    try {
      await removeMember(workspaceId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch {
      // swallow
    } finally {
      setRemovingId(null);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="flex flex-1 flex-col">
        <TopBar title="Workspace Settings" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-text-muted">No workspace selected.</p>
        </div>
      </div>
    );
  }

  const isAdminOrOwner =
    currentWorkspace.role === 'owner' || currentWorkspace.role === 'admin';

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Workspace Settings" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Workspace Name Section */}
          <section className="rounded-xl border border-border bg-bg-secondary p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">General</h2>
            <form onSubmit={handleSaveName} className="flex items-end gap-3">
              <Input
                label="Workspace Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                wrapperClassName="flex-1"
                disabled={!isAdminOrOwner}
              />
              {isAdminOrOwner && (
                <Button
                  type="submit"
                  size="sm"
                  loading={saving}
                  icon={<Save className="h-4 w-4" />}
                >
                  Save
                </Button>
              )}
            </form>
            {saveMsg && (
              <p className={`mt-2 text-xs ${saveMsg === 'Saved' ? 'text-success' : 'text-danger'}`}>
                {saveMsg}
              </p>
            )}
          </section>

          {/* Members Section */}
          <section className="rounded-xl border border-border bg-bg-secondary p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">Members</h2>

            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" className="text-text-muted" />
              </div>
            ) : membersError ? (
              <div className="flex flex-col items-center py-8">
                <p className="text-sm text-danger mb-3">{membersError}</p>
                <Button size="sm" variant="secondary" onClick={fetchMembers}>
                  Retry
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <Avatar displayName={member.display_name || member.email} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {member.display_name || member.email}
                        </span>
                        <Badge variant={roleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-text-muted">{member.email}</p>
                    </div>
                    {isAdminOrOwner && member.role !== 'owner' && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<UserMinus className="h-3.5 w-3.5" />}
                        onClick={() => handleRemove(member.user_id)}
                        loading={removingId === member.user_id}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Invite Member Section */}
          {isAdminOrOwner && (
            <section className="rounded-xl border border-border bg-bg-secondary p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4">Invite Member</h2>
              <form onSubmit={handleInvite} className="flex items-end gap-3">
                <Input
                  label="Email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  wrapperClassName="flex-1"
                  required
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-secondary">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                    className="h-[42px] rounded-lg border border-border bg-bg-tertiary px-3 text-sm text-text-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  loading={inviting}
                  icon={<UserPlus className="h-4 w-4" />}
                >
                  Invite
                </Button>
              </form>
              {inviteError && <p className="mt-2 text-xs text-danger">{inviteError}</p>}
              {inviteSuccess && <p className="mt-2 text-xs text-success">{inviteSuccess}</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
