"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import {
  ChevronLeft,
  Edit,
  MessageSquare,
  MoreVertical,
  Trash,
  Youtube,
  FileText,
  Globe,
  BookOpen,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Companion, Message, SourceType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { BotAvatar } from "@/components/BotAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@clerk/nextjs";
import { useToast } from "./ui/use-toast";
import errorResponse from "@/lib/errorResponse";

interface ChatHeaderProps {
  companion: Companion & {
    messages: Message[];
    sources?: {
      id: string;
      type: SourceType;
      title: string;
      status: string;
    }[];
    documents?: {
      id: string;
      title: string;
      sourceType: SourceType;
      chunkCount: number;
      processingStatus: string;
    }[];
    _count: {
      messages: number;
      sources?: number;
      documents?: number;
    };
  };
}

const ChatHeader = ({ companion }: ChatHeaderProps) => {
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  // Local state initialized with server props, updated in real time via polling
  const [sources, setSources] = useState(companion.sources || []);
  const [documents, setDocuments] = useState(companion.documents || []);
  const [messagesCount, setMessagesCount] = useState(companion._count.messages);

  // Real-time polling only if active background ingestion is in progress
  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;
    let pollCount = 0;
    const MAX_POLLS = 15;

    // Only start polling if there is active work according to initial data
    const initialHasWork =
      (companion.sources || []).some(
        (s: any) => s.status === "INGESTING" || s.status === "DISCOVERING"
      ) ||
      (companion.documents || []).some(
        (d: any) =>
          d.processingStatus === "PROCESSING" ||
          d.processingStatus === "PENDING"
      );

    if (!initialHasWork) {
      // Nothing is processing; do not poll at all
      return;
    }

    const pollStats = async () => {
      if (!isMounted || pollCount >= MAX_POLLS) return;
      pollCount++;

      try {
        const res = await axios.get(`/api/companion/${companion.id}`);
        if (!isMounted || !res.data) return;

        if (res.data.documents) setDocuments(res.data.documents);
        if (res.data.sources) setSources(res.data.sources);
        if (res.data._count?.messages !== undefined) {
          setMessagesCount(res.data._count.messages);
        }

        const stillHasWork =
          res.data.sources?.some(
            (s: any) => s.status === "INGESTING" || s.status === "DISCOVERING"
          ) ||
          res.data.documents?.some(
            (d: any) =>
              d.processingStatus === "PROCESSING" ||
              d.processingStatus === "PENDING"
          );

        // Only continue polling if there is still ongoing work
        if (isMounted && stillHasWork) {
          timer = setTimeout(pollStats, 6000);
        }
      } catch (err) {
        // Stop on error to avoid spamming the network
      }
    };

    timer = setTimeout(pollStats, 5000);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [companion.id, companion.documents, companion.sources]);

  // Calculate knowledge source statistics fed into this companion
  const docs = documents;
  const completedDocs = docs.filter((d) => d.processingStatus === "COMPLETED");
  const processingDoc = docs.find((d) => d.processingStatus === "PROCESSING");

  const youtubeDocs = docs.filter(
    (d) =>
      d.sourceType === "YOUTUBE_VIDEO" ||
      d.sourceType === "YOUTUBE_CHANNEL" ||
      d.sourceType === "YOUTUBE_PLAYLIST"
  );
  const completedYoutubeDocs = youtubeDocs.filter((d) => d.processingStatus === "COMPLETED");
  const youtubeVideoCount = completedYoutubeDocs.length;
  const youtubeChunkCount = youtubeDocs.reduce(
    (acc, d) => acc + (d.chunkCount || 0),
    0
  );

  const websiteDocs = docs.filter((d) => d.sourceType === "WEBSITE");
  const websiteCount = websiteDocs.filter((d) => d.processingStatus === "COMPLETED").length;

  const fileDocs = docs.filter((d) => d.sourceType === "FILE_UPLOAD" || d.sourceType === "TEXT_PASTE");
  const fileCount = fileDocs.filter((d) => d.processingStatus === "COMPLETED").length;

  const totalChunks = docs.reduce((acc, d) => acc + (d.chunkCount || 0), 0);
  const isIngesting =
    sources.some((s) => s.status === "INGESTING" || s.status === "DISCOVERING") ||
    docs.some((d) => d.processingStatus === "PROCESSING" || d.processingStatus === "PENDING");

  const onDelete = async () => {
    try {
      await axios.delete(`/api/companion/${companion.id}`);
      toast({
        description: "Success.",
      });
      router.push("/");
      router.refresh();
    } catch (error) {
      errorResponse(error);
    }
  };

  return (
    <div className="w-full flex justify-between items-center border-b border-primary/10 p-4">
      <div className="flex gap-x-2 items-center">
        <Button size="icon" variant="ghost" onClick={() => router.push("/")} title="Back to home">
          <ChevronLeft className="h-8 w-8" />
        </Button>
        <div
          onClick={() => router.push(`/companion/${companion.id}`)}
          className="flex items-center gap-x-3 cursor-pointer hover:opacity-80 transition group p-1.5 -m-1.5 rounded-lg"
          title="Click to view/edit companion and manage social/knowledge sources"
        >
          <BotAvatar src={companion.img} alt={companion.name ?? ""} />
          <div className="flex flex-col gap-y-1">
            <div className="flex items-center gap-x-2">
              <p className="font-bold group-hover:underline transition">{companion.name}</p>
              <div className="flex items-center text-xs text-muted-foreground">
                <MessageSquare className="w-3 h-3 mr-1" />
                {messagesCount}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              created by <span className="text-[13px] font-semibold">{companion.userName}</span>
            </p>
            {/* Mobile Knowledge Stats Badge */}
            {youtubeVideoCount > 0 ? (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground md:hidden mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isIngesting ? "bg-amber-500 animate-pulse" : "bg-emerald-500"} shrink-0`}></span>
                <Youtube className="w-3 h-3 text-red-500 shrink-0" />
                <span className="font-medium text-foreground">{youtubeVideoCount} {youtubeVideoCount === 1 ? "video" : "videos"}</span>
                <span className="opacity-40">•</span>
                <FileText className="w-3 h-3 text-primary/70 shrink-0" />
                <span>{youtubeChunkCount.toLocaleString()} transcripts</span>
                {isIngesting && (
                  <span className="text-amber-500 text-[10px] animate-pulse font-medium">(ingesting)</span>
                )}
              </div>
            ) : totalChunks > 0 ? (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground md:hidden mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isIngesting ? "bg-amber-500 animate-pulse" : "bg-emerald-500"} shrink-0`}></span>
                <FileText className="w-3 h-3 text-primary/70 shrink-0" />
                <span>{totalChunks.toLocaleString()} transcripts fed</span>
                {isIngesting && (
                  <span className="text-amber-500 text-[10px] animate-pulse font-medium">(ingesting)</span>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Desktop / Tablet Knowledge Fed Summary Pill */}
      <div className="hidden md:flex items-center">
        {totalChunks > 0 || youtubeVideoCount > 0 ? (
          <div
            onClick={() => router.push(`/companion/${companion.id}`)}
            className="cursor-pointer group flex items-center gap-2.5 bg-secondary/80 hover:bg-secondary/95 border border-primary/15 hover:border-primary/30 rounded-full px-4 py-1.5 text-xs transition-all shadow-sm"
            title="Click to view and connect companion's sources & social media"
          >
            {/* Live Indicator */}
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isIngesting ? "bg-amber-400" : "bg-emerald-400"} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isIngesting ? "bg-amber-500" : "bg-emerald-500"}`}></span>
            </span>

            {/* YouTube Videos count */}
            {youtubeVideoCount > 0 && (
              <div className="flex items-center gap-1.5 text-red-500 font-medium">
                <Youtube className="w-3.5 h-3.5 shrink-0 fill-red-500/20" />
                <span className="font-semibold text-foreground">{youtubeVideoCount}</span>
                <span className="text-muted-foreground font-normal">
                  {youtubeVideoCount === 1 ? "Video" : "Videos"}
                </span>
              </div>
            )}

            {/* Transcripts Chunks count */}
            {youtubeChunkCount > 0 && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="w-3.5 h-3.5 shrink-0 text-primary/70" />
                  <span className="font-semibold text-foreground">{youtubeChunkCount.toLocaleString()}</span>
                  <span className="font-normal">Transcripts fed</span>
                </div>
              </>
            )}

            {/* Web & Docs counts if any */}
            {websiteCount > 0 && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <div className="flex items-center gap-1 text-blue-400">
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">{websiteCount}</span>
                  <span className="font-normal">Web</span>
                </div>
              </>
            )}

            {fileCount > 0 && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <div className="flex items-center gap-1 text-amber-400">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">{fileCount}</span>
                  <span className="font-normal">Docs</span>
                </div>
              </>
            )}

            {isIngesting && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <div className="flex items-center gap-1.5 text-amber-500 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="max-w-[220px] truncate">
                    {processingDoc
                      ? `Ingesting: ${processingDoc.title}${processingDoc.chunkCount > 0 ? ` (${processingDoc.chunkCount} chunks)` : ""}`
                      : "Ingesting..."}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div
            onClick={() => router.push(`/companion/${companion.id}`)}
            className="cursor-pointer flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-secondary/50 rounded-full px-3.5 py-1.5 transition border border-dashed border-primary/20 hover:border-primary/40"
            title="Click to connect YouTube, websites, or files to this companion"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>+ Connect Knowledge Sources</span>
          </div>
        )}
      </div>
      {user?.id === companion.userId && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size={"icon"} variant="ghost">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push(`/companion/${companion.id}`)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => onDelete()}
            >
              <Trash className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default ChatHeader;
