import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-500 bg-red-50 border border-red-200 m-8 rounded-lg">
          <h1 className="text-xl font-bold mb-4">Something went wrong.</h1>
          <pre className="text-xs whitespace-pre-wrap">{this.state.error?.toString()}</pre>
          <pre className="text-xs whitespace-pre-wrap mt-4">{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
