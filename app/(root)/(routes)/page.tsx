import { Suspense } from "react";
import prismadb from "@/lib/prismadb";
import CompanionsFeed from "@/components/CompanionsFeed";
import CompanionSkeleton from "@/components/companionsSkeleton";
import { CompanionErrorBoundary } from "@/components/ErrorBoundaryWrapper";
import ServerErrorFallback from "@/components/ServerErrorFallback";
import SearchInput from "@/components/SearchInput";
import { auth } from "@clerk/nextjs/server";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface rootPageProps {
  searchParams: Promise<{
    name?: string;
  }>;
}

const RootPage = async ({ searchParams }: rootPageProps) => {
  try {
    const { name } = await searchParams;
    const { userId } = await auth();

    const data = await prismadb.companion.findMany({
      orderBy: {
        createdAt: "desc", // Newest first
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
      take: 100, // Load up to 100 companions for instant client filtering
    });

    return (
      <div className="p-4 space-y-2">
        <CompanionErrorBoundary>
          <Suspense fallback={<CompanionSkeleton />}>
            <CompanionsFeed
              initialData={data}
              userId={userId}
              initialName={name}
            />
          </Suspense>
        </CompanionErrorBoundary>
      </div>
    );
  } catch (error) {
    console.error("Database error:", error);

    // Return a fallback UI for server-side errors
    return (
      <div className="p-4 space-y-2">
        <SearchInput />
        <ServerErrorFallback
          error="Database connection failed"
          title="Service Temporarily Unavailable"
          description="We're experiencing technical difficulties. Please try again in a few moments."
        />
      </div>
    );
  }
};

export default RootPage;
