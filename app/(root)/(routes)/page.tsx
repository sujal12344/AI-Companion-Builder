import { Suspense } from "react";

import SearchInput from "@/components/SearchInput";
import Categories from "@/components/Categories";
import prismadb from "@/lib/prismadb";
import Companions from "@/components/Companions";
import CompanionSkeleton from "@/components/companionsSkeleton";
import { CompanionErrorBoundary } from "@/components/ErrorBoundaryWrapper";
import ServerErrorFallback from "@/components/ServerErrorFallback";
import errorResponse from "@/lib/errorResponse";

interface rootPageProps {
  searchParams: Promise<{
    categoryId: string;
    name: string;
  }>;
}

const RootPage = async ({ searchParams }: rootPageProps) => {
  try {
    const { categoryId, name } = await searchParams;

    const [data, categories] = await Promise.all([
      prismadb.companion.findMany({
        where: {
          categoryId,
          name
        },
        orderBy: {
          createdAt: "desc", // Changed to desc for newest first
        },
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
        },
        take: 50, // Limit results for better performance
      }),
      prismadb.category.findMany({
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    return (
      <div className="p-4 space-y-2">
        <SearchInput />
        <Categories data={categories} />
        <CompanionErrorBoundary>
          <Suspense fallback={<CompanionSkeleton />}>
            <Companions data={data} />
          </Suspense>
        </CompanionErrorBoundary>
      </div>
    );
  } catch (error) {
    errorResponse(error);

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
