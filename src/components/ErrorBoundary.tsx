import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 p-8 bg-background">
          <div className="text-3xl">⚠️</div>
          <p className="text-sm font-display font-bold text-foreground">
            {this.props.fallbackMessage || 'Something went wrong'}
          </p>
          <p className="text-[11px] text-muted-foreground max-w-md text-center">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:brightness-105 active:scale-[0.97] transition-all"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
