import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { ChunkingService } from "@/lib/services/chunking-service";
import { EmbeddingService } from "@/lib/services/embedding-service";
import { invalidateSourceCache } from "@/lib/sources/source-cache";

function formatSeconds(sec?: number): string {
  if (sec === undefined || sec === null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;

    const document = await prismadb.sourceDocument.findUnique({
      where: { id: documentId },
      include: {
        companion: {
          select: {
            userId: true,
            name: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.companion.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const meta = (document.metadata as any) || {};
    const isYoutube = document.sourceType.startsWith("YOUTUBE");
    const thumbnail =
      meta.thumbnail ||
      (isYoutube && document.externalId
        ? `https://img.youtube.com/vi/${document.externalId}/hqdefault.jpg`
        : null);

    const docHeader = {
      id: document.id,
      title: document.title,
      sourceUrl: document.sourceUrl,
      sourceType: document.sourceType,
      author: document.author,
      externalId: document.externalId,
      thumbnail,
      duration: meta.duration || null,
      chunkCount: document.chunkCount,
      publishedAt: document.publishedAt,
      processedAt: meta.processedAt || document.createdAt,
      processingDurationMs: meta.processingDurationMs || null,
    };

    // If chunks are already cached in metadata, return instantly (< 5ms)
    if (meta.chunksCache && Array.isArray(meta.chunksCache) && meta.chunksCache.length > 0) {
      return NextResponse.json({
        document: {
          ...docHeader,
          chunkCount: meta.chunksCache.length,
        },
        chunks: meta.chunksCache,
      });
    }

    // Otherwise, generate chunks and save to metadata cache for all subsequent requests
    const chunkingService = new ChunkingService();
    const rawChunks = await chunkingService.chunkDocument(
      document.content,
      document.sourceType,
      {
        companionId: document.companionId,
        sourceId: document.sourceId,
        documentId: document.id,
        sourceType: document.sourceType,
        title: document.title,
        sourceUrl: document.sourceUrl || "",
        chunkIndex: 0,
        transcriptSegments: meta.transcriptSegments,
      }
    );

    const validChunks = rawChunks.filter((c) => chunkingService.isValidChunk(c));

    const formattedChunks = validChunks.map((c, idx) => {
      const start = c.metadata.startSeconds;
      const end = c.metadata.endSeconds;
      const timeRange =
        start !== undefined && end !== undefined
          ? `${formatSeconds(start)} - ${formatSeconds(end)}`
          : null;

      return {
        index: c.metadata.chunkIndex ?? idx,
        content: c.content,
        charCount: c.content.length,
        wordCount: c.content.trim().split(/\s+/).length,
        startSeconds: start,
        endSeconds: end,
        timeRange,
      };
    });

    // Cache in background so future requests take < 5ms
    prismadb.sourceDocument
      .update({
        where: { id: document.id },
        data: {
          metadata: {
            ...meta,
            chunksCache: formattedChunks,
          },
        },
      })
      .catch((err) => console.error("Failed to cache document chunks:", err));

    return NextResponse.json({
      document: {
        ...docHeader,
        chunkCount: formattedChunks.length,
      },
      chunks: formattedChunks,
    });
  } catch (error) {
    console.error("[DOCUMENT_CHUNKS_GET]", error);
    return NextResponse.json({ error: "Failed to load chunks" }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/[documentId]/chunks
 * Supports deleting a single chunk (?chunkIndex=N) or ALL chunks for the document
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;
    const { searchParams } = new URL(req.url);
    const chunkIndexParam = searchParams.get("chunkIndex");

    const document = await prismadb.sourceDocument.findUnique({
      where: { id: documentId },
      include: {
        companion: { select: { userId: true, id: true } },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.companion.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const embeddingService = new EmbeddingService();
    const meta = (document.metadata as any) || {};
    const existingCache: any[] = Array.isArray(meta.chunksCache) ? meta.chunksCache : [];

    // Case 1: Delete a single chunk
    if (chunkIndexParam !== null && chunkIndexParam !== undefined && chunkIndexParam !== "") {
      const chunkIndex = parseInt(chunkIndexParam, 10);
      if (isNaN(chunkIndex)) {
        return NextResponse.json({ error: "Invalid chunkIndex" }, { status: 400 });
      }

      // 1. Remove chunk from metadata.chunksCache
      const updatedCache = existingCache.filter((c: any) => c.index !== chunkIndex);
      const newChunkCount = updatedCache.length;

      // 2. Parallel execution: Pinecone vector delete + Postgres update
      const pineconeDeletePromise = embeddingService
        .deleteChunk(document.companionId, document.id, chunkIndex)
        .catch((pErr) => {
          console.warn(`Pinecone chunk delete notice for index ${chunkIndex}:`, pErr);
        });

      const dbUpdatePromise = prismadb.sourceDocument.update({
        where: { id: documentId },
        data: {
          chunkCount: newChunkCount,
          metadata: {
            ...meta,
            chunksCache: updatedCache,
          },
        },
      });

      await Promise.all([pineconeDeletePromise, dbUpdatePromise]);

      if (document.sourceId) {
        invalidateSourceCache(document.sourceId);
      }

      return NextResponse.json({
        success: true,
        deletedIndex: chunkIndex,
        remainingCount: newChunkCount,
      });
    }

    // Case 2: Delete ALL chunks of this video
    const chunkIndices = existingCache.map((c: any) => c.index);

    const pineconeClearPromise = embeddingService
      .deleteDocumentChunks(document.companionId, document.id, chunkIndices)
      .catch((pErr) => {
        console.warn(`Pinecone clear all chunks notice:`, pErr);
      });

    const dbClearPromise = prismadb.sourceDocument.update({
      where: { id: documentId },
      data: {
        chunkCount: 0,
        metadata: {
          ...meta,
          chunksCache: [],
        },
      },
    });

    await Promise.all([pineconeClearPromise, dbClearPromise]);

    if (document.sourceId) {
      invalidateSourceCache(document.sourceId);
    }

    return NextResponse.json({
      success: true,
      message: "All chunks deleted for this document",
    });
  } catch (error) {
    console.error("[DOCUMENT_CHUNKS_DELETE]", error);
    return NextResponse.json({ error: "Failed to delete chunks" }, { status: 500 });
  }
}
