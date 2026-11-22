"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Youtube,
  ExternalLink,
  Clock,
  Calendar,
  User,
  Sparkles,
  RefreshCw,
  Eye,
  Copy,
  Check,
  Globe,
  FileText,
  AlertTriangle,
  Play,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface VideoPlayerDialogProps {
  document: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry?: (docId: string, title: string) => void;
  onOpenChunks?: (doc: any) => void;
}

function formatDuration(isoDuration?: string | null): string {
  if (!isoDuration) return "";
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return isoDuration;
  const hours = match[1] ? `${match[1]}:` : "";
  const minutes = match[2] ? (hours ? match[2].padStart(2, "0") : match[2]) : "0";
  const seconds = (match[3] || "0").padStart(2, "0");
  return `${hours}${minutes}:${seconds}`;
}

export function VideoPlayerDialog({
  document,
  open,
  onOpenChange,
  onRetry,
  onOpenChunks,
}: VideoPlayerDialogProps) {
  const [copied, setCopied] = useState(false);
  const [seekSeconds, setSeekSeconds] = useState<number | null>(null);
  const [chunks, setChunks] = useState<any[]>(
    document?.chunksCache || document?.metadata?.chunksCache || []
  );
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !document?.id) return;
    if (document.chunksCache && document.chunksCache.length > 0) {
      setChunks(document.chunksCache);
      return;
    }
    axios
      .get(`/api/documents/${document.id}/chunks`)
      .then((res) => {
        if (res.data.chunks) setChunks(res.data.chunks);
      })
      .catch((err) => console.error("Failed to load chunks for player:", err));
  }, [open, document]);

  if (!document) return null;

  const videoId =
    document.externalId ||
    document.metadata?.videoId ||
    (document.sourceUrl ? document.sourceUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] : null);

  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0${
        seekSeconds !== null ? `&start=${seekSeconds}` : ""
      }`
    : null;

  const handleCopyLink = () => {
    if (!document.sourceUrl) return;
    navigator.clipboard.writeText(document.sourceUrl);
    setCopied(true);
    toast({ title: "Link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border/80 shadow-2xl">
        <DialogHeader className="px-5 py-3 border-b border-border/50 shrink-0 bg-card/60 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 pr-6">
            <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-500 flex items-center justify-center shrink-0">
              <Youtube className="w-4 h-4" />
            </div>
            <DialogTitle className="text-sm font-semibold truncate leading-tight">
              {document.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* In-Platform Video Player */}
          {embedUrl ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/60 bg-black shadow-lg">
              <iframe
                key={`${videoId}-${seekSeconds}`}
                src={embedUrl}
                title={document.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="w-full aspect-video rounded-xl bg-secondary/40 border border-dashed border-border/60 flex flex-col items-center justify-center text-muted-foreground">
              <Youtube className="w-12 h-12 text-muted-foreground/60 mb-2" />
              <p className="text-sm">Video stream not available for embedding.</p>
            </div>
          )}

          {/* Video Title & Primary Metadata */}
          <div className="space-y-3 bg-card/50 p-4 rounded-xl border border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                  {document.title}
                </h2>
                {document.author && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <User className="w-3.5 h-3.5 text-sky-400" />
                    <span>{document.author}</span>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={`text-xs px-2.5 py-1 font-semibold uppercase tracking-wider ${
                    document.processingStatus === "COMPLETED"
                      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                      : document.processingStatus === "PROCESSING"
                      ? "border-amber-500/40 text-amber-400 bg-amber-500/10 animate-pulse"
                      : "border-red-500/40 text-red-400 bg-red-500/10"
                  }`}
                >
                  {document.processingStatus}
                </Badge>
                {document.duration && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDuration(document.duration)}
                  </Badge>
                )}
              </div>
            </div>

            {/* Timestamps & Info Row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground font-mono pt-1 border-t border-border/40">
              {document.publishedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    Uploaded: {format(new Date(document.publishedAt), "MMM d, yyyy")}
                  </span>
                </div>
              )}
              {document.processedAt && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Processed: {format(new Date(document.processedAt), "MMM d, h:mm a")}
                  </span>
                </div>
              )}
              {document.originalLanguage && (
                <div className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    {document.originalLanguage === "hi"
                      ? "Hinglish → English Translation"
                      : "English"}
                  </span>
                </div>
              )}
              {document.chunkCount !== undefined && (
                <div className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>{document.chunkCount} RAG chunks</span>
                </div>
              )}
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {document.sourceUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => window.open(document.sourceUrl, "_blank")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Watch on YouTube
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? "Copied" : "Copy Link"}
                </Button>

                {onOpenChunks && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenChunks(document);
                    }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect All Chunks ({document.chunkCount || chunks.length})
                  </Button>
                )}
              </div>

              {onRetry && (
                <Button
                  type="button"
                  size="sm"
                  variant={document.processingStatus === "FAILED" ? "destructive" : "outline"}
                  className="h-8 text-xs gap-1.5 font-medium"
                  onClick={() => {
                    onRetry(document.id, document.title);
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {document.processingStatus === "FAILED" ? "Retry Ingestion" : "Re-index Video"}
                </Button>
              )}
            </div>
          </div>

          {/* Interactive Timestamped Chunks Player Section */}
          {chunks.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Transcript Chunks &amp; Timestamps (Click to jump &amp; listen)</span>
                </h3>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {chunks.length} chunks
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {chunks.map((chunk: any, idx: number) => {
                  const isCurrent =
                    seekSeconds !== null &&
                    chunk.startSeconds !== undefined &&
                    seekSeconds === chunk.startSeconds;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (chunk.startSeconds !== undefined) {
                          setSeekSeconds(chunk.startSeconds);
                        }
                      }}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex flex-col justify-between gap-1.5 ${
                        isCurrent
                          ? "bg-primary/15 border-primary/50 text-foreground"
                          : "bg-card/40 border-border/50 hover:bg-card/80 hover:border-border"
                      }`}
                      title="Click to jump player to this segment"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-semibold text-[11px] text-foreground font-mono flex items-center gap-1">
                          <Play className="w-2.5 h-2.5 text-primary" />
                          Chunk #{chunk.index !== undefined ? chunk.index + 1 : idx + 1}
                        </span>
                        {chunk.timeRange && (
                          <span className="font-mono text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.2 rounded font-medium">
                            {chunk.timeRange}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {chunk.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
