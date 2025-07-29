"use client";

import { ChangeEventHandler, useEffect, useState, useTransition, useMemo } from "react";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";

const SearchInput = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const name = searchParams.get("name");
  const [value, setValue] = useState(name || "");
  const debouncedValue = useDebounce<string>(value, 300); // Reduced debounce time

  // Memoize current params to avoid recreating URLSearchParams
  const currentParams = useMemo(() => {
    return new URLSearchParams(searchParams.toString());
  }, [searchParams]);

  const onChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setValue(e.target.value);
  };

  useEffect(() => {
    startTransition(() => {
      const params = new URLSearchParams(currentParams);

      if (debouncedValue) {
        params.set("name", debouncedValue);
      } else {
        params.delete("name");
      }

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      router.push(newUrl, { scroll: false });
    });
  }, [debouncedValue, router, currentParams]);

  return (
    <div className="relative">
      <Search className={`absolute h-4 w-4 top-3 left-4 text-muted-foreground transition-opacity ${isPending ? 'opacity-50' : ''}`} />
      <Input
        onChange={onChange}
        value={value}
        placeholder="Search..."
        className={`pl-10 bg-primary/10 transition-opacity ${isPending ? 'opacity-75' : ''}`}
        disabled={isPending}
      />
    </div>
  );
};

export default SearchInput;
