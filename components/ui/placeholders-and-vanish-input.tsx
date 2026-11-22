"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./select";
import { ChatMessageProps } from "../ChatMessage";

export function PlaceholdersAndVanishInput({
  placeholders,
  onChange,
  onSubmit,
  disabled,
  inputValue,
  className,
}: {
  placeholders: string[];
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
  inputValue?: string;
  className?: string;
}) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("chat-input-history");
      if (savedHistory) {
        setInputHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.warn("Failed to load chat history:", error);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (inputHistory.length > 0) {
      try {
        localStorage.setItem("chat-input-history", JSON.stringify(inputHistory.slice(-50))); // Keep last 50
      } catch (error) {
        console.warn("Failed to save chat history:", error);
      }
    }
  }, [inputHistory]);

  const startAnimation = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
    }, 3000);
  }, [placeholders.length]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState !== "visible" && intervalRef.current) {
      clearInterval(intervalRef.current); // Clear the interval when the tab is not visible
      intervalRef.current = null;
    } else if (document.visibilityState === "visible") {
      startAnimation(); // Restart the interval when the tab becomes visible
    }
  }, [startAnimation]);

  useEffect(() => {
    startAnimation();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Automatically focus the input when the component mounts
    inputRef.current?.focus();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [startAnimation, handleVisibilityChange]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const newDataRef = useRef<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(inputValue || "");
  const [animating, setAnimating] = useState(false);

  const draw = useCallback(() => {
    if (!inputRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 800;
    ctx.clearRect(0, 0, 800, 800);
    const computedStyles = getComputedStyle(inputRef.current);

    const fontSize = parseFloat(computedStyles.getPropertyValue("font-size"));
    ctx.font = `${fontSize * 2}px ${computedStyles.fontFamily}`;
    ctx.fillStyle = "#FFF";
    ctx.fillText(value, 16, 40);

    const imageData = ctx.getImageData(0, 0, 800, 800);
    const pixelData = imageData.data;
    const newData: any[] = [];

    for (let t = 0; t < 800; t++) {
      let i = 4 * t * 800;
      for (let n = 0; n < 800; n++) {
        let e = i + 4 * n;
        if (
          pixelData[e] !== 0 &&
          pixelData[e + 1] !== 0 &&
          pixelData[e + 2] !== 0
        ) {
          newData.push({
            x: n,
            y: t,
            color: [
              pixelData[e],
              pixelData[e + 1],
              pixelData[e + 2],
              pixelData[e + 3],
            ],
          });
        }
      }
    }

    newDataRef.current = newData.map(({ x, y, color }) => ({
      x,
      y,
      r: 1,
      color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`,
    }));
  }, [value]);

  useEffect(() => {
    draw();
  }, [value, draw]);

  const animate = (start: number) => {
    const animateFrame = (pos: number = 0) => {
      requestAnimationFrame(() => {
        const newArr = [];
        for (let i = 0; i < newDataRef.current.length; i++) {
          const current = newDataRef.current[i];
          if (current.x < pos) {
            newArr.push(current);
          } else {
            if (current.r <= 0) {
              current.r = 0;
              continue;
            }
            current.x += Math.random() > 0.5 ? 1 : -1;
            current.y += Math.random() > 0.5 ? 1 : -1;
            current.r -= 0.05 * Math.random();
            newArr.push(current);
          }
        }
        newDataRef.current = newArr;
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          ctx.clearRect(pos, 0, 800, 800);
          newDataRef.current.forEach((t) => {
            const { x: n, y: i, r: s, color: color } = t;
            if (n > pos) {
              ctx.beginPath();
              ctx.rect(n, i, s, s);
              ctx.fillStyle = color;
              ctx.strokeStyle = color;
              ctx.stroke();
            }
          });
        }
        if (newDataRef.current.length > 0) {
          animateFrame(pos - 8);
        } else {
          setValue("");
          setAnimating(false);
        }
      });
    };
    animateFrame(start);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key
    if (e.key === "Enter" && !animating) {
      vanishAndSubmit();
      return;
    }

    // Handle Up arrow - navigate to previous message in history
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (inputHistory.length > 0) {
        const newIndex = historyIndex === -1 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        const historicalValue = inputHistory[newIndex];
        setValue(historicalValue);
        
        // Trigger onChange to update parent component
        const syntheticEvent = {
          target: { value: historicalValue },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange && onChange(syntheticEvent);
      }
      return;
    }

    // Handle Down arrow - navigate to next message in history
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= inputHistory.length) {
          // Clear input when reaching the end
          setHistoryIndex(-1);
          setValue("");
          const syntheticEvent = {
            target: { value: "" },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange && onChange(syntheticEvent);
        } else {
          setHistoryIndex(newIndex);
          const historicalValue = inputHistory[newIndex];
          setValue(historicalValue);
          const syntheticEvent = {
            target: { value: historicalValue },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange && onChange(syntheticEvent);
        }
      }
      return;
    }
  };

  const vanishAndSubmit = () => {
    setAnimating(true);
    draw();

    const value = inputRef.current?.value || "";
    if (value && inputRef.current) {
      const maxX = newDataRef.current.reduce(
        (prev, current) => (current.x > prev ? current.x : prev),
        0
      );
      animate(maxX);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Add to history (avoid duplicates)
    const currentValue = inputRef.current?.value || "";
    if (currentValue.trim() && (inputHistory.length === 0 || inputHistory[inputHistory.length - 1] !== currentValue)) {
      setInputHistory(prev => [...prev, currentValue]);
    }
    
    // Reset history index
    setHistoryIndex(-1);
    
    vanishAndSubmit();
    onSubmit && onSubmit(e);
  };
  return (
    <form
      className={cn(
        "w-full relative mx-auto bg-card/75 hover:bg-card border border-border/80 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 h-12 rounded-xl overflow-hidden shadow-sm transition-all duration-200",
        value && "bg-card",
        className
      )}
      onSubmit={handleSubmit}
    >
      <canvas
        className={cn(
          "absolute pointer-events-none text-base transform scale-50 top-[20%] left-2 sm:left-8 origin-top-left filter invert dark:invert-0 pr-20",
          !animating ? "opacity-0" : "opacity-100"
        )}
        ref={canvasRef}
      />
      <input
        onChange={(e) => {
          if (!animating) {
            setValue(e.target.value);
            setHistoryIndex(-1); // Reset history navigation when typing
            onChange && onChange(e);
          }
        }}
        onKeyDown={handleKeyDown}
        ref={inputRef}
        value={value}
        type="text"
        className={cn(
          "w-full relative text-sm sm:text-base z-50 border-none text-foreground bg-transparent h-full rounded-xl focus:outline-none focus:ring-0 pl-4 sm:pl-8 pr-14 disabled:cursor-not-allowed placeholder:text-muted-foreground",
          animating && "text-transparent dark:text-transparent"
        )}
        title={placeholders[currentPlaceholder]}
        disabled={disabled}
        onFocus={() => inputRef.current?.focus()}
      />

      <button
        disabled={!value}
        type="submit"
        className="absolute right-2 top-1/2 z-50 -translate-y-1/2 h-[34px] w-[34px] rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:bg-primary/40 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center shadow-xs"
        title="Send message"
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary-foreground h-4 w-4"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <motion.path
            d="M5 12l14 0"
            initial={{
              strokeDasharray: "50%",
              strokeDashoffset: "50%",
            }}
            animate={{
              strokeDashoffset: value ? 0 : "50%",
            }}
            transition={{
              duration: 0.3,
              ease: "linear",
            }}
          />
          <path d="M13 18l6 -6" />
          <path d="M13 6l6 6" />
        </motion.svg>
      </button>

      <div className="absolute inset-0 flex items-center rounded-xl pointer-events-none">
        <AnimatePresence mode="wait">
          {!value && (
            <motion.p
              initial={{
                y: 5,
                opacity: 0,
              }}
              key={`current-placeholder-${currentPlaceholder}`}
              animate={{
                y: 0,
                opacity: 1,
              }}
              exit={{
                y: -15,
                opacity: 0,
              }}
              transition={{
                duration: 0.3,
                ease: "linear",
              }}
              className="text-muted-foreground text-sm sm:text-base font-normal pl-4 sm:pl-8 text-left w-[calc(100%-3rem)] truncate"
            >
              {placeholders[currentPlaceholder]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
