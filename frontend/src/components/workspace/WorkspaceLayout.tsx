import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Hexagon } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useWorkspaceStore } from '../../stores/workspace';
import { getWorkspaceBySlug } from '../../api/workspaces';
import { setTokens } from '../../api/client';
import * as authApi from '../../api/auth';
import { AppShell } from '../layout/AppShell';
import { Spinner } from '../ui/Spinner';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

// ---------------------------------------------------------------------------
// Inline login form shown when visiting /:slug without auth
// ---------------------------------------------------------------------------

function WorkspaceLoginForm({ slug }: { slug: string }) {
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(email, password);
      setTokens(res.access_token, res.refresh_token);
      setUser(res.user);
      // After setting auth state, WorkspaceLayout will re-render and fetch the workspace
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/25">
            <Hexagon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Sign in to {slug}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Enter your credentials to access this workspace
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-bg-secondary p-6 shadow-xl"
        >
          {error && (
            <div className="mb-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

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
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            loading={loading}
            className="mt-6 w-full"
            size="md"
          >
            Sign In
          </Button>

          <p className="mt-5 text-center text-sm text-text-muted">
            Don&apos;t have an account?{' '}
            <Link
              to="/new"
              className="font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Create a workspace
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceLayout — resolves workspace from URL slug
// ---------------------------------------------------------------------------

export function WorkspaceLayout() {
  const { slug } = useParams<{ slug: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const logout = useAuthStore((s) => s.logout);
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

  const [error, setError] = useState<string | null>(null);
  const [fetchedForUser, setFetchedForUser] = useState<string | null>(null);

  // Workspace is ready only if it was fetched for the current user
  const isReady = currentWorkspace?.slug === slug && fetchedForUser === userId;

  // Always re-fetch when slug or user changes
  useEffect(() => {
    if (!slug || !isAuthenticated || !userId) return;
    // Skip if already fetched for this user + slug combo
    if (isReady) return;

    setError(null);
    let cancelled = false;

    getWorkspaceBySlug(slug)
      .then((ws) => {
        if (!cancelled) {
          setWorkspace(ws);
          setFetchedForUser(userId);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Workspace not found');
      });

    return () => { cancelled = true; };
  }, [slug, isAuthenticated, userId, isReady, setWorkspace]);

  // Not authenticated — show inline login form
  if (!isAuthenticated) {
    return <WorkspaceLoginForm slug={slug ?? ''} />;
  }

  // Authenticated but no access — offer to sign in with another account
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/25">
              <Hexagon className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Can&apos;t access workspace</h1>
          <p className="text-sm text-text-muted mb-6">
            Your current account doesn&apos;t have access to &ldquo;{slug}&rdquo;.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button size="sm" onClick={() => logout()}>
              Sign in with a different account
            </Button>
            <Link
              to="/new"
              className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              or create a new workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <Spinner size="lg" className="text-accent" />
      </div>
    );
  }

  return <AppShell />;
}
