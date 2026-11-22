"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  Copy,
  Check,
  Clock,
  FileText,
  ExternalLink,
  Youtube,
  Globe,
  BookOpen,
  Calendar,
  CheckCircle2,
  Sparkles,
  Trash2,
} from "lucide-react";

interface ChunkItem {
  index: number;
  content: string;
  charCount: number;
  wordCount: number;
  startSeconds?: number;
  endSeconds?: number;
  timeRange?: string | null;
}

interface DocumentMeta {
  id: string;
  title: string;
  sourceUrl?: string | null;
  sourceType: string;
  author?: string | null;
  externalId?: string | null;
  thumbnail?: string | null;
  duration?: string | null;
  chunkCount: number;
  publishedAt?: string | null;
  processedAt?: string | null;
  processingDurationMs?: number | null;
  processingStatus?: string | null;
  errorMessage?: string | null;
  chunksCache?: ChunkItem[];
}

interface ChunkViewerDialogProps {
  documentId: string | null;
  initialDoc?: DocumentMeta | any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChunksUpdated?: (newChunkCount: number) => void;
}

function highlightMatch(text: string, query: string) {
  if (!query || !query.trim()) return text;

  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="bg-amber-400/30 text-amber-200 font-bold px-1 py-0.5 rounded border border-amber-400/40"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function ChunkViewerDialog({
  documentId,
  initialDoc,
  open,
  onOpenChange,
  onChunksUpdated,
}: ChunkViewerDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [docData, setDocData] = useState<DocumentMeta | null>(initialDoc || null);
  const [chunks, setChunks] = useState<ChunkItem[]>(initialDoc?.chunksCache || []);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [deletingChunkIndex, setDeletingChunkIndex] = useState<number | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  useEffect(() => {
    if (!open) {
      setDocData(null);
      setChunks([]);
      setSearchQuery("");
      return;
    }

    if (initialDoc) {
      setDocData(initialDoc);
      if (initialDoc.chunksCache && Array.isArray(initialDoc.chunksCache)) {
        setChunks(initialDoc.chunksCache);
      }
    }

    if (!documentId) return;

    if (initialDoc && (initialDoc.chunkCount === 0 || initialDoc.processingStatus === "FAILED" && (!initialDoc.chunksCache || initialDoc.chunksCache.length === 0))) {
      setIsLoading(false);
      return;
    }

    const loadChunks = async () => {
      const hasInitialChunks =
        initialDoc?.chunksCache && initialDoc.chunksCache.length > 0;
      if (!hasInitialChunks) {
        setIsLoading(true);
      }
      try {
        const res = await axios.get(`/api/documents/${documentId}/chunks`);
        if (res.data.document) setDocData(res.data.document);
        if (res.data.chunks) setChunks(res.data.chunks || []);
      } catch (err) {
        console.error("Failed to load chunks:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadChunks();
  }, [documentId, open, initialDoc]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDeleteChunk = async (chunkIndex: number) => {
    if (!documentId) return;
    if (
      !window.confirm(
        `Delete Chunk #${chunkIndex + 1}? This removes its vector embedding from Pinecone and deletes it from database.`
      )
    ) {
      return;
    }

    const previousChunks = [...chunks];
    const updated = chunks.filter((c) => c.index !== chunkIndex);
    // Optimistic UI update: remove instantly from UI
    setChunks(updated);
    if (docData) {
      setDocData({ ...docData, chunkCount: updated.length });
    }
    onChunksUpdated?.(updated.length);

    try {
      await axios.delete(`/api/documents/${documentId}/chunks?chunkIndex=${chunkIndex}`);
    } catch (err) {
      console.error("Failed to delete chunk:", err);
      // Revert if failed
      setChunks(previousChunks);
      if (docData) {
        setDocData({ ...docData, chunkCount: previousChunks.length });
      }
      onChunksUpdated?.(previousChunks.length);
      alert("Failed to delete chunk from Pinecone. Please try again.");
    }
  };

  const handleClearAllChunks = async () => {
    if (!documentId || chunks.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete ALL ${chunks.length} chunks for this video?\nAll associated vector embeddings will be permanently deleted from Pinecone.`
      )
    ) {
      return;
    }

    const previousChunks = [...chunks];
    // Optimistic UI update: clear instantly
    setChunks([]);
    if (docData) {
      setDocData({ ...docData, chunkCount: 0 });
    }
    onChunksUpdated?.(0);

    setIsClearingAll(true);
    try {
      await axios.delete(`/api/documents/${documentId}/chunks`);
    } catch (err) {
      console.error("Failed to delete all chunks:", err);
      setChunks(previousChunks);
      if (docData) {
        setDocData({ ...docData, chunkCount: previousChunks.length });
      }
      onChunksUpdated?.(previousChunks.length);
      alert("Failed to delete all chunks. Please try again.");
    } finally {
      setIsClearingAll(false);
    }
  };

  const filteredChunks = chunks.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.content.toLowerCase().includes(q) ||
      (c.timeRange && c.timeRange.includes(q)) ||
      `chunk ${c.index + 1}`.includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        <DialogHeader className="p-5 border-b border-border/50 shrink-0">
          <div className="flex items-start gap-4">
            {docData?.thumbnail ? (
              <div className="relative w-24 h-16 rounded-md overflow-hidden shrink-0 border border-border/60 bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={docData.thumbnail}
                  alt={docData.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                {docData?.sourceType?.startsWith("YOUTUBE") ? (
                  <Youtube className="w-6 h-6 text-red-500" />
                ) : docData?.sourceType === "WEBSITE" ? (
                  <Globe className="w-6 h-6 text-blue-500" />
                ) : (
                  <BookOpen className="w-6 h-6 text-amber-500" />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0 pr-6">
              <DialogTitle className="text-base font-semibold leading-snug line-clamp-2">
                {docData?.title || "Loading Document Chunks..."}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                  {docData?.author && <span className="font-medium text-foreground/80">by {docData.author}</span>}
                  
                  {docData?.publishedAt && (
                    <span className="flex items-center gap-1 text-[11px] bg-secondary/60 px-2 py-0.5 rounded text-foreground/90 font-mono">
                      <Calendar className="w-3 h-3 text-blue-400" />
                      Uploaded: {format(new Date(docData.publishedAt), "MMM d, yyyy")}
                    </span>
                  )}

                  {docData?.processedAt && (
                    <span className="flex items-center gap-1 text-[11px] bg-secondary/60 px-2 py-0.5 rounded text-foreground/90 font-mono">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      Processed: {format(new Date(docData.processedAt), "MMM d, h:mm a")}
                      {docData.processingDurationMs && (
                        <span className="text-primary font-medium">
                          • {Math.round(docData.processingDurationMs / 1000)}s
                        </span>
                      )}
                    </span>
                  )}

                  {docData?.sourceUrl && (
                    <a
                      href={docData.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-medium text-[11px]"
                    >
                      Watch on YouTube <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {chunks.length > 0 && (
                    <Badge variant="secondary" className="text-[11px] font-normal py-0">
                      <FileText className="w-3 h-3 mr-1" />
                      {chunks.length} chunks indexed
                    </Badge>
                  )}
                </div>
              </DialogDescription>
            </div>
          </div>

          {/* Search Chunks Input & Clear All Chunks Button */}
          <div className="relative mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search across ${chunks.length} transcript chunks...`}
                className="pl-9 bg-secondary/40 text-xs h-9"
              />
            </div>
            {searchQuery && (
              <span className="text-[11px] text-muted-foreground shrink-0 px-1 font-mono">
                {filteredChunks.length} / {chunks.length}
              </span>
            )}
            {chunks.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleClearAllChunks}
                disabled={isClearingAll || isLoading}
                className="h-9 text-xs px-2.5 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300 font-medium shrink-0 gap-1.5"
                title="Delete all chunks and vectors for this video"
              >
                {isClearingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete All Chunks</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Chunks List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="text-sm">Loading chunks...</p>
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-secondary/10 rounded-xl border border-dashed border-border/50 p-6">
              <p className="text-sm font-medium text-foreground">
                {searchQuery
                  ? "No chunks matching your search."
                  : docData?.processingStatus === "FAILED"
                  ? "No chunks available (0 chunks extracted)."
                  : docData?.processingStatus === "PROCESSING"
                  ? "Chunks are currently being generated..."
                  : "No transcript chunks available for this video."}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? "Try searching for a different keyword or time range."
                  : docData?.errorMessage ||
                    "This video has not yet been transcribed or chunked into vectors."}
              </p>
            </div>
          ) : (
            filteredChunks.map((chunk) => (
              <div
                key={chunk.index}
                className="group relative border border-border/60 hover:border-border rounded-lg p-3.5 bg-card/60 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-foreground bg-secondary px-2 py-0.5 rounded">
                      Chunk #{chunk.index + 1}
                    </span>
                    {chunk.timeRange && (
                      <a
                        href={
                          docData?.sourceUrl && chunk.startSeconds !== undefined
                            ? `${docData.sourceUrl}${
                                docData.sourceUrl.includes("?") ? "&" : "?"
                              }t=${chunk.startSeconds}s`
                            : "#"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-[11px] text-red-400 hover:text-red-300 gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2 py-0.5 rounded font-mono transition-colors font-medium"
                        title="Click to jump to this exact video segment on YouTube"
                      >
                        <Clock className="w-3 h-3 text-red-400" />
                        <span>{chunk.timeRange}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    )}
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {chunk.wordCount} words • {chunk.charCount} chars
                    </span>
                    {searchQuery.trim() && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-medium">
                        {
                          (
                            chunk.content.match(
                              new RegExp(
                                searchQuery
                                  .trim()
                                  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                                "gi"
                              )
                            ) || []
                          ).length
                        }{" "}
                        match
                        {(
                          chunk.content.match(
                            new RegExp(
                              searchQuery
                                .trim()
                                .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                              "gi"
                            )
                          ) || []
                        ).length !== 1
                          ? "es"
                          : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-60 group-hover:opacity-100 transition"
                      onClick={() => handleCopy(chunk.content, chunk.index)}
                      title="Copy chunk text"
                    >
                      {copiedIndex === chunk.index ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10 opacity-60 group-hover:opacity-100 transition"
                      onClick={() => handleDeleteChunk(chunk.index)}
                      disabled={deletingChunkIndex === chunk.index}
                      title="Delete this chunk from Pinecone and database"
                    >
                      {deletingChunkIndex === chunk.index ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed select-text font-mono bg-secondary/20 p-2.5 rounded border border-border/20">
                  {highlightMatch(chunk.content, searchQuery)}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
