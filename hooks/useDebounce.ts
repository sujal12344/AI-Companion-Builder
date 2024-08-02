import { useEffect, useState } from "react";

export function useDebounce<kuchBhi>(value: kuchBhi, delay?: number): kuchBhi {
  const [debouncedValue, setDebouncedValue] = useState<kuchBhi>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);

    return () => clearTimeout(timer); //cleanup function
  }, [value, delay]); //run this effect whenever value or delay changes

  return debouncedValue;
}
