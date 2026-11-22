import prismadb from "@/lib/prismadb";
import { SourceAdapterFactory } from "../sources/adapter-factory";
import { ChunkingService } from "./chunking-service";
import { EmbeddingService } from "./embedding-service";
import { SourceStatus, ProcessingStatus } from "@prisma/client";
import { NormalizedDocument } from "../sources/types";
import { getLogTimestamp, formatDurationMs } from "../utils";
import "@/lib/sources/register-adapters";

/**
 * Safe database wrapper that retries on transient connection drops (e.g. Neon serverless wake-up / network hiccups)
 */
async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T | null> {
  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      const isTransient =
        err?.code === "P1001" ||
        err?.code === "P1008" ||
        err?.code === "P1017" ||
        err?.message?.includes("Can't reach database server") ||
        err?.message?.includes("ECONNRESET") ||
        err?.message?.includes("connection timeout");

      if (isTransient && attempt < maxRetries) {
        console.warn(
          `   ⚠️ [DATABASE] Transient connection drop (${err?.code || "network"}). Reconnecting in ${delay / 1000}s (attempt ${attempt}/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
      } else if (attempt === maxRetries) {
        console.error(
          `   ❌ [DATABASE] Database operation failed after ${maxRetries} attempts:`,
          err?.message
        );
        return null;
      } else {
        throw err;
      }
    }
  }
  return null;
}

/**
 * Ingestion service
 * Orchestrates the complete ingestion pipeline with live timestamps and resume capability
 */
export class IngestionService {
  private chunkingService: ChunkingService;
  private embeddingService: EmbeddingService;

  constructor() {
    this.chunkingService = new ChunkingService();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Process a complete source ingestion job
   */
  async processSource(sourceId: string): Promise<void> {
    const source = await prismadb.source.findUnique({
      where: { id: sourceId },
      include: { companion: true },
    });

    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    const sourceStartTime = Date.now();
    console.log(`\n${getLogTimestamp()} 📥 Starting ingestion for source: "${source.title}"`);

    try {
      // Update status to DISCOVERING and start clean execution log session
      await prismadb.source.update({
        where: { id: sourceId },
        data: {
          status: SourceStatus.DISCOVERING,
          configuration: {
            ...((source.configuration as any) || {}),
            executionLogs: [
              {
                id: `${Date.now()}-init`,
                timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
                stage: "PIPELINE",
                message: `Starting ingestion pipeline for "${source.title}"...`,
                level: "info",
              },
            ],
            ingestionStartedAt: new Date().toISOString(),
          },
        },
      });

      // Get appropriate adapter
      const adapter = SourceAdapterFactory.getAdapter(source.type);

      // Discover items
      const config = (source.configuration as any) || {};
      const discoveredItems = await adapter.discover(
        sourceId,
        source.originalUrl || "",
        config
      );

      console.log(`${getLogTimestamp()} ✅ Discovered ${discoveredItems.length} total items from source`);

      // Query already completed/skipped documents in database for seamless resuming
      const existingDocs = await prismadb.sourceDocument.findMany({
        where: { sourceId },
        select: { externalId: true, processingStatus: true },
      });

      const completedIds = new Set(
        existingDocs
          .filter(
            (d) =>
              d.processingStatus === ProcessingStatus.COMPLETED ||
              d.processingStatus === ProcessingStatus.SKIPPED
          )
          .map((d) => d.externalId)
      );

      const existingCount = completedIds.size;

      // Update source with discovered count
      await prismadb.source.update({
        where: { id: sourceId },
        data: {
          status: SourceStatus.INGESTING,
          totalItems: discoveredItems.length,
          processedItems: existingCount,
        },
      });

      // Determine batch size if configured (or process all remaining)
      const configuredBatchSize =
        typeof config.batchSize === "number" ? config.batchSize : undefined;

      let newlyProcessed = 0;
      let totalProcessed = existingCount;
      let failedCount = 0;

      for (let i = 0; i < discoveredItems.length; i++) {
        const item = discoveredItems[i];

        // Check if user paused ingestion
        const currentSource = await prismadb.source.findUnique({
          where: { id: sourceId },
          select: { status: true },
        });

        if (currentSource?.status === SourceStatus.PAUSED) {
          console.log(
            `${getLogTimestamp()} ⏸️ [INGESTION] Source ingestion paused by user. Halting processing loop.`
          );
          break;
        }

        // Skip items already processed
        if (completedIds.has(item.externalId)) {
          continue;
        }

        // Check if we reached user's batch limit
        if (configuredBatchSize && newlyProcessed >= configuredBatchSize) {
          console.log(
            `${getLogTimestamp()} ⏸️ [INGESTION] Batch limit of ${configuredBatchSize} videos reached. Pausing checkpoint.`
          );
          break;
        }

        const itemStartTime = Date.now();
        console.log(
          `\n${getLogTimestamp()} 🎬 [${totalProcessed + 1}/${discoveredItems.length}] Starting video: "${item.title}"`
        );

        try {
          await this.processItem(sourceId, source.companionId, item, adapter);
          newlyProcessed++;
          totalProcessed++;

          const itemDuration = ((Date.now() - itemStartTime) / 1000).toFixed(1);
          console.log(
            `${getLogTimestamp()} ✓ [INGESTION] Processed ${totalProcessed}/${discoveredItems.length}: "${item.title}" (${itemDuration}s)`
          );

          // Update progress live in database with duration metadata
          await withDbRetry(() =>
            prismadb.source.update({
              where: { id: sourceId },
              data: {
                processedItems: totalProcessed,
                lastSyncedAt: new Date(),
                configuration: {
                  ...config,
                  lastProcessingDurationMs: Date.now() - sourceStartTime,
                  currentProcessingTitle: item.title,
                  lastProcessedAt: new Date().toISOString(),
                },
              },
            })
          );
        } catch (error: any) {
          if (error?.message === "PAUSED_BY_USER") {
            console.log(
              `${getLogTimestamp()} ⏸️ [INGESTION] Source ingestion paused by user. Clean exit from loop.`
            );
            break;
          }

          failedCount++;
          const errorMsg = error?.message || String(error);
          console.error(
            `${getLogTimestamp()} ✗ Failed to process "${item.title}":`,
            errorMsg
          );

          // Safely update failed count in database with retry
          await withDbRetry(() =>
            prismadb.source.update({
              where: { id: sourceId },
              data: { failedItems: failedCount },
            })
          );

          // Check if error is truly hard daily quota exhaustion
          const isDailyQuotaExhausted =
            errorMsg.includes("limit: 1000") ||
            errorMsg.includes("PerDay") ||
            errorMsg.includes("embed_content_free_tier_requests");

          if (isDailyQuotaExhausted) {
            console.warn(
              `\n${getLogTimestamp()} 🛑 [INGESTION] Daily Gemini API quota reached (1,000 requests/day). Pausing source ingestion to protect remaining videos.`
            );
            await withDbRetry(() =>
              prismadb.source.update({
                where: { id: sourceId },
                data: {
                  status: SourceStatus.PAUSED,
                  failedItems: failedCount,
                  configuration: {
                    ...config,
                    lastProcessingDurationMs: Date.now() - sourceStartTime,
                    quotaExceededAt: new Date().toISOString(),
                    liveActivity: null,
                    pauseReason:
                      "Daily Gemini embedding quota reached (1,000 requests/day on Free Tier). Remaining videos are safely preserved and can be resumed anytime.",
                  },
                },
              })
            );
            break; // Stop immediately ONLY on true daily quota exhaustion!
          }

          // For any single-video failure (network blip, transcript missing, etc.):
          // Safely mark as FAILED, log, and KEEP RUNNING FOR THE REST OF THE QUEUE!
          console.log(
            `${getLogTimestamp()} ⚠️ [INGESTION] Video "${item.title}" failed. Recorded error state. Continuing to next video in queue...`
          );
          continue;
        }
      }

      // Mark source status accurately: READY only if all items are processed, otherwise PARTIAL
      const sourceDurationMs = Date.now() - sourceStartTime;
      const finalStatus =
        totalProcessed >= discoveredItems.length
          ? SourceStatus.READY
          : SourceStatus.PARTIAL;

      await withDbRetry(() =>
        prismadb.source.update({
          where: { id: sourceId },
          data: {
            status: finalStatus,
            processedItems: totalProcessed,
            lastSyncedAt: new Date(),
            configuration: {
              ...config,
              lastProcessingDurationMs: sourceDurationMs,
              completedAt: new Date().toISOString(),
              currentProcessingTitle: null,
              liveActivity: null,
            },
          },
        })
      );

      console.log(
        `\n${getLogTimestamp()} ✅ Ingestion session completed in ${formatDurationMs(
          sourceDurationMs
        )}: ${newlyProcessed} new videos processed, ${totalProcessed}/${discoveredItems.length} total, ${failedCount} failed (${finalStatus})\n`
      );
    } catch (error) {
      console.error(
        `\n${getLogTimestamp()} ❌ Ingestion failed for source ${sourceId}:`,
        error
      );

      await withDbRetry(() =>
        prismadb.source.update({
          where: { id: sourceId },
          data: {
            status: SourceStatus.FAILED,
          },
        })
      );

      throw error;
    }
  }

  /**
   * Process a single discovered item
   */
  private async processItem(
    sourceId: string,
    companionId: string,
    item: any,
    adapter: any
  ): Promise<void> {
    const itemStartTime = Date.now();

    // Check if document already exists
    const existingDoc = await prismadb.sourceDocument.findUnique({
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: item.externalId,
        },
      },
    });

    let activeDocId: string | null = existingDoc?.id || null;

    // Helper to update live progress in source.configuration and document metadata
    const updateLiveStatus = async (
      step: string,
      stage: string = "PIPELINE",
      level: "info" | "success" | "warn" | "error" = "info"
    ) => {
      try {
        const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
        const currentSource = await prismadb.source.findUnique({
          where: { id: sourceId },
          select: { configuration: true },
        });
        const config = (currentSource?.configuration as any) || {};
        const existingLogs = Array.isArray(config.executionLogs) ? config.executionLogs : [];
        const newLog = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp,
          stage,
          message: step,
          level,
        };
        const executionLogs = [...existingLogs, newLog].slice(-50);

        await prismadb.source.update({
          where: { id: sourceId },
          data: {
            configuration: {
              ...config,
              executionLogs,
              liveActivity: {
                activeVideo: item.title,
                step,
                updatedAt: new Date().toISOString(),
              },
            },
          },
        });

        // Also update liveStep in document metadata so the individual card reflects it
        if (activeDocId) {
          const doc = await prismadb.sourceDocument.findUnique({
            where: { id: activeDocId },
            select: { metadata: true },
          });
          const meta = (doc?.metadata as any) || {};
          await prismadb.sourceDocument.update({
            where: { id: activeDocId },
            data: {
              metadata: {
                ...meta,
                liveStep: step,
              },
            },
          });
        }
      } catch (e) {
        // Non-critical
      }
    };

    await updateLiveStatus(`Starting ingestion for "${item.title}"`, "YOUTUBE");

    if (
      existingDoc &&
      (existingDoc.processingStatus === ProcessingStatus.COMPLETED ||
        existingDoc.processingStatus === ProcessingStatus.SKIPPED)
    ) {
      console.log(`  ↻ Document already processed: "${item.title}"`);
      return;
    }

    // Fetch full content from source adapter
    let document: NormalizedDocument;
    try {
      document = await adapter.fetch(item, sourceId, updateLiveStatus);
    } catch (fetchErr: any) {
      console.warn(
        `  ${getLogTimestamp()} ⚠️ [INGESTION] Skipping video "${item.title}": ${
          fetchErr?.message || fetchErr
        }`
      );

      await prismadb.sourceDocument.upsert({
        where: {
          sourceId_externalId: {
            sourceId,
            externalId: item.externalId,
          },
        },
        create: {
          sourceId,
          companionId,
          externalId: item.externalId,
          title: item.title || "Untitled",
          content: "",
          sourceUrl: item.url || `https://www.youtube.com/watch?v=${item.externalId}`,
          sourceType: adapter.getSourceType(),
          processingStatus: ProcessingStatus.SKIPPED,
          errorMessage: fetchErr?.message || "No transcript available",
          contentHash: `skipped-${item.externalId}`,
          chunkCount: 0,
        },
        update: {
          processingStatus: ProcessingStatus.SKIPPED,
          errorMessage: fetchErr?.message || "No transcript available",
        },
      });
      return;
    }

    // Create or update document record
    const sourceDocument = await prismadb.sourceDocument.upsert({
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: document.externalId,
        },
      },
      create: {
        sourceId,
        companionId,
        externalId: document.externalId,
        title: document.title,
        content: document.content,
        sourceUrl: document.sourceUrl,
        sourceType: document.sourceType,
        author: document.author,
        publishedAt: document.publishedAt,
        metadata: document.metadata as any,
        contentHash: document.contentHash,
        processingStatus: ProcessingStatus.PROCESSING,
      },
      update: {
        title: document.title,
        content: document.content,
        contentHash: document.contentHash,
        processingStatus: ProcessingStatus.PROCESSING,
      },
    });

    activeDocId = sourceDocument.id;

    try {
      await updateLiveStatus("Splitting transcript into semantic RAG chunks with timestamp boundaries...", "CHUNKING");
      // Chunk document with timestamp boundaries
      const chunks = await this.chunkingService.chunkDocument(
        document.content,
        document.sourceType,
        {
          companionId,
          sourceId,
          documentId: sourceDocument.id,
          sourceType: document.sourceType,
          title: document.title,
          sourceUrl: document.sourceUrl,
          author: document.author,
          publishedAt: document.publishedAt,
          chunkIndex: 0,
          transcriptSegments: document.metadata?.transcriptSegments as any,
        }
      );

      // Filter valid chunks
      const validChunks = chunks.filter((chunk) =>
        this.chunkingService.isValidChunk(chunk)
      );

      if (validChunks.length === 0) {
        throw new Error("No valid chunks created from content");
      }

      const formatSecs = (sec?: number) => {
        if (sec === undefined || sec === null) return "";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
      };

      const chunksCache = validChunks.map((c, idx) => {
        const start = c.metadata.startSeconds;
        const end = c.metadata.endSeconds;
        return {
          index: c.metadata.chunkIndex ?? idx,
          content: c.content,
          charCount: c.content.length,
          wordCount: c.content.trim().split(/\s+/).length,
          startSeconds: start,
          endSeconds: end,
          timeRange:
            start !== undefined && end !== undefined
              ? `${formatSecs(start)} - ${formatSecs(end)}`
              : null,
        };
      });

      // Save chunksCache and chunkCount immediately so UI can inspect chunks & timestamps (< 5ms)
      await prismadb.sourceDocument.update({
        where: { id: sourceDocument.id },
        data: {
          processingStatus: ProcessingStatus.PROCESSING,
          chunkCount: validChunks.length,
          metadata: {
            ...((document.metadata as any) || {}),
            chunksCache,
          },
        },
      });

      await updateLiveStatus(`Generated ${validChunks.length} chunks. Embedding with gemini-embedding-2 (3072 dims)...`, "EMBEDDING");

      // Embed and store with live real-time progress updates to database
      await this.embeddingService.embedAndStore(
        validChunks,
        companionId,
        sourceId,
        sourceDocument.id,
        async (embeddedCount) => {
          await prismadb.sourceDocument.update({
            where: { id: sourceDocument.id },
            data: {
              chunkCount: embeddedCount,
            },
          });
          await updateLiveStatus(`Embedding chunks to Pinecone (${embeddedCount}/${validChunks.length})...`, "EMBEDDING");
        },
        async () => {
          const src = await prismadb.source.findUnique({
            where: { id: sourceId },
            select: { status: true },
          });
          return src?.status === SourceStatus.PAUSED;
        }
      );

      await updateLiveStatus(`Upserted ${validChunks.length} vectors into Pinecone index`, "PINECONE", "success");

      const itemDurationMs = Date.now() - itemStartTime;

      // Update document status with timestamp, duration and cached chunks for instant UI viewing
      await withDbRetry(() =>
        prismadb.sourceDocument.update({
          where: { id: sourceDocument.id },
          data: {
            processingStatus: ProcessingStatus.COMPLETED,
            chunkCount: validChunks.length,
            metadata: {
              ...((document.metadata as any) || {}),
              processingDurationMs: itemDurationMs,
              processedAt: new Date().toISOString(),
              chunksCache,
              liveStep: null,
            },
          },
        })
      );

      await updateLiveStatus(`✅ Successfully processed "${item.title}" (${validChunks.length} chunks indexed)`, "SUCCESS", "success");
    } catch (error) {
      if ((error as Error)?.message === "PAUSED_BY_USER") {
        console.log(`⏸️ [INGESTION] Processing of "${item.title}" paused by user.`);
        await prismadb.sourceDocument.update({
          where: { id: sourceDocument.id },
          data: {
            processingStatus: ProcessingStatus.PENDING,
          },
        });
        throw error;
      }

      let cleanErrorMessage = (error as Error).message || "Unknown error";
      const isDailyLimit =
        cleanErrorMessage.includes("limit: 1000") ||
        cleanErrorMessage.includes("PerDay") ||
        cleanErrorMessage.includes("embed_content_free_tier_requests");

      if (isDailyLimit) {
        cleanErrorMessage =
          "Gemini embedding quota reached for today (1,000 requests/day limit on Free Tier). Ready to resume once quota resets.";
      }

      await updateLiveStatus(`Processing failed for "${item.title}": ${cleanErrorMessage}`, "ERROR", "error");

      // Update document with error safely with retries
      await withDbRetry(() =>
        prismadb.sourceDocument.update({
          where: { id: sourceDocument.id },
          data: {
            processingStatus: ProcessingStatus.FAILED,
            errorMessage: cleanErrorMessage,
          },
        })
      );

      throw error;
    }
  }

  /**
   * Retry failed documents for a source
   */
  async retryFailedDocuments(sourceId: string): Promise<void> {
    const source = await prismadb.source.findUnique({
      where: { id: sourceId },
      include: {
        documents: {
          where: {
            processingStatus: ProcessingStatus.FAILED,
          },
        },
      },
    });

    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    console.log(
      `\n${getLogTimestamp()} 🔄 Retrying ${source.documents.length} failed documents`
    );

    const adapter = SourceAdapterFactory.getAdapter(source.type);

    for (const doc of source.documents) {
      try {
        const item = {
          externalId: doc.externalId,
          title: doc.title,
          url: doc.sourceUrl,
          metadata: doc.metadata as any,
        };

        await this.processItem(sourceId, source.companionId, item, adapter);
        console.log(`${getLogTimestamp()} ✓ Retry successful: "${doc.title}"`);
      } catch (error) {
        const errMessage = (error as Error).message || String(error);
        const isQuotaExceeded =
          errMessage.includes("429") ||
          errMessage.includes("quota") ||
          errMessage.includes("RESOURCE_EXHAUSTED");

        if (isQuotaExceeded) {
          console.warn(
            `\n${getLogTimestamp()} ⚠️ [INGESTION] Daily quota for Gemini embeddings reached. Pausing retry to protect quota.`
          );
          await prismadb.source.update({
            where: { id: sourceId },
            data: { status: SourceStatus.PAUSED },
          });
          break; // Stop retrying remaining failed documents immediately!
        }

        console.error(
          `${getLogTimestamp()} ✗ Retry failed: "${doc.title}"`,
          error
        );
      }
    }

    // Refresh counters after retry batch completes
    try {
      const [failedCount, processedCount] = await Promise.all([
        prismadb.sourceDocument.count({
          where: { sourceId, processingStatus: ProcessingStatus.FAILED },
        }),
        prismadb.sourceDocument.count({
          where: { sourceId, processingStatus: ProcessingStatus.COMPLETED },
        }),
      ]);

      const currentSource = await prismadb.source.findUnique({
        where: { id: sourceId },
        select: { configuration: true },
      });
      const currentConfig = (currentSource?.configuration as any) || {};
      const { liveActivity, ...cleanedConfig } = currentConfig;

      await prismadb.source.update({
        where: { id: sourceId },
        data: {
          failedItems: failedCount,
          processedItems: processedCount,
          configuration: cleanedConfig,
        },
      });
    } catch (e) {
      // non-critical
    }
  }

  /**
   * Retry a single document specifically
   */
  async retryDocument(documentId: string): Promise<void> {
    const doc = await prismadb.sourceDocument.findUnique({
      where: { id: documentId },
      include: {
        source: true,
      },
    });

    if (!doc || !doc.source) {
      throw new Error(`Document ${documentId} not found`);
    }

    console.log(
      `\n${getLogTimestamp()} 🔄 [SINGLE RETRY] Retrying document: "${doc.title}"`
    );

    // Reset status to PROCESSING with initial liveStep
    const initialMeta = (doc.metadata as any) || {};
    await prismadb.sourceDocument.update({
      where: { id: documentId },
      data: {
        processingStatus: ProcessingStatus.PROCESSING,
        errorMessage: null,
        metadata: {
          ...initialMeta,
          liveStep: "Queued for retry... Starting ingestion pipeline",
        },
      },
    });

    const adapter = SourceAdapterFactory.getAdapter(doc.source.type);
    const item = {
      externalId: doc.externalId,
      title: doc.title,
      url: doc.sourceUrl,
      metadata: doc.metadata as any,
    };

    try {
      await this.processItem(doc.sourceId, doc.companionId, item, adapter);
      console.log(`${getLogTimestamp()} ✓ Single retry successful: "${doc.title}"`);

      // Update source counters and clear liveActivity
      const [failedCount, processedCount] = await Promise.all([
        prismadb.sourceDocument.count({
          where: { sourceId: doc.sourceId, processingStatus: ProcessingStatus.FAILED },
        }),
        prismadb.sourceDocument.count({
          where: { sourceId: doc.sourceId, processingStatus: ProcessingStatus.COMPLETED },
        }),
      ]);

      const currentSource = await prismadb.source.findUnique({
        where: { id: doc.sourceId },
        select: { configuration: true },
      });
      const currentConfig = (currentSource?.configuration as any) || {};
      const { liveActivity, ...cleanedConfig } = currentConfig;

      await prismadb.source.update({
        where: { id: doc.sourceId },
        data: {
          failedItems: failedCount,
          processedItems: processedCount,
          configuration: cleanedConfig,
        },
      });
    } catch (error) {
      console.error(
        `${getLogTimestamp()} ✗ Single retry failed: "${doc.title}"`,
        error
      );

      // Clear liveActivity on error
      try {
        const currentSource = await prismadb.source.findUnique({
          where: { id: doc.sourceId },
          select: { configuration: true },
        });
        const currentConfig = (currentSource?.configuration as any) || {};
        const { liveActivity, ...cleanedConfig } = currentConfig;
        await prismadb.source.update({
          where: { id: doc.sourceId },
          data: { configuration: cleanedConfig },
        });
      } catch (e) {
        // non-critical
      }

      throw error;
    }
  }

  /**
   * Delete all data for a source
   */
  async deleteSource(sourceId: string): Promise<void> {
    const source = await prismadb.source.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    console.log(
      `${getLogTimestamp()} 🗑️ Deleting source ${sourceId} and all vectors...`
    );

    // Delete vectors from Pinecone
    try {
      await this.embeddingService.deleteSource(source.companionId, sourceId);
    } catch (err) {
      console.warn("Could not delete vectors from Pinecone:", err);
    }

    // Delete from Postgres (cascades to documents and jobs)
    await prismadb.source.delete({
      where: { id: sourceId },
    });

    console.log(`${getLogTimestamp()} ✅ Source ${sourceId} deleted successfully`);
  }
}
