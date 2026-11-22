"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Companion } from "@prisma/client";
import SearchInput from "@/components/SearchInput";
import CompanionCard from "@/components/CompanionCard";
import Image from "next/image";

export type CompanionWithMeta = Companion & {
  _count: {
    messages: number;
  };
};

interface CompanionsFeedProps {
  initialData: CompanionWithMeta[];
  userId?: string | null;
  initialName?: string;
}

export const CompanionsFeed = ({
  initialData,
  userId,
  initialName,
}: CompanionsFeedProps) => {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("name") || initialName || "";
  const [search, setSearch] = useState(urlSearch);

  // Sync if URL search params change externally (browser back/forward)
  useEffect(() => {
    const currentName = searchParams.get("name") || "";
    setSearch(currentName);
  }, [searchParams]);

  // Debounced non-blocking URL synchronization
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set("name", search.trim());
      }

      const queryString = params.toString();
      const newUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;

      window.history.replaceState(null, "", newUrl);
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  // Instant client-side filtering (0ms latency)
  const filteredData = useMemo(() => {
    if (!search.trim()) {
      return initialData;
    }

    const query = search.toLowerCase().trim();
    return initialData.filter((item) => {
      const matchesName = item.name.toLowerCase().includes(query);
      const matchesDesc = item.description.toLowerCase().includes(query);
      const matchesUser = item.userName.toLowerCase().includes(query);

      return matchesName || matchesDesc || matchesUser;
    });
  }, [initialData, search]);

  return (
    <div className="space-y-4">
      <SearchInput value={search} onChange={setSearch} />

      {filteredData.length === 0 ? (
        <div className="flex flex-col pt-10 items-center justify-center">
          <div className="relative w-60 h-60">
            <Image fill alt="empty" className="grayscale" src="/empty.png" />
          </div>
          <p className="text-sm text-muted-foreground">No companions found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 pb-10">
          {filteredData.map((item) => (
            <CompanionCard key={item.id} item={item} userId={userId} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CompanionsFeed;
