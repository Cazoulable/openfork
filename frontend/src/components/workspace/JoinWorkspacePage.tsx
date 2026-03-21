import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Hexagon, LogIn, UserPlus, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspaceStore } from '../../stores/workspace';
import { joinViaInvite } from '../../api/workspaces';

const REDIRECT_KEY = 'openfork_join_redirect';

export function JoinWorkspacePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // On mount, if not logged in, store this URL for post-login redirect
  useEffect(() => {
    if (!user && code) {
      localStorage.setItem(REDIRECT_KEY, `/join/${code}`);
    }
  }, [user, code]);

  // On mount, if user just logged in and was redirected here, auto-clear the stored redirect
  useEffect(() => {
    if (user) {
      localStorage.removeItem(REDIRECT_KEY);
    }
  }, [user]);

  const handleJoin = async () => {
    if (!code) return;
    setJoining(true);
    setError(null);
    try {
      const ws = await joinViaInvite(code);
      setWorkspace(ws);
      setSuccess(true);
      setTimeout(() => {
        navigate('/projects');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join workspace');
    } finally {
      setJoining(false);
    }
  };

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
        <div className="text-center">
          <p className="text-sm text-danger">Invalid invite link.</p>
          <Link to="/login" className="mt-3 inline-block text-sm font-medium text-accent hover:text-accent-hover transition-colors">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      {/* Subtle background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/25">
            <Hexagon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Join Workspace</h1>
          <p className="mt-1 text-sm text-text-muted">
            You have been invited to join a workspace
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-bg-secondary p-6 shadow-xl">
          {user ? (
            // Logged in state
            success ? (
              <div className="flex flex-col items-center py-4">
                <div className="mb-4 rounded-full bg-success/10 p-3">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">
                  You're in!
                </h2>
                <p className="text-sm text-text-muted mb-4">
                  Redirecting you to your projects...
                </p>
                <Spinner size="sm" className="text-accent" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center py-4">
                <div className="mb-4 rounded-full bg-danger/10 p-3">
                  <XCircle className="h-8 w-8 text-danger" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">
                  Unable to join
                </h2>
                <p className="text-sm text-danger mb-5 text-center">{error}</p>
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate('/workspace')}
                  >
                    Go to Workspaces
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setError(null);
                      handleJoin();
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-4">
                <p className="text-sm text-text-secondary mb-2">
                  Signed in as <span className="font-medium text-text-primary">{user.email}</span>
                </p>
                <p className="text-sm text-text-muted mb-6">
                  Click below to accept this invitation.
                </p>
                <Button
                  size="md"
                  onClick={handleJoin}
                  loading={joining}
                  icon={<LogIn className="h-4 w-4" />}
                  className="w-full"
                >
                  Join Workspace
                </Button>
              </div>
            )
          ) : (
            // Not logged in state
            <div className="flex flex-col items-center py-4">
              <p className="text-sm text-text-secondary mb-6 text-center">
                You need an account to join this workspace. Sign in or create an account to continue.
              </p>
              <div className="flex flex-col gap-3 w-full">
                <Button
                  size="md"
                  onClick={() => navigate('/login')}
                  icon={<LogIn className="h-4 w-4" />}
                  className="w-full"
                >
                  Sign In
                </Button>
                <Button
                  size="md"
                  variant="secondary"
                  onClick={() => navigate('/register')}
                  icon={<UserPlus className="h-4 w-4" />}
                  className="w-full"
                >
                  Create Account
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
