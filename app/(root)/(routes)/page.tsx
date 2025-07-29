import SearchInput from "@/components/SearchInput";
import Categories from "@/components/Categories";
import prismadb from "@/lib/prismadb";
import Companions from "@/components/Companions";
import { Suspense } from "react";
import CompanionSkeleton from "@/components/companionsSkeleton";

interface rootPageProps {
  searchParams: {
    categoryId: string;
    name: string;
  };
}

const RootPage = async ({ searchParams }: rootPageProps) => {
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
      <Suspense fallback={<CompanionSkeleton />}>
        <Companions data={data} />
      </Suspense>
    </div>
  );
};

export default RootPage;
