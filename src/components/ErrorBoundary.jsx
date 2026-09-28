import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <AlertTriangle size={28} strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Something went wrong</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            We&apos;ve encountered an unexpected error.
          </p>
          
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary gap-2"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/';
              }}
              className="btn-secondary"
            >
              Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
