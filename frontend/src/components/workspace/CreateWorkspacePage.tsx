import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hexagon, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuthStore } from '../../stores/auth';
import { useWorkspaceStore } from '../../stores/workspace';
import { setTokens } from '../../api/client';
import { createWorkspace } from '../../api/workspaces';
import { registerWithWorkspace } from '../../api/auth';

const RESERVED_SLUGS = [
  'new', 'join', 'api', 'auth', 'admin', 'settings',
];

export function CreateWorkspacePage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

  // Step: 'workspace' | 'account'
  const [step, setStep] = useState<'workspace' | 'account'>('workspace');

  // Workspace fields
  const [wsName, setWsName] = useState('');
  const [wsSlug, setWsSlug] = useState('');
  const [wsError, setWsError] = useState('');

  // Account fields (only for unauthenticated users)
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  // Submission
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleNameChange = (val: string) => {
    setWsName(val);
    setWsSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    );
  };

  const handleNextStep = (e: FormEvent) => {
    e.preventDefault();
    setWsError('');

    if (!wsName.trim() || !wsSlug.trim()) return;

    const normalizedSlug = wsSlug.trim().toLowerCase();
    if (RESERVED_SLUGS.includes(normalizedSlug)) {
      setWsError(`"${normalizedSlug}" is a reserved name. Please choose a different slug.`);
      return;
    }

    if (isAuthenticated) {
      // Logged-in user: skip account step, create workspace directly
      handleCreateForAuthenticatedUser();
    } else {
      setStep('account');
    }
  };

  const handleCreateForAuthenticatedUser = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const ws = await createWorkspace({
        name: wsName.trim(),
        slug: wsSlug.trim().toLowerCase(),
      });
      setWorkspace(ws);
      navigate(`/${ws.slug}/projects`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace');
      setCreating(false);
    }
  };

  const handleCreateWithAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim() || !password) return;

    setCreating(true);
    setCreateError('');
    try {
      const res = await registerWithWorkspace({
        email: email.trim(),
        display_name: displayName.trim(),
        password,
        workspace_name: wsName.trim(),
        workspace_slug: wsSlug.trim().toLowerCase(),
      });
      setTokens(res.access_token, res.refresh_token);
      setUser(res.user);
      setWorkspace(res.workspace);
      navigate(`/${res.workspace.slug}/projects`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create workspace');
      setCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/25">
            <Hexagon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            {step === 'workspace' ? 'Create Workspace' : 'Create Your Account'}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {step === 'workspace'
              ? 'Set up a new workspace for your team'
              : 'Create the owner account for your workspace'}
          </p>

          {/* Step indicator */}
          {!isAuthenticated && (
            <div className="mt-4 flex items-center gap-2">
              <div className={`h-2 w-8 rounded-full transition-colors ${step === 'workspace' ? 'bg-accent' : 'bg-accent/30'}`} />
              <div className={`h-2 w-8 rounded-full transition-colors ${step === 'account' ? 'bg-accent' : 'bg-accent/30'}`} />
            </div>
          )}
        </div>

        {/* Step 1: Workspace info */}
        {step === 'workspace' && (
          <form
            onSubmit={handleNextStep}
            className="rounded-xl border border-border bg-bg-secondary p-6 shadow-xl"
          >
            <div className="space-y-4">
              <Input
                label="Workspace Name"
                placeholder="My Team"
                value={wsName}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                autoFocus
              />
              <Input
                label="Slug"
                placeholder="my-team"
                value={wsSlug}
                onChange={(e) => setWsSlug(e.target.value)}
                required
              />
              <p className="text-xs text-text-muted">
                Your workspace will be available at{' '}
                <span className="font-mono text-text-secondary">
                  {window.location.origin}/{wsSlug || 'my-team'}
                </span>
              </p>
            </div>

            {(wsError || createError) && (
              <div className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {wsError || createError}
              </div>
            )}

            <Button
              type="submit"
              loading={creating}
              className="mt-6 w-full"
              size="md"
              icon={!isAuthenticated ? <ArrowRight className="h-4 w-4" /> : undefined}
            >
              {isAuthenticated ? 'Create Workspace' : 'Next'}
            </Button>
          </form>
        )}

        {/* Step 2: Account info (unauthenticated users only) */}
        {step === 'account' && (
          <form
            onSubmit={handleCreateWithAccount}
            className="rounded-xl border border-border bg-bg-secondary p-6 shadow-xl"
          >
            <div className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
              <Input
                label="Display Name"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
              />
              <Input
                label="Password"
                type="password"
                placeholder="Choose a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            {createError && (
              <div className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {createError}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => { setStep('workspace'); setCreateError(''); }}
                icon={<ArrowLeft className="h-4 w-4" />}
                className="shrink-0"
              >
                Back
              </Button>
              <Button
                type="submit"
                loading={creating}
                className="flex-1"
                size="md"
              >
                Create Workspace
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
