"use client";

import { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

const LayoutErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="min-h-screen bg-secondary flex flex-col items-center justify-center p-8 text-center">
    <div className="relative mb-6">
      <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center border border-red-500/30">
        <div className="text-4xl">🤖</div>
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
        <span className="text-white text-xs">!</span>
      </div>
    </div>
    <h2 className="text-2xl font-bold text-primary mb-3">Application Error</h2>
    <p className="text-muted-foreground mb-6 max-w-md leading-relaxed">
      Something went wrong while loading the application. This might be a temporary issue.
    </p>
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6 max-w-md">
      <p className="text-sm text-destructive font-mono">{error.message}</p>
    </div>
    <div className="flex gap-3">
      <button
        onClick={resetErrorBoundary}
        className="px-6 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-lg hover:from-sky-600 hover:to-cyan-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
      >
        Try Again
      </button>
      <button
        onClick={() => window.location.href = '/'}
        className="px-6 py-3 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-all duration-200 font-medium"
      >
        Go Home
      </button>
    </div>
  </div>
);

interface SafeLayoutProps {
  children: ReactNode;
}

const SafeLayout = ({ children }: SafeLayoutProps) => {
  return (
    <ErrorBoundary
      FallbackComponent={LayoutErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Layout error:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

export default SafeLayout;