"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Youtube, Globe, FileText, Clock, Sparkles } from "lucide-react";
import { SourceType } from "@prisma/client";
import { Citation } from "@/lib/sources/types";
import { formatDistanceToNow } from "date-fns";

interface CitationCardProps {
  citation: Citation;
  index: number;
  onInspect?: (citation: Citation) => void;
}

export function CitationCard({ citation, index, onInspect }: CitationCardProps) {
  const getSourceIcon = (type: SourceType) => {
    if (type?.includes("YOUTUBE")) return <Youtube className="w-4 h-4 text-red-500" />;
    if (type === "WEBSITE" || type === "RSS_FEED") return <Globe className="w-4 h-4 text-blue-500" />;
    return <FileText className="w-4 h-4 text-gray-400" />;
  };

  const getSourceTypeLabel = (type: SourceType) => {
    const labels: Record<SourceType, string> = {
      YOUTUBE_CHANNEL: "YouTube",
      YOUTUBE_VIDEO: "YouTube",
      YOUTUBE_PLAYLIST: "YouTube",
      WEBSITE: "Website",
      RSS_FEED: "RSS",
      PODCAST_FEED: "Podcast",
      FILE_UPLOAD: "Document",
      TEXT_PASTE: "Text",
      GITHUB_REPO: "GitHub",
      GITHUB_PROFILE: "GitHub",
      SOCIAL_EXPORT: "Social",
    };
    return labels[type] || type;
  };

  const citationNumber = citation.index ?? index + 1;

  return (
    <Card
      onClick={() => onInspect?.(citation)}
      className="bg-card/70 hover:bg-accent/40 border border-border/80 hover:border-primary/40 transition-all cursor-pointer group rounded-lg overflow-hidden shadow-sm"
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Thumbnail or Icon */}
          {citation.thumbnail ? (
            <div className="relative w-16 h-10 sm:w-20 sm:h-12 rounded-md overflow-hidden bg-black/40 shrink-0 border border-border/60">
              <Image
                src={citation.thumbnail}
                alt={citation.title}
                fill
                sizes="80px"
                className="object-cover group-hover:scale-105 transition-transform"
              />
              {citation.timestamp && (
                <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[9px] font-mono font-semibold text-white px-1 py-0.2 rounded">
                  {Math.floor(citation.timestamp.startSeconds / 60)}:
                  {String(citation.timestamp.startSeconds % 60).padStart(2, "0")}
                </span>
              )}
            </div>
          ) : (
            <div className="flex-shrink-0 mt-0.5">{getSourceIcon(citation.sourceType)}</div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 font-mono font-bold text-red-500 dark:text-red-400 border-red-500/30 bg-red-500/10 shrink-0"
                >
                  [{citationNumber}]
                </Badge>
                <h4 className="text-xs sm:text-sm font-semibold truncate group-hover:text-primary transition-colors">
                  {citation.title}
                </h4>
              </div>
              <Badge variant="secondary" className="text-[10px] flex-shrink-0 py-0 px-1.5 font-normal">
                {getSourceTypeLabel(citation.sourceType)}
              </Badge>
            </div>

            {citation.excerpt && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-2 italic">
                &ldquo;{citation.excerpt}&rdquo;
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
              {citation.timestamp && (
                <a
                  href={citation.timestamp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-red-500 hover:text-red-400 font-mono text-[11px] font-medium transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Youtube className="w-3.5 h-3.5" />
                  <span>
                    ⏱️ {Math.floor(citation.timestamp.startSeconds / 60)}:
                    {String(citation.timestamp.startSeconds % 60).padStart(2, "0")}
                  </span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}

              {citation.publishedAt && (
                <span className="flex items-center gap-1 text-[11px]">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(citation.publishedAt), { addSuffix: true })}
                </span>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onInspect?.(citation);
                }}
                className="h-5 px-2 text-[10px] font-medium text-primary hover:text-primary hover:bg-primary/10 ml-auto gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Inspect Chunk</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
