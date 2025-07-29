"use client";

interface ServerErrorFallbackProps {
  error?: string;
  title?: string;
  description?: string;
}

const ServerErrorFallback = ({
  error = "Server Error",
  title = "Something went wrong",
  description = "We're experiencing technical difficulties. Please try again later."
}: ServerErrorFallbackProps) => {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center border border-red-500/30">
          <div className="text-2xl">🤖</div>
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">!</span>
        </div>
      </div>
      <h3 className="text-xl font-semibold text-primary mb-3">{title}</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        {description}
      </p>
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-6 max-w-sm">
        <p className="text-xs text-destructive font-mono">{error}</p>
      </div>
      <button
        onClick={handleRefresh}
        className="px-5 py-2 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-lg hover:from-sky-600 hover:to-cyan-600 transition-all duration-200 font-medium"
      >
        Refresh Page
      </button>
    </div>
  );
};

export default ServerErrorFallback;