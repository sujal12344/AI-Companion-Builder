"use client";

import { cn } from "@/lib/utils";
import { Category } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

interface categoriesProps {
  data: Category[];
}

const Categories = ({ data }: categoriesProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const categoryId = searchParams.get("categoryId");

  // Memoize the current search params to avoid recreating the URLSearchParams object
  const currentParams = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    return params;
  }, [searchParams]);

  const onClick = useCallback((id: string | undefined) => {
    startTransition(() => {
      const params = new URLSearchParams(currentParams);

      if (id) {
        params.set("categoryId", id);
      } else {
        params.delete("categoryId");
      }

      // Keep other search params like 'name' if they exist
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      router.push(newUrl, { scroll: false });
    });
  }, [currentParams, router]);

  // Memoize the button class names to avoid recalculating on every render
  const getButtonClassName = useCallback((isActive: boolean) => {
    return cn(
      "flex items-center text-center text-xs md:text-md px-2 md:px-4 py-2 md:py-3 rounded-md hover:opacity-75 transition-all duration-200 whitespace-nowrap",
      isActive ? "bg-primary/25" : "bg-primary/10",
      isPending && "opacity-50 cursor-wait"
    );
  }, [isPending]);

  return (
    <div className="w-full overflow-x-auto space-x-2 flex p-1">
      <button
        type="button"
        onClick={() => onClick(undefined)}
        disabled={isPending}
        className={getButtonClassName(!categoryId)}
      >
        Newest
      </button>
      {data.map((category) => (
        <button
          type="button"
          key={category.id}
          onClick={() => onClick(category.id)}
          disabled={isPending}
          className={getButtonClassName(category.id === categoryId)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
};

export default Categories;
