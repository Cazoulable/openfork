import { useState, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Hexagon, CheckCircle2, XCircle, LogIn, UserPlus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { useAuthStore } from '../../stores/auth';
import { useWorkspaceStore } from '../../stores/workspace';
import { setTokens } from '../../api/client';
import * as authApi from '../../api/auth';
import { joinViaInvite } from '../../api/workspaces';

export function JoinWorkspacePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

  // Tabs for unauthenticated users
  const [tab, setTab] = useState<'register' | 'login'>('register');

  // Register fields
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [joinedSlug, setJoinedSlug] = useState<string | null>(null);

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
        <div className="text-center">
          <p className="text-sm text-danger">Invalid invite link.</p>
          <Link to="/new" className="mt-3 inline-block text-sm font-medium text-accent hover:text-accent-hover transition-colors">
            Create a workspace
          </Link>
        </div>
      </div>
    );
  }

  const handleRegisterAndJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim() || !password) return;

    setLoading(true);
    setError(null);
    try {
      // Step 1: Create account
      const res = await authApi.register(email.trim(), displayName.trim(), password);
      setTokens(res.access_token, res.refresh_token);
      setUser(res.user);

      // Step 2: Join workspace via invite
      const ws = await joinViaInvite(code);
      setWorkspace(ws);
      setJoinedSlug(ws.slug);
      setSuccess(true);
      setTimeout(() => navigate(`/${ws.slug}/projects`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginAndJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;

    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(loginEmail.trim(), loginPassword);
      setTokens(res.access_token, res.refresh_token);
      setUser(res.user);

      const ws = await joinViaInvite(code);
      setWorkspace(ws);
      setJoinedSlug(ws.slug);
      setSuccess(true);
      setTimeout(() => navigate(`/${ws.slug}/projects`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinAuthenticated = async () => {
    setLoading(true);
    setError(null);
    try {
      const ws = await joinViaInvite(code);
      setWorkspace(ws);
      setJoinedSlug(ws.slug);
      setSuccess(true);
      setTimeout(() => navigate(`/${ws.slug}/projects`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join workspace');
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
          <h1 className="text-2xl font-bold text-text-primary">Join Workspace</h1>
          <p className="mt-1 text-sm text-text-muted">
            You have been invited to join a workspace
          </p>
        </div>

        <div className="rounded-xl border border-border bg-bg-secondary p-6 shadow-xl">
          {success ? (
            <div className="flex flex-col items-center py-4">
              <div className="mb-4 rounded-full bg-success/10 p-3">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-1">You&apos;re in!</h2>
              <p className="text-sm text-text-muted mb-4">Redirecting to your workspace...</p>
              <Spinner size="sm" className="text-accent" />
            </div>
          ) : isAuthenticated ? (
            /* Already logged in — just show join button */
            error ? (
              <div className="flex flex-col items-center py-4">
                <div className="mb-4 rounded-full bg-danger/10 p-3">
                  <XCircle className="h-8 w-8 text-danger" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">Unable to join</h2>
                <p className="text-sm text-danger mb-5 text-center">{error}</p>
                <Button size="sm" onClick={() => { setError(null); handleJoinAuthenticated(); }}>
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-4">
                <p className="text-sm text-text-muted mb-6">
                  Click below to accept this invitation.
                </p>
                <Button
                  size="md"
                  onClick={handleJoinAuthenticated}
                  loading={loading}
                  icon={<LogIn className="h-4 w-4" />}
                  className="w-full"
                >
                  Join Workspace
                </Button>
              </div>
            )
          ) : (
            /* Not logged in — show register/login tabs */
            <>
              {/* Tab switcher */}
              <div className="flex mb-5 rounded-lg bg-bg-tertiary p-1">
                <button
                  type="button"
                  onClick={() => { setTab('register'); setError(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    tab === 'register'
                      ? 'bg-bg-secondary text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    tab === 'login'
                      ? 'bg-bg-secondary text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              {tab === 'register' ? (
                <form onSubmit={handleRegisterAndJoin}>
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
                  <Button
                    type="submit"
                    loading={loading}
                    className="mt-6 w-full"
                    size="md"
                  >
                    Create Account &amp; Join
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleLoginAndJoin}>
                  <div className="space-y-4">
                    <Input
                      label="Email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoComplete="email"
                      autoFocus
                    />
                    <Input
                      label="Password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
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
                    Sign In &amp; Join
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
