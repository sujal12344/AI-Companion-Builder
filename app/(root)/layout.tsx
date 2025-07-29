import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { checkSubscription } from "@/lib/subscription";
import SafeLayout from "@/components/SafeLayout";

import { Suspense } from "react";
import {
  RootErrorBoundary,
  NavbarErrorBoundary,
  SidebarErrorBoundary,
  ContentErrorBoundary
} from "@/components/ErrorBoundaryWrapper";

// Loading components
const NavbarSkeleton = () => (
  <div className="w-full h-16 bg-secondary border-b border-primary/10 animate-pulse">
    <div className="flex items-center justify-between h-full px-4">
      <div className="flex items-center gap-3">
        {/* Mobile menu skeleton */}
        <div className="w-6 h-6 bg-muted/50 rounded md:hidden" />
        {/* Logo skeleton */}
        <div className="w-10 h-10 bg-gradient-to-br from-sky-500/20 to-cyan-500/20 rounded-lg border border-sky-500/30" />
        {/* Brand name skeleton */}
        <div className="hidden sm:block">
          <div className="h-6 w-32 bg-muted/50 rounded-md" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Upgrade button skeleton */}
        <div className="hidden sm:block h-8 w-20 bg-gradient-to-r from-sky-500/20 to-cyan-500/20 rounded-full border border-sky-500/30" />
        {/* Mode toggle skeleton */}
        <div className="w-8 h-8 bg-muted/50 rounded-md" />
        {/* User button skeleton */}
        <div className="w-8 h-8 bg-muted/50 rounded-full" />
      </div>
    </div>
  </div>
);

const SidebarSkeleton = () => (
  <div className="w-20 h-full bg-secondary border-r border-primary/10 animate-pulse">
    <div className="flex flex-col items-center py-4 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 p-3 w-full">
          <div className="w-5 h-5 bg-muted/50 rounded" />
          <div className="w-12 h-2 bg-muted/30 rounded" />
        </div>
      ))}
    </div>
  </div>
);

const ContentSkeleton = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="relative">
        <div className="w-16 h-16 bg-gradient-to-br from-sky-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-sky-500/30">
          <div className="text-2xl animate-bounce">🤖</div>
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-sky-500/30 border-t-sky-500 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-primary font-medium">Loading AI Companion</p>
        <p className="text-muted-foreground text-sm">Preparing your experience...</p>
      </div>
    </div>
  )
}

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  let isPro = false;

  try {
    isPro = await checkSubscription();
  } catch (error) {
    console.error('Error checking subscription:', error);
    // Continue with isPro = false as fallback
  }

  return (
    <SafeLayout>
      <RootErrorBoundary>
        <div className="h-full">
          {/* Navbar with error boundary and suspense */}
          <NavbarErrorBoundary>
            <Suspense fallback={<NavbarSkeleton />}>
              <Navbar isPro={isPro} />
            </Suspense>
          </NavbarErrorBoundary>

          {/* Sidebar with error boundary and suspense */}
          <div className="hidden md:flex mt-16 w-20 flex-col fixed inset-y-0">
            <SidebarErrorBoundary>
              <Suspense fallback={<SidebarSkeleton />}>
                <Sidebar isPro={isPro} />
              </Suspense>
            </SidebarErrorBoundary>
          </div>

          {/* Main content with error boundary */}
          <main className="md:pl-20 pt-16 dark:bg-black bg-white">
            <ContentErrorBoundary>
              <Suspense fallback={<ContentSkeleton />}>
                {children}
              </Suspense>
            </ContentErrorBoundary>
          </main>
        </div>
      </RootErrorBoundary>
    </SafeLayout>
  );
};

export default RootLayout;
