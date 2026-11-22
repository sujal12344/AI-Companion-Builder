import prismadb from "@/lib/prismadb";
import CompanionsFeed from "@/components/CompanionsFeed";
import { Suspense } from "react";
import CompanionSkeleton from "@/components/companionsSkeleton";
import { currentUser } from "@clerk/nextjs/server";
import SearchInput from "@/components/SearchInput";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface rootPageProps {
  searchParams: Promise<{
    name?: string;
  }>;
}

const StorePage = async ({ searchParams }: rootPageProps) => {
  try {
    const user = await currentUser();
    const { name } = await searchParams;

    const data = await prismadb.companion.findMany({
      where: {
        userId: user?.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    return (
      <div className="h-full p-4 space-y-2">
        <div className="text-2xl font-semibold mb-4">
          Your Created Companions
        </div>
        <Suspense fallback={<CompanionSkeleton />}>
          <CompanionsFeed
            initialData={data}
            userId={user?.id}
            initialName={name}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    console.error("Store page error:", error);
    return (
      <div className="h-full p-4 space-y-2">
        <div className="text-2xl font-semibold mb-4">
          Your Created Companions
        </div>
        <SearchInput />
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center border border-red-500/30">
              <div className="text-2xl">🤖</div>
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-primary mb-3">
            Unable to Load Store
          </h3>
          <p className="text-muted-foreground mb-4 max-w-sm">
            We&apos;re having trouble loading your companions. Please try
            refreshing the page.
          </p>
        </div>
      </div>
    );
  }
};

export default StorePage;
