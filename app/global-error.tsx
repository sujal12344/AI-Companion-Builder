'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-black text-white">
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center border border-red-500/30">
              <div className="text-4xl">🤖</div>
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-3">AI Companion Error</h2>
          <p className="text-gray-300 mb-6 max-w-md leading-relaxed">
            Our AI companion encountered an unexpected issue. Don&apos;t worry, we can get back on track.
          </p>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 max-w-md">
            <p className="text-sm text-red-400 font-mono">{error.message}</p>
          </div>
          <button
            onClick={reset}
            className="px-6 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-lg hover:from-sky-600 hover:to-cyan-600 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}