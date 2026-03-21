import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Save, UserMinus, UserPlus, Link as LinkIcon, Copy, Check, Trash2, Plus, Clock } from 'lucide-react';
import { TopBar } from '../layout/TopBar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Spinner } from '../ui/Spinner';
import { Modal } from '../ui/Modal';
import { useWorkspaceStore } from '../../stores/workspace';
import {
  updateWorkspace,
  listMembers,
  inviteMember,
  removeMember,
  createInvite,
  listInvites,
  deleteInvite,
} from '../../api/workspaces';
import type { WorkspaceMemberInfo, WorkspaceRole, WorkspaceInvite, CreateInvitePayload } from '../../api/workspaces';

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
// Helpers
// ---------------------------------------------------------------------------

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const diff = exp - now;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) {
    const minutes = Math.max(1, Math.floor(diff / (1000 * 60)));
    return `Expires in ${minutes}m`;
  }
  if (hours < 24) return `Expires in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Expires in ${days}d`;
}

function formatUses(useCount: number, maxUses: number | null): string {
  if (maxUses === null) return `${useCount} uses, unlimited`;
  return `${useCount}/${maxUses} uses`;
}

function inviteLinkUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
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

  // Invite form (email-based)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Removing members
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Invite links
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create invite link modal
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [newInviteRole, setNewInviteRole] = useState<'member' | 'admin'>('member');
  const [newInviteMaxUses, setNewInviteMaxUses] = useState('');
  const [newInviteExpiry, setNewInviteExpiry] = useState('never');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [createInviteError, setCreateInviteError] = useState('');
  const [createdInvite, setCreatedInvite] = useState<WorkspaceInvite | null>(null);
  const [createdLinkCopied, setCreatedLinkCopied] = useState(false);

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

  // Fetch invite links
  const fetchInvites = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingInvites(true);
    setInvitesError(null);
    try {
      const data = await listInvites(workspaceId);
      setInvites(data);
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setLoadingInvites(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

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

  // Invite member (email-based)
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

  // Copy invite link to clipboard
  const handleCopyInviteLink = async (invite: WorkspaceInvite) => {
    try {
      await navigator.clipboard.writeText(inviteLinkUrl(invite.code));
      setCopiedInviteId(invite.id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch {
      // swallow
    }
  };

  // Delete invite link
  const handleDeleteInvite = async (inviteId: string) => {
    if (!workspaceId) return;
    setDeletingInviteId(inviteId);
    try {
      await deleteInvite(workspaceId, inviteId);
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    } catch {
      // swallow
    } finally {
      setDeletingInviteId(null);
      setConfirmDeleteId(null);
    }
  };

  // Create invite link
  const handleCreateInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    setCreatingInvite(true);
    setCreateInviteError('');
    try {
      const payload: CreateInvitePayload = {
        role: newInviteRole,
      };
      const maxUses = parseInt(newInviteMaxUses, 10);
      if (!isNaN(maxUses) && maxUses > 0) {
        payload.max_uses = maxUses;
      }
      if (newInviteExpiry !== 'never') {
        payload.expires_in_hours = parseInt(newInviteExpiry, 10);
      }
      const invite = await createInvite(workspaceId, payload);
      setCreatedInvite(invite);
      fetchInvites();
    } catch (err) {
      setCreateInviteError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyCreatedLink = async () => {
    if (!createdInvite) return;
    try {
      await navigator.clipboard.writeText(inviteLinkUrl(createdInvite.code));
      setCreatedLinkCopied(true);
      setTimeout(() => setCreatedLinkCopied(false), 2000);
    } catch {
      // swallow
    }
  };

  const resetCreateInviteModal = () => {
    setShowCreateInvite(false);
    setNewInviteRole('member');
    setNewInviteMaxUses('');
    setNewInviteExpiry('never');
    setCreateInviteError('');
    setCreatedInvite(null);
    setCreatedLinkCopied(false);
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

          {/* Invite Links Section */}
          {isAdminOrOwner && (
            <section className="rounded-xl border border-border bg-bg-secondary p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-text-primary">Invite Links</h2>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => setShowCreateInvite(true)}
                >
                  Create Invite Link
                </Button>
              </div>

              {loadingInvites ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" className="text-text-muted" />
                </div>
              ) : invitesError ? (
                <div className="flex flex-col items-center py-8">
                  <p className="text-sm text-danger mb-3">{invitesError}</p>
                  <Button size="sm" variant="secondary" onClick={fetchInvites}>
                    Retry
                  </Button>
                </div>
              ) : invites.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <div className="mb-3 rounded-xl bg-bg-tertiary p-3 text-text-muted">
                    <LinkIcon className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-text-muted">No invite links yet.</p>
                  <p className="text-xs text-text-muted mt-1">Create one to share with your team.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="rounded-lg border border-border/50 bg-bg-tertiary p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={roleBadgeVariant(invite.role)}>
                              {invite.role}
                            </Badge>
                            <span className="flex items-center gap-1 text-xs text-text-muted">
                              <Clock className="h-3 w-3" />
                              {formatExpiry(invite.expires_at)}
                            </span>
                            <span className="text-xs text-text-muted">
                              {formatUses(invite.use_count, invite.max_uses)}
                            </span>
                          </div>
                          <code className="block truncate rounded bg-bg-primary px-2.5 py-1.5 text-xs text-text-secondary font-mono">
                            {inviteLinkUrl(invite.code)}
                          </code>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={
                              copiedInviteId === invite.id ? (
                                <Check className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )
                            }
                            onClick={() => handleCopyInviteLink(invite)}
                          >
                            {copiedInviteId === invite.id ? 'Copied!' : 'Copy'}
                          </Button>
                          {confirmDeleteId === invite.id ? (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleDeleteInvite(invite.id)}
                                loading={deletingInviteId === invite.id}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="danger"
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              onClick={() => setConfirmDeleteId(invite.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

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

      {/* Create Invite Link Modal */}
      <Modal
        open={showCreateInvite}
        onClose={resetCreateInviteModal}
        title={createdInvite ? 'Invite Link Created' : 'Create Invite Link'}
      >
        {createdInvite ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Your invite link has been created. Share it with anyone you want to join this workspace.
            </p>
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <label className="block text-xs font-medium text-text-muted mb-2">Invite Link</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-bg-tertiary px-3 py-2 text-sm text-text-primary font-mono">
                  {inviteLinkUrl(createdInvite.code)}
                </code>
                <Button
                  size="sm"
                  icon={
                    createdLinkCopied ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )
                  }
                  onClick={handleCopyCreatedLink}
                >
                  {createdLinkCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
                <Badge variant={roleBadgeVariant(createdInvite.role)}>
                  {createdInvite.role}
                </Badge>
                <span>{formatUses(createdInvite.use_count, createdInvite.max_uses)}</span>
                <span>{formatExpiry(createdInvite.expires_at)}</span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={resetCreateInviteModal}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateInvite} className="flex flex-col gap-4">
            <Select
              label="Role"
              value={newInviteRole}
              onChange={(e) => setNewInviteRole(e.target.value as 'member' | 'admin')}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>

            <Input
              label="Max Uses"
              type="number"
              placeholder="Unlimited"
              value={newInviteMaxUses}
              onChange={(e) => setNewInviteMaxUses(e.target.value)}
              min={1}
            />

            <Select
              label="Expires"
              value={newInviteExpiry}
              onChange={(e) => setNewInviteExpiry(e.target.value)}
            >
              <option value="never">Never</option>
              <option value="24">24 hours</option>
              <option value="168">7 days</option>
              <option value="720">30 days</option>
            </Select>

            {createInviteError && (
              <p className="text-sm text-danger">{createInviteError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={resetCreateInviteModal}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                loading={creatingInvite}
                icon={<LinkIcon className="h-3.5 w-3.5" />}
              >
                Create Link
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
