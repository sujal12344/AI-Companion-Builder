'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center border border-red-500/30">
          <div className="text-2xl">🤖</div>
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">!</span>
        </div>
      </div>
      <h2 className="text-xl font-semibold text-primary mb-3">Something went wrong!</h2>
      <p className="text-muted-foreground mb-4 max-w-sm">
        We encountered an error while loading this page.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-lg hover:from-sky-600 hover:to-cyan-600 transition-all duration-200 font-medium"
      >
        Try again
      </button>
    </div>
  );
}