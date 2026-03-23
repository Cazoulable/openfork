import { Component, type ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
          <div className="w-full max-w-md text-center">
            <h1 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h1>
            <p className="text-sm text-text-muted mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <pre className="mb-6 max-h-40 overflow-auto rounded-lg bg-bg-secondary border border-border p-3 text-left text-xs text-text-secondary">
              {this.state.error?.stack}
            </pre>
            <Button
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
