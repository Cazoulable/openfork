import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Hexagon } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';

export function LoginPage() {
  const { login, isLoading, error, clearError, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) {
    const postLoginRedirect = localStorage.getItem('openfork_post_login_redirect')
      ?? localStorage.getItem('openfork_join_redirect');
    if (postLoginRedirect) {
      localStorage.removeItem('openfork_post_login_redirect');
      localStorage.removeItem('openfork_join_redirect');
      return <Navigate to={postLoginRedirect} replace />;
    }
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email, password);
  };

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
          <h1 className="text-2xl font-bold text-text-primary">OpenFork</h1>
          <p className="mt-1 text-sm text-text-muted">Sign in to your workspace</p>
        </div>

        {/* Card */}
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
            loading={isLoading}
            className="mt-6 w-full"
            size="md"
          >
            Sign In
          </Button>

          <p className="mt-5 text-center text-sm text-text-muted">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
