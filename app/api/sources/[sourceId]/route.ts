import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { getQueueService } from "@/lib/services/queue-service";
import { IngestionService } from "@/lib/services/ingestion-service";
import { SourceStatus } from "@prisma/client";
import {
  sourceCache,
  CACHE_TTL_MS,
  invalidateSourceCache,
} from "@/lib/sources/source-cache";

/**
 * GET /api/sources/[sourceId]
 * Get source details with documents
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sourceId } = await params;

    // Check fast cache first
    const cached = sourceCache.get(sourceId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const source = await prismadb.source.findUnique({
      where: { id: sourceId },
      include: {
        documents: {
          select: {
            id: true,
            externalId: true,
            title: true,
            sourceUrl: true,
            sourceType: true,
            author: true,
            publishedAt: true,
            processingStatus: true,
            chunkCount: true,
            errorMessage: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Verify ownership
    if (source.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Auto-heal: Check if ingestion was interrupted / abandoned (no activity for > 60 seconds)
    const isStaleIngestion =
      (source.status === SourceStatus.INGESTING || source.status === SourceStatus.DISCOVERING) &&
      Date.now() - new Date(source.updatedAt).getTime() > 60000;

    if (isStaleIngestion) {
      console.log(
        `🧹 [AUTO-RECOVERY] Source ${sourceId} was interrupted (server restart or connection drop). Auto-pausing source.`
      );
      const updatedConfig = { ...((source.configuration as any) || {}) };
      delete updatedConfig.liveActivity;

      await prismadb.source.update({
        where: { id: sourceId },
        data: {
          status: SourceStatus.PAUSED,
          configuration: updatedConfig,
        },
      });

      await prismadb.sourceDocument.updateMany({
        where: {
          sourceId,
          processingStatus: "PROCESSING",
        },
        data: {
          processingStatus: "PENDING",
        },
      });

      source.status = SourceStatus.PAUSED;
      source.configuration = updatedConfig;
    }

    // Format documents with lightweight metadata (no heavy transcript blobs in list)
    const formattedDocuments = source.documents.map((doc) => {
      const meta = (doc.metadata as any) || {};
      const isYoutube = doc.sourceType.startsWith("YOUTUBE");
      const thumbnail =
        meta.thumbnail ||
        (isYoutube && doc.externalId
          ? `https://img.youtube.com/vi/${doc.externalId}/hqdefault.jpg`
          : null);

      return {
        id: doc.id,
        externalId: doc.externalId,
        title: doc.title,
        sourceUrl: doc.sourceUrl,
        sourceType: doc.sourceType,
        author: doc.author,
        publishedAt: doc.publishedAt,
        processingStatus: doc.processingStatus,
        chunkCount: doc.chunkCount,
        errorMessage: doc.errorMessage,
        thumbnail,
        duration: meta.duration || null,
        hasTranscript: meta.hasTranscript || false,
        originalLanguage: meta.originalLanguage || "en",
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        processingDurationMs: meta.processingDurationMs || null,
        processedAt: meta.processedAt || doc.createdAt,
        liveStep: meta.liveStep || null,
      };
    });

    const responseData = {
      ...source,
      documents: formattedDocuments,
    };

    // Store in fast cache
    sourceCache.set(sourceId, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[SOURCE_GET]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/sources/[sourceId]
 * Update source configuration or trigger re-sync
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sourceId } = await params;
    const body = await req.json();
    const { action, configuration } = body;

    const source = await prismadb.source.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Verify ownership
    if (source.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Invalidate fast cache on updates
    invalidateSourceCache(sourceId);

    // Handle different actions
    if (action === "sync" || action === "resume") {
      const currentConfig = (source.configuration as any) || {};
      const newConfig = {
        ...currentConfig,
        batchSize: body.batchSize !== undefined ? body.batchSize : currentConfig.batchSize,
        lastSyncRequestedAt: new Date().toISOString(),
      };

      // Re-sync / Resume the source
      await prismadb.source.update({
        where: { id: sourceId },
        data: {
          status: SourceStatus.PENDING,
          configuration: newConfig,
        },
      });

      const queueService = getQueueService();
      await queueService.enqueueIngestion(sourceId);

      return NextResponse.json({
        message: action === "resume" ? "Resuming ingestion" : "Sync started",
        batchSize: newConfig.batchSize,
      });
    } else if (action === "pause") {
      // Pause ingestion
      await prismadb.source.update({
        where: { id: sourceId },
        data: { status: SourceStatus.PAUSED },
      });

      return NextResponse.json({ message: "Source paused" });
    } else if (action === "retry") {
      // Retry failed documents
      const ingestionService = new IngestionService();
      
      // Run in background
      ingestionService.retryFailedDocuments(sourceId).catch((error) => {
        console.error("Retry failed:", error);
      });

      return NextResponse.json({ message: "Retry started" });
    } else if (action === "retry_document") {
      const { documentId } = body;
      if (!documentId) {
        return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
      }

      const ingestionService = new IngestionService();
      ingestionService.retryDocument(documentId).catch((error) => {
        console.error("Single document retry failed:", error);
      });

      return NextResponse.json({ message: "Retrying document", documentId });
    } else if (configuration) {
      // Update configuration
      const updated = await prismadb.source.update({
        where: { id: sourceId },
        data: { configuration },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "Invalid action or missing configuration" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[SOURCE_PATCH]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * DELETE /api/sources/[sourceId]
 * Delete source and all its data
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sourceId } = await params;

    const source = await prismadb.source.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Verify ownership
    if (source.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete source (this will also delete vectors from Pinecone via service)
    invalidateSourceCache(sourceId);
    const ingestionService = new IngestionService();
    await ingestionService.deleteSource(sourceId);

    return NextResponse.json({ message: "Source deleted" });
  } catch (error) {
    console.error("[SOURCE_DELETE]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
