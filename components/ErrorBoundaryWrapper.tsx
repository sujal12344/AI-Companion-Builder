"use client";

import { ErrorBoundary } from "react-error-boundary";
import { ReactNode } from "react";

// Error fallback components
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-secondary">
    <div className="relative mb-6">
      <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center border border-red-500/30">
        <div className="text-4xl">🤖</div>
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
        <span className="text-white text-xs">!</span>
      </div>
    </div>
    <h2 className="text-2xl font-bold text-primary mb-3">AI Companion Error</h2>
    <p className="text-muted-foreground mb-6 max-w-md leading-relaxed">
      Our AI companion encountered an unexpected issue. Don&apos;t worry, we can get back on track.
    </p>
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6 max-w-md">
      <p className="text-sm text-destructive font-mono">{error.message}</p>
    </div>
    <button
      onClick={resetErrorBoundary}
      className="px-6 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-lg hover:from-sky-600 hover:to-cyan-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
    >
      Restart Companion
    </button>
  </div>
);

const NavbarErrorFallback = ({ resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="w-full h-16 bg-secondary border-b border-primary/10 flex items-center justify-center">
    <div className="flex items-center gap-3 text-muted-foreground">
      <div className="w-8 h-8 bg-destructive/20 rounded-full flex items-center justify-center">
        <span className="text-destructive text-sm">⚠</span>
      </div>
      <span className="text-sm">Navigation temporarily unavailable</span>
      <button
        onClick={resetErrorBoundary}
        className="text-xs px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
      >
        Retry
      </button>
    </div>
  </div>
);

const SidebarErrorFallback = ({ resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="w-20 h-full bg-secondary border-r border-primary/10 flex flex-col items-center justify-center">
    <div className="flex flex-col items-center gap-2 text-muted-foreground">
      <div className="w-10 h-10 bg-destructive/20 rounded-lg flex items-center justify-center">
        <span className="text-destructive text-lg">⚠</span>
      </div>
      <button
        onClick={resetErrorBoundary}
        className="text-xs px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
        title="Retry sidebar"
      >
        Retry
      </button>
    </div>
  </div>
);

const ContentErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
    <div className="relative mb-6">
      <div className="w-16 h-16 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full flex items-center justify-center border border-orange-500/30">
        <div className="text-2xl">🔧</div>
      </div>
    </div>
    <h3 className="text-xl font-semibold text-primary mb-3">Content Loading Failed</h3>
    <p className="text-muted-foreground mb-4 max-w-sm">
      We&apos;re having trouble loading this content. Let&apos;s try again.
    </p>
    <div className="bg-muted/50 border border-border rounded-lg p-3 mb-6 max-w-sm">
      <p className="text-xs text-muted-foreground font-mono">{error.message}</p>
    </div>
    <button
      onClick={resetErrorBoundary}
      className="px-5 py-2 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-lg hover:from-sky-600 hover:to-cyan-600 transition-all duration-200 font-medium"
    >
      Reload Content
    </button>
  </div>
);

const CompanionErrorFallback = ({ resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
    <div className="relative mb-6">
      <div className="w-16 h-16 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full flex items-center justify-center border border-orange-500/30">
        <div className="text-2xl">🔧</div>
      </div>
    </div>
    <h3 className="text-xl font-semibold text-primary mb-3">Companion Loading Failed</h3>
    <p className="text-muted-foreground mb-4 max-w-sm">
      We&apos;re having trouble loading this content. Let&apos;s try again.
    </p>
    <button
      onClick={resetErrorBoundary}
      className="px-5 py-2 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-lg hover:from-sky-600 hover:to-cyan-600 transition-all duration-200 font-medium"
    >
      Reload Companion
    </button>
  </div>
);

// Wrapper components
export const RootErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    FallbackComponent={ErrorFallback}
    onError={(error, errorInfo) => {
      console.error('Root layout error:', error, errorInfo);
    }}
  >
    {children}
  </ErrorBoundary>
);

export const NavbarErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    FallbackComponent={NavbarErrorFallback}
    onError={(error) => console.error('Navbar error:', error)}
  >
    {children}
  </ErrorBoundary>
);

export const SidebarErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    FallbackComponent={SidebarErrorFallback}
    onError={(error) => console.error('Sidebar error:', error)}
  >
    {children}
  </ErrorBoundary>
);

export const ContentErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    FallbackComponent={ContentErrorFallback}
    onError={(error) => console.error('Main content error:', error)}
  >
    {children}
  </ErrorBoundary>
);

export const CompanionErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    FallbackComponent={CompanionErrorFallback}
    onError={(error) => console.error('Companion error:', error)}
  >
    {children}
  </ErrorBoundary>
);