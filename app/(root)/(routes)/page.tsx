import { Suspense } from "react";

import SearchInput from "@/components/SearchInput";
import Categories from "@/components/Categories";
import prismadb from "@/lib/prismadb";
import Companions from "@/components/Companions";
import CompanionSkeleton from "@/components/companionsSkeleton";
import { CompanionErrorBoundary } from "@/components/ErrorBoundaryWrapper";
import ServerErrorFallback from "@/components/ServerErrorFallback";

interface rootPageProps {
  searchParams: {
    categoryId: string;
    name: string;
  };
}

const RootPage = async ({ searchParams }: rootPageProps) => {
  try {
    const data = await prismadb.companion.findMany({
      where: {
        categoryId: searchParams.categoryId,
        name: {
          search: searchParams.name,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    const categories = await prismadb.category.findMany();

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
          description="We're experiencing technical difficulties. Please try again in a few moments."
        />
      </div>
    );
  }
};

export default RootPage;
