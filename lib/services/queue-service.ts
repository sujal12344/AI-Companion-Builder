import { Client } from "@upstash/qstash";

/**
 * Queue service for background jobs
 * Uses Upstash QStash for reliable job processing
 */
export class QueueService {
  private client: Client | null = null;
  private baseUrl: string;

  constructor() {
    // Initialize QStash client if credentials are available
    if (process.env.QSTASH_TOKEN) {
      this.client = new Client({
        token: process.env.QSTASH_TOKEN,
      });
    } else {
      console.warn("⚠️  QStash not configured - jobs will run synchronously");
    }

    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
  }

  /**
   * Enqueue source ingestion job
   */
  async enqueueIngestion(sourceId: string): Promise<{ messageId?: string }> {
    if (!this.client) {
      // Fallback: process synchronously in development
      console.warn("Processing ingestion synchronously (QStash not configured)");
      return this.processSynchronously(sourceId);
    }

    try {
      const response = await this.client.publishJSON({
        url: `${this.baseUrl}/api/worker/ingest`,
        body: { sourceId },
        retries: 3,
        timeout: "5m",
      });

      console.log(`✅ Ingestion job enqueued: ${response.messageId}`);

      return { messageId: response.messageId };
    } catch (error) {
      console.error("Failed to enqueue job:", error);
      
      // Fallback to synchronous processing
      console.warn("Falling back to synchronous processing");
      return this.processSynchronously(sourceId);
    }
  }

  /**
   * Enqueue multiple ingestion jobs
   */
  async enqueueIngestionBatch(sourceIds: string[]): Promise<void> {
    if (!this.client) {
      // Process synchronously
      for (const sourceId of sourceIds) {
        await this.processSynchronously(sourceId);
      }
      return;
    }

    try {
      const messages = sourceIds.map((sourceId) => ({
        url: `${this.baseUrl}/api/worker/ingest`,
        body: JSON.stringify({ sourceId }),
      }));

      await this.client.batchJSON(messages);

      console.log(`✅ Enqueued ${sourceIds.length} ingestion jobs`);
    } catch (error) {
      console.error("Failed to enqueue batch:", error);
      throw error;
    }
  }

  /**
   * Synchronous fallback for development (no QStash)
   */
  private async processSynchronously(sourceId: string): Promise<{ messageId?: string }> {
    try {
      // Import dynamically to avoid circular dependency
      const { IngestionService } = await import("./ingestion-service");
      const service = new IngestionService();
      
      // Process in background (don't await)
      service.processSource(sourceId).catch((error) => {
        console.error(`Synchronous ingestion failed for ${sourceId}:`, error);
      });

      return { messageId: `sync-${sourceId}` };
    } catch (error) {
      console.error("Synchronous processing failed:", error);
      throw error;
    }
  }

  /**
   * Check if QStash is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }
}

/**
 * Singleton instance
 */
let queueServiceInstance: QueueService | null = null;

export function getQueueService(): QueueService {
  if (!queueServiceInstance) {
    queueServiceInstance = new QueueService();
  }
  return queueServiceInstance;
}
