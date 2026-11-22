import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { SourceAdapterFactory, detectSourceType } from "@/lib/sources/adapter-factory";
import { getQueueService } from "@/lib/services/queue-service";
import { SourceStatus } from "@prisma/client";

// Register all adapters
import "@/lib/sources/register-adapters";

// High-speed in-memory cache for companion sources list
const sourcesListCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 3500;

function invalidateSourcesListCache(companionId?: string) {
  if (companionId) {
    sourcesListCache.delete(companionId);
  } else {
    sourcesListCache.clear();
  }
}

/**
 * GET /api/sources?companionId=xxx
 * List all sources for a companion
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const companionId = searchParams.get("companionId");

    if (!companionId) {
      return NextResponse.json(
        { error: "companionId is required" },
        { status: 400 }
      );
    }

    // Check fast cache first
    const cached = sourcesListCache.get(companionId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // Verify ownership
    const companion = await prismadb.companion.findUnique({
      where: { id: companionId },
    });

    if (!companion || companion.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all sources with document counts
    const sources = await prismadb.source.findMany({
      where: { companionId },
      include: {
        _count: {
          select: { documents: true },
        },
        documents: {
          select: {
            processingStatus: true,
            chunkCount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format response with aggregated stats
    const formatted = sources.map((source) => {
      const completedCount = source.documents.filter(
        (d) => d.processingStatus === "COMPLETED"
      ).length;
      const totalChunks = source.documents.reduce(
        (acc, d) => acc + (d.chunkCount || 0),
        0
      );

      // Self-heal: If source was left in INGESTING or DISCOVERING but has had no heartbeat for > 60 seconds (e.g. server restarted)
      let status = source.status;
      if (
        (status === "INGESTING" || status === "DISCOVERING") &&
        Date.now() - new Date(source.updatedAt).getTime() > 60 * 1000
      ) {
        status = (completedCount >= source.totalItems && source.totalItems > 0 ? "READY" : "PAUSED") as any;
      }

      // If source is marked READY but processedItems < totalItems, accurately reflect as PARTIAL
      if (status === "READY" && source.totalItems > 0 && completedCount < source.totalItems) {
        status = "PARTIAL" as any;
      }

      const processedItems = Math.max(source.processedItems, completedCount);
      const totalItems = source.totalItems || processedItems;

      return {
        id: source.id,
        type: source.type,
        title: source.title,
        originalUrl: source.originalUrl,
        canonicalUrl: source.canonicalUrl,
        status,
        totalItems,
        processedItems,
        failedItems: source.failedItems,
        totalChunks,
        lastSyncedAt: source.lastSyncedAt,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
        configuration: source.configuration,
      };
    });

    sourcesListCache.set(companionId, { data: formatted, timestamp: Date.now() });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[SOURCES_GET]", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sources
 * Create a new source and start ingestion
 */
export async function POST(req: NextRequest) {
  try {
    console.log("\n🚀 [SOURCES_POST] Starting new source creation...");
    
    const { userId } = await auth();
    if (!userId) {
      console.log("❌ [SOURCES_POST] User not authenticated");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("✅ [SOURCES_POST] User authenticated:", userId);

    const body = await req.json();
    const { companionId, input, title, sourceType, configuration } = body;
    
    console.log("📝 [SOURCES_POST] Request data:", {
      companionId,
      input,
      title,
      sourceType,
      configProvided: !!configuration
    });

    if (!companionId || !input) {
      console.log("❌ [SOURCES_POST] Missing required fields");
      return NextResponse.json(
        { error: "companionId and input are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    console.log("🔍 [SOURCES_POST] Verifying companion ownership...");
    const companion = await prismadb.companion.findUnique({
      where: { id: companionId },
    });

    if (!companion || companion.userId !== userId) {
      console.log("❌ [SOURCES_POST] Companion not found or unauthorized");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.log("✅ [SOURCES_POST] Companion verified:", companion.name);

    // Detect or validate source type
    console.log("🔍 [SOURCES_POST] Detecting source type...");
    const detectedType = sourceType || detectSourceType(input);
    console.log("📌 [SOURCES_POST] Detected type:", detectedType);
    
    if (!detectedType) {
      console.log("❌ [SOURCES_POST] Could not detect source type");
      return NextResponse.json(
        { error: "Could not detect source type from input" },
        { status: 400 }
      );
    }

    // Get adapter and validate input
    console.log("🔌 [SOURCES_POST] Getting adapter for type:", detectedType);
    const adapter = SourceAdapterFactory.getAdapter(detectedType);
    console.log("✅ [SOURCES_POST] Adapter obtained, validating input...");
    
    const validation = await adapter.validate(input);
    console.log("📋 [SOURCES_POST] Validation result:", {
      isValid: validation.isValid,
      canonicalUrl: validation.canonicalUrl,
      error: validation.errorMessage
    });

    if (!validation.isValid) {
      console.log("❌ [SOURCES_POST] Validation failed:", validation.errorMessage);
      return NextResponse.json(
        { error: validation.errorMessage },
        { status: 400 }
      );
    }

    // Create source record
    console.log("💾 [SOURCES_POST] Creating source in database...");
    const source = await prismadb.source.create({
      data: {
        companionId,
        userId,
        type: detectedType,
        title: title || validation.metadata?.title || input,
        originalUrl: input,
        canonicalUrl: validation.canonicalUrl || input,
        configuration: configuration || {},
        status: SourceStatus.PENDING,
      },
    });
    console.log("✅ [SOURCES_POST] Source created:", {
      id: source.id,
      type: source.type,
      title: source.title,
      status: source.status
    });

    // Enqueue ingestion job
    console.log("📤 [SOURCES_POST] Enqueueing ingestion job...");
    const queueService = getQueueService();
    const result = await queueService.enqueueIngestion(source.id);
    console.log("✅ [SOURCES_POST] Job enqueued:", result);
    
    invalidateSourcesListCache(companionId);

    console.log("🎉 [SOURCES_POST] Source creation completed successfully!\n");
    return NextResponse.json(source);
  } catch (error) {
    console.error("❌ [SOURCES_POST] Error:", error);
    console.error("Stack trace:", (error as Error).stack);
    return NextResponse.json(
      { error: "Failed to create source", message: (error as Error).message },
      { status: 500 }
    );
  }
}
