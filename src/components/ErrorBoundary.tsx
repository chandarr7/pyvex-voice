import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#08090B] text-[#F4F2F8] flex items-center justify-center p-6 antialiased">
          <div className="max-w-md w-full bg-[#111216] border border-[#2B2D35] rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-[#F4F2F8]">Application Notice</h2>
            <p className="text-xs text-[#A4A3B2] leading-relaxed">
              The application encountered a transient runtime condition during module initialization.
            </p>
            {this.state.error && (
              <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-left text-[11px] font-mono text-amber-300/80 overflow-x-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-[#7047FF] hover:bg-[#5D35E8] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Tilted Studio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
