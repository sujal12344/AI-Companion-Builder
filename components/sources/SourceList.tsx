"use client";

import { useEffect, useState, useCallback } from "react";
import { SourceCard } from "./SourceCard";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import axios from "axios";
import { SourceStatus, SourceType } from "@prisma/client";

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
}

interface SourceListProps {
  companionId: string;
  initialSources?: Source[];
  onAddSource?: () => void;
}

export function SourceList({
  companionId,
  initialSources = [],
  onAddSource,
}: SourceListProps) {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [isLoading, setIsLoading] = useState(initialSources.length === 0);

  const fetchSources = useCallback(async () => {
    try {
      const response = await axios.get(`/api/sources?companionId=${companionId}`);
      setSources(response.data);
    } catch (error) {
      console.error("Failed to fetch sources:", error);
    } finally {
      setIsLoading(false);
    }
  }, [companionId]);

  useEffect(() => {
    // If we didn't have initial sources, fetch them immediately
    if (initialSources.length === 0) {
      fetchSources();
    }
  }, [fetchSources, initialSources.length]);

  // Poll for updates only while actively discovering or ingesting
  const activeStatusesKey = sources.map((s) => s.status).join(",");

  useEffect(() => {
    const hasActiveIngestion =
      activeStatusesKey.includes("DISCOVERING") ||
      activeStatusesKey.includes("INGESTING");

    if (!hasActiveIngestion) {
      return;
    }

    const interval = setInterval(() => {
      fetchSources();
    }, 6000);

    return () => clearInterval(interval);
  }, [activeStatusesKey, fetchSources]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Knowledge Sources</h2>
          <p className="text-muted-foreground">
            Manage the sources that power your companion's knowledge
          </p>
        </div>
        {onAddSource && (
          <Button type="button" onClick={onAddSource}>
            <Plus className="w-4 h-4 mr-2" />
            Add Source
          </Button>
        )}
      </div>

      {sources.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            No sources added yet. Add your first source to get started.
          </p>
          {onAddSource && (
            <Button onClick={onAddSource}>
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {sources.map((source) => (
            <SourceCard key={source.id} source={source} onUpdate={fetchSources} />
          ))}
        </div>
      )}
    </div>
  );
}
