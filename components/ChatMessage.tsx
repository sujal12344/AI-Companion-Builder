"use client";

import React, { useState, useMemo } from "react";
import { BeatLoader } from "react-spinners";
import { cn } from "@/lib/utils";
import { Copy, Youtube, Sparkles, Layers, ChevronDown, ChevronUp } from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/use-toast";
import { BotAvatar } from "@/components/BotAvatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Citation } from "@/lib/sources/types";
import { CitationCard } from "@/components/CitationCard";
import { CitationDetailDialog } from "@/components/CitationDetailDialog";
import ReactMarkdown from "react-markdown";

export interface ChatMessageProps {
  role: "system" | "user";
  content?: string;
  isLoading?: boolean;
  src?: string;
  id?: string;
  citations?: Citation[];
}

export const ChatMessage = ({
  role,
  content,
  isLoading,
  src,
  citations,
}: ChatMessageProps) => {
  const { toast } = useToast();
  const { theme } = useTheme();

  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCitationsExpanded, setIsCitationsExpanded] = useState(false);

  // Parse embedded citations if not supplied through props (e.g. from DB on reload)
  const { cleanContent, effectiveCitations } = useMemo(() => {
    if (!content) return { cleanContent: "", effectiveCitations: citations || [] };

    const marker = "<!--CITATIONS_DATA:";
    const markerIndex = content.indexOf(marker);

    let parsedCitations: Citation[] = citations || [];
    let stripped = content;

    if (markerIndex !== -1) {
      stripped = content.substring(0, markerIndex).trim();
      if (!citations || citations.length === 0) {
        try {
          const jsonStart = markerIndex + marker.length;
          const jsonEnd = content.indexOf("-->", jsonStart);
          if (jsonEnd !== -1) {
            parsedCitations = JSON.parse(content.substring(jsonStart, jsonEnd));
          }
        } catch (e) {
          console.warn("Failed to parse embedded citations:", e);
        }
      }
    }

    return { cleanContent: stripped, effectiveCitations: parsedCitations };
  }, [content, citations]);

  // Transform inline citation markers [1], [Source 1], [^1] into Markdown anchors for interactive pills
  const formattedMarkdown = useMemo(() => {
    if (!cleanContent) return "";

    return cleanContent
      // Handle multi-citations like [1, 2] -> [1](#cite-1) [2](#cite-2)
      .replace(/\[(\d+),\s*(\d+)\]/g, "[$1](#cite-$1) [[$2]](#cite-$2)")
      // Handle standard [1], [Source 1], [Chunk 1] -> [1](#cite-1)
      .replace(/\[(?:Source\s*|Chunk\s*)?(\d+)\]/gi, "[$1](#cite-$1)")
      // Handle footnote style [^1] -> [1](#cite-1)
      .replace(/\[\^(\d+)\]/g, "[$1](#cite-$1)");
  }, [cleanContent]);

  const onCopy = () => {
    if (!cleanContent) return;
    navigator.clipboard.writeText(cleanContent);
    toast({
      description: "Message copied to clipboard",
    });
  };

  const handleOpenCitation = (cit: Citation) => {
    setSelectedCitation(cit);
    setIsDialogOpen(true);
  };

  // Helper to detect if a rendered node contains a citation anchor link
  const containsCitation = (nodeChildren: React.ReactNode): boolean => {
    return React.Children.toArray(nodeChildren).some((child) => {
      if (React.isValidElement(child)) {
        if (typeof (child.props as any)?.href === "string" && (child.props as any).href.startsWith("#cite-")) {
          return true;
        }
        if ((child.props as any)?.children) {
          return containsCitation((child.props as any).children);
        }
      }
      return false;
    });
  };

  return (
    <>
      <div
        className={cn(
          "group flex items-start gap-x-3 py-4 w-full",
          role === "user" && "justify-end"
        )}
      >
        {role !== "user" && src && <BotAvatar src={src!} alt="bot avatar" />}

        <div className="flex flex-col gap-2 max-w-2xl w-full">
          <div className="bg-primary/20 px-4 py-3 rounded-lg text-sm leading-relaxed overflow-hidden">
            {isLoading ? (
              <BeatLoader
                color={theme === "light" ? "dark" : "white"}
                loading={isLoading}
                size={5}
              />
            ) : role === "user" ? (
              <div className="whitespace-pre-wrap">{cleanContent}</div>
            ) : (
              <div className="space-y-2.5 leading-relaxed break-words">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => {
                      const isCited = containsCitation(children);
                      return (
                        <p
                          className={cn(
                            "mb-2.5 last:mb-0 leading-relaxed transition-all",
                            isCited &&
                              "bg-amber-500/10 dark:bg-amber-400/10 border-l-[3px] border-amber-500/80 pl-2.5 py-1.5 rounded-r-md my-1.5 shadow-sm"
                          )}
                        >
                          {children}
                        </p>
                      );
                    },
                    ul: ({ children }) => (
                      <ul className="list-disc pl-5 my-2 space-y-1.5">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 my-2 space-y-1.5">{children}</ol>
                    ),
                    li: ({ children }) => {
                      const isCited = containsCitation(children);
                      return (
                        <li
                          className={cn(
                            "leading-relaxed transition-all",
                            isCited &&
                              "bg-amber-500/10 dark:bg-amber-400/10 border-l-[3px] border-amber-500/80 pl-2.5 py-1 rounded-r-md my-1 shadow-sm"
                          )}
                        >
                          {children}
                        </li>
                      );
                    },
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">{children}</strong>
                    ),
                    code: ({ children }) => (
                      <code className="bg-black/20 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">
                        {children}
                      </code>
                    ),
                    a: ({ href, children }) => {
                      if (href?.startsWith("#cite-")) {
                        const num = parseInt(href.replace("#cite-", ""), 10);
                        const citation =
                          effectiveCitations.find((c, idx) => (c.index ?? idx + 1) === num) ||
                          effectiveCitations[num - 1];

                        if (citation) {
                          const timeStr =
                            citation.timestamp?.startSeconds !== undefined
                              ? `${Math.floor(citation.timestamp.startSeconds / 60)}:${String(
                                  citation.timestamp.startSeconds % 60
                                ).padStart(2, "0")}`
                              : null;

                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenCitation(citation);
                              }}
                              className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all cursor-pointer align-baseline select-none shadow-sm hover:scale-105 active:scale-95 group/pill"
                              title={`Referenced from "${citation.title}"${
                                timeStr ? ` at ${timeStr}` : ""
                              }. Click to inspect exact chunk!`}
                            >
                              <Youtube className="w-3 h-3 text-red-500 shrink-0" />
                              <span>{num}</span>
                              {timeStr && (
                                <span className="text-[10px] font-mono opacity-85">
                                  {timeStr}
                                </span>
                              )}
                            </button>
                          );
                        }

                        return <span className="text-muted-foreground font-mono">[{num}]</span>;
                      }

                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline hover:opacity-80 transition"
                        >
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {formattedMarkdown}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Collapsible Citations Footer & List (Default: Minimized) */}
          {effectiveCitations && effectiveCitations.length > 0 && !isLoading && (
            <div className="mt-2 space-y-1.5">
              {/* Sleek minimized toggle bar */}
              <button
                type="button"
                onClick={() => setIsCitationsExpanded(!isCitationsExpanded)}
                className="w-full flex items-center justify-between py-1.5 px-3 rounded-lg bg-card/60 hover:bg-card border border-border/70 hover:border-primary/40 text-xs transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-semibold text-foreground text-xs">
                    Referenced Sources ({effectiveCitations.length})
                  </span>
                  <div className="hidden sm:flex items-center gap-1 overflow-hidden">
                    {effectiveCitations.map((c, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono font-bold text-red-500 bg-red-500/10 border border-red-500/20 px-1.5 py-0.2 rounded"
                      >
                        [{c.index ?? i + 1}]
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground group-hover:text-primary transition shrink-0">
                  <span>{isCitationsExpanded ? "Hide Sources" : "View Sources"}</span>
                  {isCitationsExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {/* Expanded Citation Cards */}
              {isCitationsExpanded && (
                <div className="space-y-1.5 pt-1 animate-in fade-in-50 duration-200">
                  {effectiveCitations.map((citation, index) => (
                    <CitationCard
                      key={`${citation.documentId || citation.sourceId}-${index}`}
                      citation={citation}
                      index={index}
                      onInspect={handleOpenCitation}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {role === "user" && <UserAvatar alt="user avatar" />}

        {role !== "user" && !isLoading && (
          <Button
            className="opacity-0 group-hover:opacity-100 transition shrink-0"
            size={"icon"}
            variant={"ghost"}
            onClick={onCopy}
            title="Copy message"
          >
            <Copy className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Pop-up dialog to inspect referenced chunk and video */}
      <CitationDetailDialog
        citation={selectedCitation}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
};
