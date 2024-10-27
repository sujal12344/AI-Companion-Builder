import SearchInput from "@/components/SearchInput";
import Categories from "@/components/Categories";
import prismadb from "@/lib/prismadb";
import Companions from "@/components/Companions";
import { Suspense } from "react";
import CompanionSkeleton from "@/components/companionsSkeleton";
import { currentUser } from "@clerk/nextjs/server";

interface rootPageProps {
  searchParams: {
    categoryId: string;
    name: string;
  };
}

const StorePage = async ({ searchParams }: rootPageProps) => {
  const user = await currentUser();
  const data = await prismadb.companion.findMany({
    where: {
      // categoryId: searchParams.categoryId,
      // name: {
      //   search: searchParams.name,
      // },
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

  const categories = await prismadb.category.findMany();

  return (
    <div className="h-full p-4 space-y-2">
      <div className="text-2xl font-semibold mb-4">Your Created Companions</div>
      <SearchInput />
      <Categories data={categories} />
      <Suspense fallback={<CompanionSkeleton />}>
        <Companions data={data} />
      </Suspense>
    </div>
  );
};

export default StorePage;