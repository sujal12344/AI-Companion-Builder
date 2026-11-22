import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { IngestionService } from "@/lib/services/ingestion-service";

// Register all adapters
import "@/lib/sources/register-adapters";

/**
 * QStash worker endpoint for background ingestion
 * Processes source ingestion jobs asynchronously
 */
async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceId } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: "Missing sourceId" },
        { status: 400 }
      );
    }

    console.log(`\n🚀 Worker received ingestion job for source: ${sourceId}`);

    // Create ingestion service and process
    const ingestionService = new IngestionService();
    await ingestionService.processSource(sourceId);

    return NextResponse.json({
      success: true,
      message: `Source ${sourceId} ingested successfully`,
    });
  } catch (error) {
    console.error("[WORKER_INGEST]", error);
    return NextResponse.json(
      {
        error: "Ingestion failed",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

// Export with QStash signature verification if configured
export const POST = process.env.QSTASH_CURRENT_SIGNING_KEY &&
  process.env.QSTASH_NEXT_SIGNING_KEY
  ? verifySignatureAppRouter(handler)
  : handler;

export const maxDuration = 60; // Max allowed timeout for Vercel Hobby plan (60 seconds)
export const dynamic = "force-dynamic";
