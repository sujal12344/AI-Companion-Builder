import { Suspense } from "react";

import SearchInput from "@/components/SearchInput";
import Categories from "@/components/Categories";
import prismadb from "@/lib/prismadb";
import Companions from "@/components/Companions";
import CompanionSkeleton from "@/components/companionsSkeleton";
import { CompanionErrorBoundary } from "@/components/ErrorBoundaryWrapper";
import ServerErrorFallback from "@/components/ServerErrorFallback";

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

interface rootPageProps {
  searchParams: Promise<{
    categoryId: string;
    name: string;
  }>;
}

const RootPage = async ({ searchParams }: rootPageProps) => {
  try {
    const { categoryId, name } = await searchParams;

    // Build the where clause more efficiently
    const whereClause: any = {};

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (name) {
      whereClause.name = {
        search: name,
      };
    }

    // Run both queries in parallel for better performance
    const [data, categories] = await Promise.all([
      prismadb.companion.findMany({
        where: whereClause,
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
    console.error('Database error in RootPage:', error);

    // Return a fallback UI for server-side errors
    return (
      <div className="p-4 space-y-2">
        <SearchInput />
        <ServerErrorFallback
          error="Database connection failed"
          title="Service Temporarily Unavailable"
          description="We&apos;re experiencing technical difficulties. Please try again in a few moments."
        />
      </div>
    );
  }
};

export default RootPage;
