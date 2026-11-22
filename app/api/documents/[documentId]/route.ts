import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { EmbeddingService } from "@/lib/services/embedding-service";
import { ProcessingStatus } from "@prisma/client";
import { invalidateSourceCache } from "@/lib/sources/source-cache";

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

    const document = await prismadb.sourceDocument.findUnique({
      where: { id: documentId },
      include: {
        companion: { select: { userId: true, id: true } },
        source: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.companion.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sourceId = document.sourceId;
    const isCompleted =
      document.processingStatus === ProcessingStatus.COMPLETED ||
      document.processingStatus === ProcessingStatus.SKIPPED;
    const isFailed = document.processingStatus === ProcessingStatus.FAILED;

    const embeddingService = new EmbeddingService();
    const meta = (document.metadata as any) || {};
    const cache: any[] = Array.isArray(meta.chunksCache) ? meta.chunksCache : [];
    const chunkIndices = cache.map((c: any) => c.index);

    // Parallel execution: Pinecone vector deletion & atomic PostgreSQL transaction
    const pineconeCleanupPromise = embeddingService
      .deleteDocumentChunks(document.companionId, document.id, chunkIndices)
      .catch((pErr) => {
        console.warn("Notice on Pinecone vector cleanup:", pErr);
      });

    const dbCleanupPromise = prismadb.$transaction([
      prismadb.sourceDocument.delete({
        where: { id: documentId },
      }),
      ...(sourceId
        ? [
            prismadb.source.update({
              where: { id: sourceId },
              data: {
                totalItems: { decrement: 1 },
                ...(isCompleted ? { processedItems: { decrement: 1 } } : {}),
                ...(isFailed ? { failedItems: { decrement: 1 } } : {}),
              },
            }),
          ]
        : []),
    ]);

    await Promise.all([pineconeCleanupPromise, dbCleanupPromise]);

    if (sourceId) {
      invalidateSourceCache(sourceId);
    }

    return NextResponse.json({
      success: true,
      message: "Document and associated vectors deleted successfully",
    });
  } catch (error) {
    console.error("[DOCUMENT_DELETE]", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
