"use client";

import { ChangeEventHandler, useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

const SearchInput = ({
  value: controlledValue,
  onChange: controlledOnChange,
  placeholder = "Search...",
}: SearchInputProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isControlled = controlledOnChange !== undefined;

  const urlName = searchParams.get("name") || "";
  const [internalValue, setInternalValue] = useState(urlName);

  const currentValue = isControlled ? (controlledValue ?? "") : internalValue;

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const nextVal = e.target.value;
    if (isControlled) {
      controlledOnChange(nextVal);
    } else {
      setInternalValue(nextVal);
    }
  };

  const handleClear = () => {
    if (isControlled) {
      controlledOnChange("");
    } else {
      setInternalValue("");
    }
  };

  // If uncontrolled, sync with URL
  useEffect(() => {
    if (isControlled) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (internalValue.trim()) {
        params.set("name", internalValue.trim());
      } else {
        params.delete("name");
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      router.push(newUrl, { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [internalValue, isControlled, router, searchParams]);

  return (
    <div className="relative">
      <Search className="absolute h-4 w-4 top-3 left-4 text-muted-foreground pointer-events-none" />
      <Input
        onChange={handleChange}
        value={currentValue}
        placeholder={placeholder}
        className="pl-10 pr-10 bg-primary/10"
      />
      {currentValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition cursor-pointer"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
