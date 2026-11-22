"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Terminal,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Activity,
  Maximize2,
  Minimize2,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export interface ExecutionLog {
  id: string;
  timestamp: string;
  stage: string;
  message: string;
  level: "info" | "success" | "warn" | "error";
}

interface ExecutionConsoleProps {
  logs: ExecutionLog[];
  isLive: boolean;
  onClear?: () => void;
  defaultExpanded?: boolean;
}

export function ExecutionConsole({
  logs = [],
  isLive = false,
  onClear,
  defaultExpanded = true,
}: ExecutionConsoleProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("ALL");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom to always display the latest logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, isExpanded]);

  // Stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: logs.length,
      TRANSLATE: 0,
      CHUNKING: 0,
      EMBEDDING: 0,
      PINECONE: 0,
      ERRORS: 0,
    };

    for (const log of logs) {
      const s = (log.stage || "").toUpperCase();
      if (s.includes("TRANSLAT")) counts.TRANSLATE++;
      else if (s.includes("CHUNK")) counts.CHUNKING++;
      else if (s.includes("EMBED")) counts.EMBEDDING++;
      else if (s.includes("PINECONE")) counts.PINECONE++;

      if (log.level === "error" || s.includes("ERROR") || s.includes("FAIL")) {
        counts.ERRORS++;
      }
    }
    return counts;
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Stage filter
      if (selectedStage !== "ALL") {
        const s = (log.stage || "").toUpperCase();
        if (selectedStage === "TRANSLATE" && !s.includes("TRANSLAT")) return false;
        if (selectedStage === "CHUNKING" && !s.includes("CHUNK")) return false;
        if (selectedStage === "EMBEDDING" && !s.includes("EMBED")) return false;
        if (selectedStage === "PINECONE" && !s.includes("PINECONE")) return false;
        if (selectedStage === "ERRORS" && log.level !== "error" && !s.includes("ERROR") && !s.includes("FAIL")) {
          return false;
        }
      }

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          log.message.toLowerCase().includes(q) ||
          log.stage.toLowerCase().includes(q) ||
          log.timestamp.includes(q)
        );
      }

      return true;
    });
  }, [logs, selectedStage, searchQuery]);

  const handleCopy = () => {
    if (logs.length === 0) return;
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.stage}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Console logs copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const getStageBadgeStyle = (stage: string, level: string) => {
    if (level === "error") return "text-red-400 bg-red-500/10 border-red-500/30";
    if (level === "success") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    const s = stage.toUpperCase();
    if (s.includes("TRANSLAT")) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    if (s.includes("CHUNK")) return "text-violet-400 bg-violet-500/10 border-violet-500/30";
    if (s.includes("EMBED")) return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    if (s.includes("PINECONE")) return "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
    return "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
  };

  return (
    <div className="rounded-xl border border-border/80 bg-[#09090d] shadow-lg overflow-hidden transition-all">
      {/* Console Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f0f14] border-b border-border/60">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 cursor-pointer select-none min-w-0"
        >
          <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="font-mono text-xs font-bold text-foreground tracking-wider uppercase flex items-center gap-2">
            <span>Service Logs &amp; Execution Console</span>
            {isLive ? (
              <Badge
                variant="outline"
                className="text-[9px] py-0 px-1.5 font-mono text-emerald-400 border-emerald-500/40 bg-emerald-500/10 animate-pulse font-semibold"
              >
                LIVE STREAMING...
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[9px] py-0 px-1.5 font-mono text-zinc-400 border-zinc-600/40 bg-zinc-500/10"
              >
                IDLE
              </Badge>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
            {logs.length} logs recorded
          </span>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            disabled={logs.length === 0}
            className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-foreground"
            title="Copy all logs"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </Button>

          {onClear && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onClear}
              disabled={logs.length === 0}
              className="h-7 text-xs px-2 gap-1 text-muted-foreground hover:text-red-400"
              title="Clear logs"
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-0">
          {/* Console Filter & Search Toolbar */}
          <div className="px-3 py-2 bg-[#0c0c10] border-b border-border/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-muted-foreground mr-1 flex items-center gap-1">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setSelectedStage("ALL")}
                className={`text-[11px] font-mono px-2 py-0.5 rounded transition ${
                  selectedStage === "ALL"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                All ({stageCounts.ALL})
              </button>
              <button
                type="button"
                onClick={() => setSelectedStage("TRANSLATE")}
                className={`text-[11px] font-mono px-2 py-0.5 rounded transition ${
                  selectedStage === "TRANSLATE"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                    : "text-muted-foreground hover:text-amber-300"
                }`}
              >
                Translate ({stageCounts.TRANSLATE})
              </button>
              <button
                type="button"
                onClick={() => setSelectedStage("CHUNKING")}
                className={`text-[11px] font-mono px-2 py-0.5 rounded transition ${
                  selectedStage === "CHUNKING"
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/40 font-semibold"
                    : "text-muted-foreground hover:text-violet-300"
                }`}
              >
                Chunking ({stageCounts.CHUNKING})
              </button>
              <button
                type="button"
                onClick={() => setSelectedStage("EMBEDDING")}
                className={`text-[11px] font-mono px-2 py-0.5 rounded transition ${
                  selectedStage === "EMBEDDING"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold"
                    : "text-muted-foreground hover:text-blue-300"
                }`}
              >
                Embedding ({stageCounts.EMBEDDING})
              </button>
              <button
                type="button"
                onClick={() => setSelectedStage("PINECONE")}
                className={`text-[11px] font-mono px-2 py-0.5 rounded transition ${
                  selectedStage === "PINECONE"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold"
                    : "text-muted-foreground hover:text-cyan-300"
                }`}
              >
                Pinecone ({stageCounts.PINECONE})
              </button>
              {stageCounts.ERRORS > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedStage("ERRORS")}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded transition ${
                    selectedStage === "ERRORS"
                      ? "bg-red-500/20 text-red-300 border border-red-500/40 font-semibold"
                      : "text-red-400 hover:text-red-300"
                  }`}
                >
                  Errors ({stageCounts.ERRORS})
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search console..."
                className="h-7 text-xs pl-7 bg-black/40 border-border/50 font-mono"
              />
            </div>
          </div>

          {/* Monospace Black Terminal Log Body */}
          <div
            ref={scrollRef}
            className="p-3.5 max-h-64 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed select-text"
          >
            {filteredLogs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground/60 italic text-xs font-mono">
                {logs.length === 0
                  ? "Console idle. Trigger an ingestion sync or single video retry to view live execution logs."
                  : "No log entries match your filter query."}
              </div>
            ) : (
              filteredLogs.map((log) => {
                const badgeStyle = getStageBadgeStyle(log.stage, log.level);
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 hover:bg-white/[0.03] px-1.5 py-0.5 rounded transition-colors group"
                  >
                    {/* Timestamp */}
                    <span className="text-muted-foreground/60 shrink-0 select-none">
                      [{log.timestamp}]
                    </span>

                    {/* Stage Tag */}
                    <span
                      className={`px-1.5 py-0.2 rounded border text-[10px] uppercase font-bold shrink-0 tracking-wider ${badgeStyle}`}
                    >
                      {log.stage}
                    </span>

                    {/* Log Message */}
                    <span
                      className={`break-words min-w-0 flex-1 ${
                        log.level === "error"
                          ? "text-red-400 font-semibold"
                          : log.level === "success"
                          ? "text-emerald-400 font-medium"
                          : log.level === "warn"
                          ? "text-amber-300"
                          : "text-foreground/90"
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
