"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Trash2,
  Pause,
  Play,
  AlertCircle,
  CheckCircle,
  Loader2,
  Youtube,
  Globe,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  Eye,
  Clock,
  Sparkles,
  FastForward,
  Calendar,
  User,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  X,
  Activity,
  Maximize2,
  RotateCcw,
  Database,
} from "lucide-react";
import { SourceStatus, SourceType } from "@prisma/client";
import { formatDistanceToNow, format } from "date-fns";
import axios from "axios";
import { useToast } from "@/components/ui/use-toast";
import { ChunkViewerDialog } from "./ChunkViewerDialog";
import { VideoPlayerDialog } from "./VideoPlayerDialog";
import { ExecutionConsole } from "./ExecutionConsole";
import { formatDurationMs } from "@/lib/utils";

function formatDuration(isoDuration?: string | null): string {
  if (!isoDuration) return "";
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return isoDuration;
  const hours = match[1] ? `${match[1]}:` : "";
  const minutes = match[2] ? (hours ? match[2].padStart(2, "0") : match[2]) : "0";
  const seconds = (match[3] || "0").padStart(2, "0");
  return `${hours}${minutes}:${seconds}`;
}

function parseDurationToSeconds(isoDuration?: string | null): number {
  if (!isoDuration) return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

interface Source {
  id: string;
  type: SourceType;
  title: string;
  originalUrl?: string | null;
  canonicalUrl?: string | null;
  status: SourceStatus;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  totalChunks?: number;
  lastSyncedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  configuration?: any;
  documents?: any[];
}

interface SourceCardProps {
  source: Source;
  onUpdate: () => void;
}

type SortOption =
  | "UPLOAD_DESC"
  | "UPLOAD_ASC"
  | "PROCESSED_DESC"
  | "CHUNKS_DESC"
  | "CHUNKS_ASC"
  | "DURATION_DESC"
  | "TITLE_ASC";

export function SourceCard({ source, onUpdate }: SourceCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [documents, setDocuments] = useState<any[]>(source.documents || []);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [isChunkViewerOpen, setIsChunkViewerOpen] = useState(false);
  const [playerDoc, setPlayerDoc] = useState<any | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryingDocId, setRetryingDocId] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  // Multi-select status filter (Set of active status strings, empty = ALL)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("UPLOAD_DESC");

  const { toast } = useToast();

  // Sync state if parent preloaded or refreshed source documents
  useEffect(() => {
    if (source.documents && source.documents.length > 0) {
      setDocuments(source.documents);
    }
  }, [source.documents]);

  const isIngesting =
    source.status === "INGESTING" ||
    source.status === "DISCOVERING" ||
    source.status === "PENDING";

  // Live timer for active ingestion
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isIngesting) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isIngesting]);

  const documentsRef = useRef(documents);
  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const fetchDocuments = async (showLoading = false) => {
    if (showLoading) setIsLoadingDocs(true);
    try {
      const res = await axios.get(`/api/sources/${source.id}`);
      const docs = res.data.documents || [];
      setDocuments(docs);
      if (retryingDocId) {
        const found = docs.find((d: any) => d.id === retryingDocId);
        if (found && found.processingStatus !== "PROCESSING") {
          setRetryingDocId(null);
          onUpdateRef.current();
        }
      }
    } catch (err) {
      console.error("Failed to load source documents:", err);
    } finally {
      if (showLoading) setIsLoadingDocs(false);
    }
  };

  // Optimized polling only while actively ingesting or retrying
  useEffect(() => {
    const isSourceActive =
      source.status === "INGESTING" ||
      source.status === "DISCOVERING" ||
      source.status === "PENDING";

    // Strictly guard: Never poll if source is PAUSED, READY, PARTIAL, or FAILED
    if (!isSourceActive && retryingDocId === null) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/sources/${source.id}`);
        const docs = res.data.documents || [];
        setDocuments(docs);

        if (retryingDocId) {
          const found = docs.find((d: any) => d.id === retryingDocId);
          if (found && found.processingStatus !== "PROCESSING") {
            setRetryingDocId(null);
            onUpdateRef.current();
          }
        }

        // When source status transitions out of active ingestion, notify parent
        if (
          res.data.status !== "INGESTING" &&
          res.data.status !== "DISCOVERING" &&
          res.data.status !== "PENDING"
        ) {
          onUpdateRef.current();
        }
      } catch (err) {
        // silent
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [source.status, isIngesting, retryingDocId]);

  const handleClearLogs = async () => {
    try {
      await axios.patch(`/api/sources/${source.id}`, {
        configuration: {
          ...(source.configuration || {}),
          executionLogs: [],
        },
      });
      toast({ title: "Console logs cleared" });
      onUpdate();
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  const toggleExpand = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);
    if (nextState) {
      fetchDocuments(documents.length === 0);
    }
  };

  const getStatusColor = (status: SourceStatus) => {
    const colors: Record<SourceStatus, string> = {
      PENDING: "bg-amber-500",
      DISCOVERING: "bg-blue-500",
      DISCOVERED: "bg-blue-600",
      INGESTING: "bg-blue-500",
      READY: "bg-green-600",
      PARTIAL: "bg-amber-600",
      FAILED: "bg-red-500",
      PAUSED: "bg-zinc-500",
      NEEDS_TRANSCRIPT: "bg-yellow-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusIcon = (status: SourceStatus) => {
    switch (status) {
      case "READY":
        return <CheckCircle className="w-4 h-4" />;
      case "PARTIAL":
        return <AlertCircle className="w-4 h-4" />;
      case "INGESTING":
      case "DISCOVERING":
      case "PENDING":
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case "FAILED":
        return <AlertCircle className="w-4 h-4" />;
      case "PAUSED":
        return <Pause className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: SourceType) => {
    switch (type) {
      case "YOUTUBE_CHANNEL":
      case "YOUTUBE_PLAYLIST":
      case "YOUTUBE_VIDEO":
        return <Youtube className="w-5 h-5 text-red-500" />;
      case "WEBSITE":
      case "RSS_FEED":
        return <Globe className="w-5 h-5 text-blue-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const handleSync = async (batchSize?: number | "all") => {
    setIsLoading(true);
    try {
      await axios.patch(`/api/sources/${source.id}`, {
        action: "sync",
        batchSize: batchSize !== undefined ? batchSize : 25,
      });

      const label =
        batchSize === "all"
          ? "Syncing all remaining items in the background..."
          : `Syncing next batch of ${batchSize || 25} items in the background...`;

      toast({
        title: "Ingestion Started",
        description: label,
      });
      onUpdate();
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Failed to start sync",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    setIsLoading(true);
    try {
      await axios.patch(`/api/sources/${source.id}`, { action: "pause" });
      toast({ title: "Paused", description: "Source ingestion paused" });
      onUpdate();
    } catch (error) {
      toast({
        title: "Failed to pause",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Full source-wide retry
  const handleRetryAll = async () => {
    setIsLoading(true);
    try {
      await axios.patch(`/api/sources/${source.id}`, { action: "retry" });
      toast({
        title: "Source Retry Started",
        description: `Retrying ${source.failedItems} failed items across this source`,
      });
      onUpdate();
    } catch (error) {
      toast({
        title: "Retry failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Single video specific retry
  const handleRetrySingleDoc = async (docId: string, docTitle: string) => {
    setRetryingDocId(docId);
    try {
      await axios.patch(`/api/sources/${source.id}`, {
        action: "retry_document",
        documentId: docId,
      });

      toast({
        title: "Retrying Video",
        description: `Starting retry for: "${docTitle.slice(0, 42)}..."`,
      });

      // Instantly mark doc as PROCESSING in local state for zero-latency UI feedback
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                processingStatus: "PROCESSING",
                errorMessage: null,
                liveStep: "Starting ingestion pipeline...",
              }
            : d
        )
      );

      // Trigger update
      setTimeout(() => {
        fetchDocuments(false);
        onUpdate();
      }, 1000);
    } catch (err: any) {
      toast({
        title: "Retry failed",
        description: err?.response?.data?.error || "Could not retry document",
        variant: "destructive",
      });
      setRetryingDocId(null);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this source? This will remove all associated data and vector embeddings."
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      await axios.delete(`/api/sources/${source.id}`);
      toast({ title: "Source deleted" });
      onUpdate();
    } catch (error) {
      toast({
        title: "Failed to delete source",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVideo = async (docId: string, docTitle: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${docTitle}"?\nThis video and all its vectors will be permanently removed from Pinecone and the database.`
      )
    ) {
      return;
    }

    // Optimistic UI update: remove instantly from UI for zero-latency response
    setDocuments((prev) => prev.filter((d) => d.id !== docId));

    try {
      await axios.delete(`/api/documents/${docId}`);
      toast({
        title: "Video deleted",
        description: `"${docTitle}" and its vectors were removed.`,
      });
      onUpdateRef.current();
    } catch (err: any) {
      fetchDocuments(false);
      toast({
        title: "Delete failed",
        description: err?.response?.data?.error || "Could not delete video",
        variant: "destructive",
      });
    }
  };

  const isPartial =
    source.status === "PARTIAL" ||
    (source.totalItems > 0 && source.processedItems < source.totalItems);

  const progress =
    source.totalItems > 0
      ? Math.min(100, Math.round((source.processedItems / source.totalItems) * 100))
      : 0;

  const config = source.configuration || {};
  const lastDurationMs = config.lastProcessingDurationMs;
  const liveActivity = config.liveActivity;

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${String(secs).padStart(2, "0")}s`;
  };

  // Status counts for filter tabs
  const counts = useMemo(() => {
    const res = {
      ALL: documents.length,
      COMPLETED: 0,
      FAILED: 0,
      PROCESSING: 0,
      SKIPPED: 0,
    };
    for (const d of documents) {
      if (d.processingStatus === "COMPLETED") res.COMPLETED++;
      else if (d.processingStatus === "FAILED") res.FAILED++;
      else if (d.processingStatus === "PROCESSING") res.PROCESSING++;
      else if (d.processingStatus === "SKIPPED") res.SKIPPED++;
    }
    return res;
  }, [documents]);

  // Multi-select status toggle handler
  const toggleStatusFilter = (status: string) => {
    if (status === "ALL") {
      setSelectedStatuses(new Set());
      return;
    }

    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  // Filter and sort documents
  const filteredAndSortedDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        // Multi-select status filter (empty set = ALL)
        if (selectedStatuses.size > 0 && !selectedStatuses.has(doc.processingStatus)) {
          return false;
        }
        // Search query (title, author, error)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchTitle = doc.title?.toLowerCase().includes(q);
          const matchAuthor = doc.author?.toLowerCase().includes(q);
          const matchError = doc.errorMessage?.toLowerCase().includes(q);
          if (!matchTitle && !matchAuthor && !matchError) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "UPLOAD_DESC": {
            const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return timeB - timeA;
          }
          case "UPLOAD_ASC": {
            const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return timeA - timeB;
          }
          case "PROCESSED_DESC": {
            const timeA = new Date(a.processedAt || a.createdAt).getTime();
            const timeB = new Date(b.processedAt || b.createdAt).getTime();
            return timeB - timeA;
          }
          case "CHUNKS_DESC":
            return (b.chunkCount || 0) - (a.chunkCount || 0);
          case "CHUNKS_ASC":
            return (a.chunkCount || 0) - (b.chunkCount || 0);
          case "DURATION_DESC": {
            const durA = parseDurationToSeconds(a.duration);
            const durB = parseDurationToSeconds(b.duration);
            return durB - durA;
          }
          case "TITLE_ASC":
            return (a.title || "").localeCompare(b.title || "");
          default:
            return 0;
        }
      });
  }, [documents, selectedStatuses, searchQuery, sortBy]);

  return (
    <Card className="border border-border/80 shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-1">{getTypeIcon(source.type)}</div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{source.title}</CardTitle>
              {source.canonicalUrl && (
                <a
                  href={source.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mt-1 truncate"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{source.canonicalUrl}</span>
                </a>
              )}
            </div>
          </div>

          <Badge
            className={`${getStatusColor(
              source.status
            )} text-white flex items-center gap-1.5 px-2.5 py-1 text-xs shrink-0 font-semibold`}
          >
            {getStatusIcon(source.status)}
            <span>
              {source.status === "PARTIAL"
                ? `PARTIAL (${source.processedItems}/${source.totalItems})`
                : source.status}
            </span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Section */}
        {source.totalItems > 0 && (
          <div className="space-y-2 bg-secondary/20 p-3.5 rounded-lg border border-border/40">
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <span>Progress</span>
                {isIngesting && (
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1.5 font-mono text-blue-500 border-blue-500/30 bg-blue-500/10"
                  >
                    ⏱️ {formatTimer(elapsedSeconds)} elapsed
                  </Badge>
                )}
              </span>
              <span className="font-semibold text-foreground">
                {source.processedItems} / {source.totalItems} items ({progress}%)
              </span>
            </div>
            <Progress value={progress} className="h-2.5 bg-secondary" />

            {/* Live Terminal Ingestion Progress Banner */}
            {liveActivity && liveActivity.activeVideo ? (
              <div className="mt-2.5 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs animate-pulse">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Activity className="w-4 h-4 text-blue-400 shrink-0 animate-spin" />
                  <div className="min-w-0">
                    <span className="font-semibold text-blue-300 mr-1.5">Live Pipeline:</span>
                    <span className="text-foreground truncate font-medium">
                      "{liveActivity.activeVideo}"
                    </span>
                    <span className="text-blue-400 font-mono text-[11px] ml-2 font-semibold">
                      [{liveActivity.step}]
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="border-blue-400/40 text-blue-300 bg-blue-400/10 text-[10px] font-mono shrink-0 ml-2">
                  ⚡ Live Ingestion
                </Badge>
              </div>
            ) : isIngesting ? (
              <p className="text-[11px] text-muted-foreground italic flex items-center gap-1 mt-1">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span>
                  Processing video {source.processedItems + 1} of {source.totalItems} (live chunks streaming to vector store)...
                </span>
              </p>
            ) : null}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm bg-card/60 p-3 rounded-lg border border-border/50">
          <div>
            <div className="text-muted-foreground text-xs">Total Items</div>
            <div className="font-bold text-foreground text-base mt-0.5">
              {source.totalItems}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Processed</div>
            <div className="font-bold text-green-500 text-base mt-0.5">
              {source.processedItems}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Transcripts Fed</div>
            <div className="font-bold text-primary text-base mt-0.5">
              {(source.totalChunks || 0).toLocaleString()} chunks
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Failed / Skipped</div>
            <div className="font-bold text-red-500 text-base mt-0.5">
              {source.failedItems}
            </div>
          </div>
        </div>

        {/* Timestamps & Processing Duration Info */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1">
          {source.lastSyncedAt && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary/80" />
              <span>
                Last synced{" "}
                {formatDistanceToNow(new Date(source.lastSyncedAt), {
                  addSuffix: true,
                })}{" "}
                ({format(new Date(source.lastSyncedAt), "MMM d, h:mm a")})
              </span>
            </div>
          )}

          {lastDurationMs && (
            <div className="flex items-center gap-1 font-mono text-[11px] bg-secondary/50 px-2 py-0.5 rounded">
              <span>⏱️ Sync Duration: {formatDurationMs(lastDurationMs)}</span>
              {source.processedItems > 0 && (
                <span className="opacity-75">
                  (~
                  {Math.round(
                    lastDurationMs / 1000 / Math.max(1, source.processedItems)
                  )}
                  s / video)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border/40">
          {/* Left: Ingestion Pipeline Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {isPartial && !isIngesting && (
              <Button
                type="button"
                size="sm"
                onClick={() => handleSync(25)}
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm gap-1.5 h-8 text-xs"
              >
                <FastForward className="w-3.5 h-3.5" />
                Continue Ingestion (+25)
              </Button>
            )}

            {isPartial && !isIngesting && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleSync("all")}
                disabled={isLoading}
                className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10 gap-1.5 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Sync All Remaining ({source.totalItems - source.processedItems})
              </Button>
            )}

            {isIngesting && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handlePause}
                disabled={isLoading}
                className="h-8 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10 gap-1.5 font-medium"
              >
                <Pause className="w-3.5 h-3.5" />
                Pause Ingestion
              </Button>
            )}

            {source.status === "PAUSED" && (
              <Button
                type="button"
                size="sm"
                onClick={() => handleSync("all")}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm gap-1.5 h-8 text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                Resume Ingestion
              </Button>
            )}
          </div>

          {/* Right: Maintenance & Management Controls */}
          <div className="flex items-center gap-2 shrink-0 sm:justify-end">
            {source.failedItems > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRetryAll}
                disabled={isLoading || isIngesting}
                className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5 font-medium"
                title="Retry all failed videos across this source"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Failed ({source.failedItems})
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleSync(25)}
              disabled={isLoading || isIngesting}
              className="h-8 text-xs gap-1.5 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync
            </Button>

            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
              className="h-8 text-xs gap-1.5 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Real-time Ingestion & Service Execution Console */}
        <ExecutionConsole
          logs={source.configuration?.executionLogs || []}
          isLive={isIngesting || retryingDocId !== null || Boolean(liveActivity)}
          onClear={handleClearLogs}
          defaultExpanded={Boolean(isIngesting || liveActivity || retryingDocId || (source.configuration?.executionLogs && source.configuration.executionLogs.length > 0))}
        />

        {/* Collapsible Feeded Content & Videos List */}
        <div className="pt-3 border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleExpand}
            className="w-full flex items-center justify-between text-xs py-2 px-3 h-auto bg-secondary/30 hover:bg-secondary/60 rounded-lg transition"
          >
            <span className="flex items-center gap-2 font-semibold text-foreground">
              <Layers className="w-4 h-4 text-primary" />
              Feeded Content &amp; Videos ({documents.length || source.processedItems || 0})
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              {isExpanded ? "Hide Feeded Items" : "View Feeded Items"}
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
          </Button>

          {isExpanded && (
            <div className="mt-4 space-y-4">
              {/* Filter, Search & Sort Toolbar with Multi-Select Filters */}
              <div className="bg-secondary/20 border border-border/60 rounded-xl p-3.5 space-y-3">
                {/* Row 1: Search Input & Sort Selector */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search videos by title, author, or keyword..."
                      className="pl-8 pr-8 h-8 text-xs bg-background/80 border-border/60"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Sort Dropdown */}
                  <div className="flex items-center gap-2 shrink-0">
                    <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="h-8 text-xs rounded-md border border-border/60 bg-background/90 px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    >
                      <option value="UPLOAD_DESC">Uploaded: Newest</option>
                      <option value="UPLOAD_ASC">Uploaded: Oldest</option>
                      <option value="PROCESSED_DESC">Processed: Recent</option>
                      <option value="CHUNKS_DESC">Chunks: High → Low</option>
                      <option value="CHUNKS_ASC">Chunks: Low → High</option>
                      <option value="DURATION_DESC">Duration: Longest</option>
                      <option value="TITLE_ASC">Title: A → Z</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Multi-Select Status Filter Pills */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1.5 border-t border-border/40">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* All (Reset multi-select) */}
                    <button
                      type="button"
                      onClick={() => toggleStatusFilter("ALL")}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${
                        selectedStatuses.size === 0
                          ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      All ({counts.ALL})
                    </button>

                    {/* Completed Multi-Select Pill */}
                    <button
                      type="button"
                      onClick={() => toggleStatusFilter("COMPLETED")}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition border flex items-center gap-1.5 ${
                        selectedStatuses.has("COMPLETED")
                          ? "bg-emerald-600 border-emerald-500 text-white shadow-xs font-semibold"
                          : "border-transparent text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
                      }`}
                    >
                      <CheckCircle className="w-3 h-3 text-emerald-300" />
                      <span>Completed ({counts.COMPLETED})</span>
                    </button>

                    {/* Failed Multi-Select Pill */}
                    <button
                      type="button"
                      onClick={() => toggleStatusFilter("FAILED")}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition border flex items-center gap-1.5 ${
                        selectedStatuses.has("FAILED")
                          ? "bg-red-600 border-red-500 text-white shadow-xs font-semibold"
                          : "border-transparent text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      }`}
                    >
                      <AlertCircle className="w-3 h-3 text-red-300" />
                      <span>Failed ({counts.FAILED})</span>
                    </button>

                    {/* Processing Multi-Select Pill */}
                    {counts.PROCESSING > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleStatusFilter("PROCESSING")}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition border flex items-center gap-1.5 ${
                          selectedStatuses.has("PROCESSING")
                            ? "bg-amber-600 border-amber-500 text-white shadow-xs font-semibold"
                            : "border-transparent text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
                        }`}
                      >
                        <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
                        <span>Processing ({counts.PROCESSING})</span>
                      </button>
                    )}

                    {/* Skipped Multi-Select Pill */}
                    {counts.SKIPPED > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleStatusFilter("SKIPPED")}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition border ${
                          selectedStatuses.has("SKIPPED")
                            ? "bg-zinc-600 border-zinc-500 text-white shadow-xs font-semibold"
                            : "border-transparent text-muted-foreground hover:text-zinc-300 hover:bg-zinc-500/10"
                        }`}
                      >
                        Skipped ({counts.SKIPPED})
                      </button>
                    )}

                    {selectedStatuses.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedStatuses(new Set())}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 ml-1 underline decoration-dotted"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Clear filter
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] text-muted-foreground font-mono">
                    Showing {filteredAndSortedDocs.length} of {documents.length} videos
                  </span>
                </div>
              </div>

              {/* Document Cards List */}
              {isLoadingDocs ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                  <p className="text-xs">Loading feeded content &amp; videos...</p>
                </div>
              ) : filteredAndSortedDocs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs bg-secondary/10 rounded-xl border border-dashed border-border/60">
                  {searchQuery || selectedStatuses.size > 0
                    ? "No videos matching your filter criteria."
                    : "No documents found for this source yet."}
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-[620px] overflow-y-auto overflow-x-hidden pr-1.5">
                  {filteredAndSortedDocs.map((doc: any, index: number) => {
                    const processedDate = doc.processedAt || doc.createdAt;
                    const isDocRetrying = retryingDocId === doc.id;
                    const isProcessing = doc.processingStatus === "PROCESSING" || isDocRetrying;

                    return (
                      <div
                        key={doc.id || index}
                        className="flex flex-col sm:flex-row gap-3.5 p-3.5 rounded-xl border border-border/70 bg-card/60 hover:bg-card/90 hover:border-primary/40 transition-all shadow-xs group min-w-0"
                      >
                        {/* Left: Clickable 16:9 Thumbnail (Opens In-Platform Player Dialog) */}
                        <div
                          onClick={() => {
                            setPlayerDoc(doc);
                            setIsPlayerOpen(true);
                          }}
                          className="relative w-full sm:w-36 md:w-40 aspect-video rounded-lg overflow-hidden shrink-0 border border-border/60 bg-muted/80 self-start group/thumb cursor-pointer shadow-xs"
                          title="Click to play &amp; listen to video in dialog"
                        >
                          {doc.thumbnail ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={doc.thumbnail}
                              alt={doc.title}
                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-secondary/80 flex items-center justify-center">
                              {doc.sourceType?.startsWith("YOUTUBE") ? (
                                <Youtube className="w-8 h-8 text-red-500" />
                              ) : doc.sourceType === "WEBSITE" ? (
                                <Globe className="w-8 h-8 text-blue-500" />
                              ) : (
                                <FileText className="w-8 h-8 text-amber-500" />
                              )}
                            </div>
                          )}

                          {/* Hover Play Overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white">
                            <div className="w-8 h-8 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-white text-white translate-x-0.5" />
                            </div>
                            <span className="text-[10px] font-semibold tracking-wide drop-shadow-sm">
                              Play &amp; Listen
                            </span>
                          </div>

                          {/* Duration Pill */}
                          {doc.duration && (
                            <span className="absolute bottom-1 right-1 bg-black/90 text-white text-[10px] px-1.5 py-0.5 rounded font-mono font-medium leading-none shadow-sm">
                              {formatDuration(doc.duration)}
                            </span>
                          )}
                        </div>

                        {/* Right: Rich Information Column */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2">
                          {/* Title & Channel Author */}
                          <div>
                            <div className="flex items-start justify-between gap-1.5">
                              <a
                                href={doc.sourceUrl || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-xs sm:text-sm text-foreground hover:text-primary transition line-clamp-2 leading-snug flex items-start gap-1 group/link"
                                title={doc.title}
                              >
                                <span className="line-clamp-2">{doc.title}</span>
                                {doc.sourceUrl && (
                                  <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-60 group-hover/link:opacity-100 group-hover/link:text-primary transition" />
                                )}
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  setPlayerDoc(doc);
                                  setIsPlayerOpen(true);
                                }}
                                className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
                                title="Maximize video player"
                              >
                                <Maximize2 className="w-3 h-3 opacity-60 hover:opacity-100" />
                              </button>
                            </div>

                            {doc.author && (
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono truncate mt-1">
                                <User className="w-3 h-3 text-sky-400 shrink-0" />
                                <span className="truncate">{doc.author}</span>
                              </div>
                            )}
                          </div>

                          {/* Timestamps Row */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground font-mono">
                            {doc.publishedAt && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-blue-400 shrink-0" />
                                <span>
                                  Uploaded: {format(new Date(doc.publishedAt), "MMM d, yyyy")}
                                </span>
                              </div>
                            )}
                            {processedDate && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>
                                  Processed: {format(new Date(processedDate), "MMM d, h:mm a")}
                                  {doc.processingDurationMs
                                    ? ` (~${Math.round(doc.processingDurationMs / 1000)}s)`
                                    : ""}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Badges: Hinglish, Pinecone */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {doc.hasTranscript && (
                              <span className="text-[10px] bg-secondary/80 text-muted-foreground px-2 py-0.5 rounded font-mono shrink-0 flex items-center gap-1">
                                <Globe className="w-3 h-3 text-sky-400" />
                                {doc.originalLanguage === "hi" ? "Hinglish → EN" : "English"}
                              </span>
                            )}
                            {doc.processingStatus === "COMPLETED" && (
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono shrink-0 flex items-center gap-1 font-medium">
                                <Sparkles className="w-3 h-3" />
                                Pinecone Indexed
                              </span>
                            )}
                          </div>

                          {/* Status / Live Activity HUD / Error Message Box */}
                          {isProcessing ? (
                            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1 font-mono">
                              <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                                <span>Live Ingestion Pipeline</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handlePause();
                                  }}
                                  disabled={isLoading}
                                  className="ml-auto h-5 text-[10px] px-2 border-amber-400/40 text-amber-300 hover:bg-amber-400/20 font-semibold gap-1"
                                  title="Pause ingestion for all videos"
                                >
                                  <Pause className="w-2.5 h-2.5" />
                                  <span>Pause</span>
                                </Button>
                              </div>
                              <p className="text-[11px] text-amber-300 leading-tight">
                                {doc.liveStep ||
                                  (liveActivity?.activeVideo === doc.title
                                    ? liveActivity.step
                                    : "Translating transcript, chunking & vectorizing to Pinecone...")}
                              </p>
                            </div>
                          ) : doc.processingStatus === "FAILED" ? (
                            <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20 text-[11px] text-red-400 leading-tight flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                              <span
                                className="line-clamp-2"
                                title={doc.errorMessage || "Processing failed"}
                              >
                                {doc.errorMessage &&
                                (doc.errorMessage.includes("quota") ||
                                  doc.errorMessage.includes("429") ||
                                  doc.errorMessage.includes("RESOURCE_EXHAUSTED"))
                                  ? "Gemini embedding quota reached for today (1,000/day limit on Free Tier)."
                                  : doc.errorMessage || "Processing failed."}
                              </span>
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-md bg-emerald-500/5 border border-emerald-500/15 text-[11px] text-emerald-400/90 leading-tight flex items-center gap-1.5 font-mono">
                              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>Vector indexed • Ready for Companion RAG chat</span>
                            </div>
                          )}

                          {/* Card Footer: Status Badge + Chunks Count (Left) & Actions (Right) */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0.5 font-semibold shrink-0 uppercase tracking-wider ${
                                  doc.processingStatus === "COMPLETED"
                                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                    : isProcessing
                                    ? "border-amber-500/40 text-amber-400 bg-amber-500/10 animate-pulse"
                                    : "border-red-500/40 text-red-400 bg-red-500/10"
                                }`}
                              >
                                {isDocRetrying ? "RETRYING..." : doc.processingStatus}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {doc.chunkCount || 0} chunks
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {doc.processingStatus === "FAILED" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isDocRetrying || isIngesting}
                                  className="h-7 text-xs px-2.5 gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10 font-medium"
                                  onClick={() => handleRetrySingleDoc(doc.id, doc.title)}
                                  title="Retry this specific video"
                                >
                                  {isDocRetrying ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  <span>Retry</span>
                                </Button>
                              )}

                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs px-2.5 gap-1 hover:bg-primary hover:text-primary-foreground transition font-medium"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedDoc(doc);
                                  setIsChunkViewerOpen(true);
                                }}
                                title="Inspect individual transcript chunks fed into vector DB"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Chunks</span>
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 font-medium"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteVideo(doc.id, doc.title);
                                }}
                                title="Delete this video and all its Pinecone vectors"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* In-Platform Video Player Dialog (Listen & View Video) */}
        <VideoPlayerDialog
          document={playerDoc}
          open={isPlayerOpen}
          onOpenChange={setIsPlayerOpen}
          onRetry={handleRetrySingleDoc}
          onOpenChunks={(doc) => {
            setSelectedDoc(doc);
            setIsChunkViewerOpen(true);
          }}
        />

        {/* Chunk Inspection Dialog */}
        <ChunkViewerDialog
          documentId={selectedDoc?.id || null}
          initialDoc={selectedDoc}
          open={isChunkViewerOpen}
          onOpenChange={setIsChunkViewerOpen}
          onChunksUpdated={(newCount) => {
            if (selectedDoc) {
              setDocuments((prev) =>
                prev.map((d) =>
                  d.id === selectedDoc.id ? { ...d, chunkCount: newCount } : d
                )
              );
            }
            onUpdateRef.current();
          }}
        />
      </CardContent>
    </Card>
  );
}
