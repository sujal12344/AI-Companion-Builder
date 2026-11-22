"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Youtube,
  Globe,
  FileText,
  Clock,
  Copy,
  Check,
  Play,
  Pause,
  RotateCcw,
  Rewind,
  FastForward,
  Sparkles,
} from "lucide-react";
import { Citation } from "@/lib/sources/types";
import { SourceType } from "@prisma/client";
import { useToast } from "@/components/ui/use-toast";

interface CitationDetailDialogProps {
  citation: Citation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Global YouTube IFrame API Loader (Singleton)
let ytApiPromise: Promise<any> | null = null;
function loadYouTubeIframeAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject("Window is undefined");
  if ((window as any).YT && (window as any).YT.Player) {
    return Promise.resolve((window as any).YT);
  }
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const existingScript = document.getElementById("youtube-iframe-api-script");
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.id = "youtube-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }

      const prevCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === "function") prevCallback();
        resolve((window as any).YT);
      };

      // Fallback poller in case API loaded before callback attached
      const interval = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          clearInterval(interval);
          resolve((window as any).YT);
        }
      }, 100);
    });
  }
  return ytApiPromise;
}

export function CitationDetailDialog({
  citation,
  open,
  onOpenChange,
}: CitationDetailDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [chunkElapsed, setChunkElapsed] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const playerRef = useRef<any>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef(false);

  const videoId =
    (citation?.sourceUrl
      ? citation.sourceUrl.match(/(?:v=|\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1]
      : null) ||
    (citation?.timestamp?.url
      ? citation.timestamp.url.match(/(?:v=|\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1]
      : null);

  const startSec = citation?.timestamp?.startSeconds ?? 0;
  const endSec = citation?.timestamp?.endSeconds ?? (startSec + 30);
  const chunkDuration = Math.max(1, endSec - startSec);

  // Initialize official YouTube IFrame Player when dialog opens
  useEffect(() => {
    if (!open || !videoId) return;

    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;
    setIsReady(false);
    setChunkElapsed(0);
    setIsPlaying(true);

    loadYouTubeIframeAPI().then((YT) => {
      if (!isMounted) return;

      const containerId = `yt-chunk-container-${videoId}`;
      const elem = document.getElementById(containerId);
      if (!elem) return;

      // Clean up previous player instance if any
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";

      const player = new YT.Player(containerId, {
        videoId: videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          start: startSec,
          end: endSec,
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          enablejsapi: 1,
          origin: origin,
        },
        events: {
          onReady: (event: any) => {
            if (!isMounted) return;
            playerRef.current = event.target;
            setIsReady(true);
            try {
              event.target.playVideo();
              setIsPlaying(true);
            } catch (err) {}
          },
          onStateChange: (event: any) => {
            if (!isMounted) return;
            // YT.PlayerState: 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 3 = BUFFERING
            if (event.data === 1) {
              setIsPlaying(true);
            } else if (event.data === 2) {
              setIsPlaying(false);
            } else if (event.data === 0) {
              setIsPlaying(false);
              setChunkElapsed(chunkDuration);
            }
          },
        },
      });

      playerRef.current = player;

      // Real-time synchronization poller (runs every 200ms)
      pollInterval = setInterval(() => {
        if (!isMounted || isSeekingRef.current) return;
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          try {
            const current = playerRef.current.getCurrentTime();
            if (typeof current === "number" && !isNaN(current)) {
              const elapsed = Math.max(0, Math.min(chunkDuration, Math.round(current - startSec)));
              setChunkElapsed(elapsed);

              // Auto-pause when reaching chunk end boundary
              if (current >= endSec) {
                playerRef.current.pauseVideo();
                setIsPlaying(false);
                setChunkElapsed(chunkDuration);
              }
            }
          } catch (e) {}
        }
      }, 200);
    });

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [open, videoId, startSec, endSec, chunkDuration]);

  // Player controls
  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        if (chunkElapsed >= chunkDuration) {
          playerRef.current.seekTo(startSec, true);
          playerRef.current.playVideo();
          setChunkElapsed(0);
          setIsPlaying(true);
        } else {
          playerRef.current.playVideo();
          setIsPlaying(true);
        }
      }
    } catch (err) {}
  }, [isPlaying, chunkElapsed, chunkDuration, startSec]);

  const handleReplay = useCallback(() => {
    if (!playerRef.current) return;
    try {
      playerRef.current.seekTo(startSec, true);
      playerRef.current.playVideo();
      setChunkElapsed(0);
      setIsPlaying(true);
    } catch (err) {}
  }, [startSec]);

  const seekRelative = useCallback(
    (delta: number) => {
      if (!playerRef.current) return;
      try {
        const current = playerRef.current.getCurrentTime?.() ?? (startSec + chunkElapsed);
        const newTime = Math.max(startSec, Math.min(endSec, current + delta));
        playerRef.current.seekTo(newTime, true);
        const newElapsed = Math.max(0, Math.min(chunkDuration, Math.round(newTime - startSec)));
        setChunkElapsed(newElapsed);
      } catch (err) {}
    },
    [startSec, endSec, chunkDuration, chunkElapsed]
  );

  // Interactive timeline slider seek
  const handleTimelineSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !playerRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetElapsed = Math.round(ratio * chunkDuration);
    const targetTime = startSec + targetElapsed;

    setChunkElapsed(targetElapsed);
    try {
      playerRef.current.seekTo(targetTime, true);
      if (!isPlaying) {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch (err) {}
  };

  const getSourceIcon = (type: SourceType) => {
    if (type?.includes("YOUTUBE")) return <Youtube className="w-5 h-5 text-red-500" />;
    if (type === "WEBSITE" || type === "RSS_FEED") return <Globe className="w-5 h-5 text-blue-500" />;
    return <FileText className="w-5 h-5 text-gray-400" />;
  };

  const formatSeconds = (sec?: number) => {
    if (sec === undefined || isNaN(sec)) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const onCopyText = () => {
    if (!citation?.excerpt) return;
    navigator.clipboard.writeText(citation.excerpt);
    setCopied(true);
    toast({
      description: "Transcript chunk copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!citation) return null;

  const timeLabel =
    citation.timestamp?.startSeconds !== undefined
      ? `${formatSeconds(citation.timestamp.startSeconds)}${
          citation.timestamp.endSeconds !== undefined
            ? ` - ${formatSeconds(citation.timestamp.endSeconds)}`
            : ""
        }`
      : null;

  const wordCount = citation.excerpt ? citation.excerpt.trim().split(/\s+/).length : 0;
  const charCount = citation.excerpt ? citation.excerpt.length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto p-5 sm:p-6 bg-background border border-border shadow-2xl">
        <DialogHeader className="space-y-3 pb-2 border-b border-border pr-10 sm:pr-12">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {getSourceIcon(citation.sourceType)}
              <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-primary/40 bg-primary/10 text-primary">
                Source {citation.index ? `[${citation.index}]` : "Reference"}
              </Badge>
              {citation.chunkIndex !== undefined && (
                <Badge variant="secondary" className="text-[11px] font-mono">
                  Chunk #{citation.chunkIndex + 1}
                </Badge>
              )}
            </div>

            {timeLabel && (
              <Badge className="bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/30 flex items-center gap-1.5 text-xs font-mono shrink-0">
                <Clock className="w-3.5 h-3.5" />
                <span>{timeLabel}</span>
              </Badge>
            )}
          </div>

          <div>
            <DialogTitle className="text-base sm:text-lg font-bold leading-snug line-clamp-2">
              {citation.title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                {citation.author && <span>By {citation.author}</span>}
                {citation.author && <span>•</span>}
                <span>Knowledge chunk used to formulate companion&apos;s answer</span>
              </div>
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          {/* In-Platform Video Player (Official YouTube API + Bottom Overlay Clipped Off) */}
          {videoId ? (
            <div className="space-y-2">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border bg-black shadow-lg">
                <div className="w-full h-full relative overflow-hidden">
                  <div
                    id={`yt-chunk-container-${videoId}`}
                    className="w-full h-[calc(100%+54px)] -mb-[54px] pointer-events-auto"
                  />
                </div>
              </div>

              {/* Fully Synchronized & Seekable Chunk Controls HUD */}
              <div className="p-3 rounded-xl bg-card/75 border border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs shadow-xs">
                {/* Control Buttons: Play/Pause, Rewind -5s, FastForward +5s, Replay */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={togglePlay}
                    className="h-8 w-8 p-0 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition"
                    title={isPlaying ? "Pause chunk" : "Play chunk"}
                  >
                    {isPlaying ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                    )}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => seekRelative(-5)}
                    className="h-8 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground font-mono"
                    title="Rewind 5 seconds in this chunk"
                  >
                    <Rewind className="w-3 h-3" />
                    <span>-5s</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => seekRelative(5)}
                    className="h-8 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground font-mono"
                    title="Forward 5 seconds in this chunk"
                  >
                    <FastForward className="w-3 h-3" />
                    <span>+5s</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleReplay}
                    className="h-8 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                    title="Replay this chunk from beginning"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Replay</span>
                  </Button>
                </div>

                {/* Interactive Seekable Timeline Bar (Click anywhere to jump ahead/back in chunk) */}
                <div className="flex-1 space-y-1.5 min-w-[180px]">
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span className="text-foreground font-semibold">
                      {formatSeconds(chunkElapsed)}
                    </span>
                    <span className="text-[10px] opacity-75 font-sans">
                      {timeLabel ? `(${timeLabel})` : ""}
                    </span>
                    <span>{formatSeconds(chunkDuration)}</span>
                  </div>

                  <div
                    ref={progressBarRef}
                    onClick={handleTimelineSeek}
                    className="relative w-full h-4 flex items-center cursor-pointer group/slider py-1 select-none"
                    title="Click anywhere to seek ahead or backward in this chunk"
                  >
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden relative">
                      <div
                        className="bg-primary h-full transition-all duration-150 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round((chunkElapsed / chunkDuration) * 100))}%`,
                        }}
                      />
                    </div>
                    {/* Hover Seek Indicator Knob */}
                    <div
                      className="absolute w-3.5 h-3.5 bg-primary border-2 border-background rounded-full shadow-md -translate-x-1/2 opacity-0 group-hover/slider:opacity-100 transition-opacity pointer-events-none"
                      style={{
                        left: `${Math.min(100, Math.round((chunkElapsed / chunkDuration) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10 shrink-0 font-medium hidden md:inline-flex"
                >
                  Chunk #{citation.chunkIndex !== undefined ? citation.chunkIndex + 1 : ""}
                </Badge>
              </div>
            </div>
          ) : citation.thumbnail ? (
            <div className="relative group rounded-xl overflow-hidden border border-border bg-black/40 aspect-video w-full max-h-56">
              <Image
                src={citation.thumbnail}
                alt={citation.title}
                fill
                sizes="(max-width: 768px) 100vw, 650px"
                className="object-cover"
              />
            </div>
          ) : null}

          {/* Exact Transcript Chunk Box */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground">
                  Exact Chunk Fed to Companion
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-mono">
                  {wordCount} words • {charCount} chars
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCopyText}
                  className="h-7 px-2 text-xs hover:bg-primary/10 gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-green-500 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-background/80 rounded-lg p-3.5 border border-border/80 text-xs sm:text-sm text-foreground/90 font-mono leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto selection:bg-primary/20">
              {citation.excerpt || "No transcript preview available for this chunk."}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
