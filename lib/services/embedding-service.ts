import { GoogleGenAI } from "@google/genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { DocumentChunk, ChunkMetadata } from "../sources/types";
import { getLogTimestamp } from "../utils";
import { SourceType } from "@prisma/client";

/**
 * Embedding and Pinecone service
 * Handles vector generation and storage with Gemini embeddings
 * Uses @google/genai SDK (latest) instead of @google/generative-ai
 */
export class EmbeddingService {
  private genAI: GoogleGenAI;
  private pinecone: Pinecone;
  private indexName: string;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY environment variable is required");
    }

    if (!process.env.PINECONE_INDEX) {
      throw new Error("PINECONE_INDEX environment variable is required");
    }

    // Ensure only GEMINI_API_KEY is used by @google/genai
    if (process.env.GOOGLE_API_KEY && !process.env.YOUTUBE_API_KEY) {
      delete process.env.GOOGLE_API_KEY;
    }

    // Initialize Google GenAI SDK (new package @google/genai)
    this.genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    this.indexName = process.env.PINECONE_INDEX;
  }

  /**
   * Embed and upsert chunks to Pinecone
   * Optimized for RAG semantic search with detailed progress logging
   * Uses Google GenAI SDK directly for embeddings
   */
  async embedAndStore(
    chunks: DocumentChunk[],
    companionId: string,
    sourceId: string,
    documentId: string,
    onProgress?: (embeddedCount: number, total: number) => Promise<void>,
    isCancelled?: () => Promise<boolean>
  ): Promise<void> {
    if (chunks.length === 0) {
      console.warn("⚠️  [EMBEDDING] No chunks to embed");
      return;
    }

    const embedStartTime = Date.now();
    console.log(`\n${getLogTimestamp()} 🔢 [EMBEDDING] Starting embedding process for ${chunks.length} chunks...`);
    console.log(`${getLogTimestamp()} 📊 [EMBEDDING] Using model: gemini-embedding-2 (Google Embedding-2, 3072 dimensions)`);
    
    const index = this.pinecone.index(this.indexName);
    const batchSize = 100; // Pinecone recommendation

    let totalEmbedded = 0;

    // Process in batches
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const vectors = [];

      console.log(`\n${getLogTimestamp()} 📦 [EMBEDDING] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}...`);

      for (const chunk of batch) {
        // Check if user paused or stopped ingestion
        if (isCancelled && (await isCancelled())) {
          console.log(`\n${getLogTimestamp()} ⏸️ [EMBEDDING] Processing paused by user request`);
          throw new Error("PAUSED_BY_USER");
        }

        const chunkStartTime = Date.now();
        try {
          const chunkNum = totalEmbedded + 1;
          console.log(`   ${getLogTimestamp()} 🔢 [${chunkNum}/${chunks.length}] Embedding chunk ${chunk.metadata.chunkIndex} (${chunk.content.length} chars)...`);
          
          // Generate embedding using Google GenAI SDK with rate-limit retry support
          let embedding: number[] | null = null;
          let retries = 3;

          while (retries > 0) {
            try {
              const result = await this.genAI.models.embedContent({
                model: "gemini-embedding-2",
                contents: chunk.content,
              });

              if (result.embeddings && result.embeddings[0]?.values) {
                embedding = result.embeddings[0].values;
                break;
              }
              throw new Error("Failed to generate embedding: empty response");
            } catch (embedError: any) {
              const errMsg = embedError?.message || String(embedError);
              const isDailyQuotaExhausted =
                errMsg.includes("limit: 1000") ||
                errMsg.includes("PerDay") ||
                errMsg.includes("Please retry in") ||
                errMsg.includes("embed_content_free_tier_requests");

              // If daily quota is exhausted, fail fast immediately - 20s retries will never help
              if (isDailyQuotaExhausted) {
                throw embedError;
              }

              const isRateLimit =
                embedError?.status === 429 ||
                errMsg.includes("RESOURCE_EXHAUSTED") ||
                errMsg.includes("quota") ||
                errMsg.includes("rate-limits");

              const isNetworkGlitch =
                errMsg.includes("ECONNRESET") ||
                errMsg.includes("ETIMEDOUT") ||
                errMsg.includes("fetch failed") ||
                errMsg.includes("socket hang up");

              retries--;
              if ((isRateLimit || isNetworkGlitch) && retries > 0) {
                const waitMs = isRateLimit ? 5000 : 1500;
                console.warn(
                  `   ⏳ [EMBEDDING] Transient ${isNetworkGlitch ? "network glitch (ECONNRESET/timeout)" : "rate limit"}. Retrying in ${waitMs / 1000}s (${retries} retries left)...`
                );
                await this.delay(waitMs);
              } else {
                throw embedError;
              }
            }
          }

          if (!embedding) {
            throw new Error(`Failed to generate embedding for chunk ${chunk.metadata.chunkIndex}`);
          }

          // Create stable vector ID
          const vectorId = this.generateVectorId(
            companionId,
            documentId,
            chunk.metadata.chunkIndex
          );

          // Prepare metadata for Pinecone (flatten nested objects)
          const metadata = this.prepareMetadata(chunk.metadata, companionId, sourceId, documentId);

          vectors.push({
            id: vectorId,
            values: embedding,
            metadata: {
              ...metadata,
              text: chunk.content, // Store text for retrieval
            },
          });

          totalEmbedded++;
          const chunkDuration = ((Date.now() - chunkStartTime) / 1000).toFixed(2);
          console.log(`   ${getLogTimestamp()} ✅ [${chunkNum}/${chunks.length}] Embedded successfully in ${chunkDuration}s (${embedding?.length || 0} dims)`);
          
          // Report real-time embedding progress to database every 3 chunks or on completion
          if (onProgress && (totalEmbedded % 3 === 0 || totalEmbedded === chunks.length)) {
            try {
              await onProgress(totalEmbedded, chunks.length);
            } catch (pErr) {
              console.warn("   ⚠️ [EMBEDDING] Failed to report progress callback:", pErr);
            }
          }

          // Safe pacing between chunks to stay well under Google Gemini 100 req/min quota
          await this.delay(200);
          
        } catch (error) {
          console.error(`   ${getLogTimestamp()} ❌ [EMBEDDING] Failed to embed chunk ${chunk.metadata.chunkIndex}:`, error);
          throw error;
        }
      }

      // Upsert batch to Pinecone
      if (vectors.length > 0) {
        try {
          console.log(`\n${getLogTimestamp()} 💾 [PINECONE] Upserting batch of ${vectors.length} vectors...`);
          await index.upsert(vectors);
          console.log(`${getLogTimestamp()} ✅ [PINECONE] Batch upserted successfully!`);
        } catch (error) {
          console.error(`${getLogTimestamp()} ❌ [PINECONE] Failed to upsert vectors:`, error);
          throw error;
        }
      }

      // Rate limiting between batches
      if (i + batchSize < chunks.length) {
        await this.delay(100);
      }
    }

    const totalDuration = ((Date.now() - embedStartTime) / 1000).toFixed(1);
    console.log(`\n${getLogTimestamp()} 🎯 [EMBEDDING] Finished embedding ${totalEmbedded} chunks in ${totalDuration}s`);
    console.log(`🎉 [EMBEDDING] Complete! Embedded and stored ${totalEmbedded} chunks in Pinecone`);
    console.log(`🔍 [EMBEDDING] Ready for semantic search queries\n`);
  }

  /**
   * Query Pinecone for relevant chunks using semantic search
   * Returns most similar chunks based on vector similarity
   */
  async query(
    query: string,
    companionId: string,
    topK: number = 12
  ): Promise<Array<{ content: string; metadata: Record<string, any>; score: number }>> {
    try {
      console.log(`\n🔍 [SEMANTIC-SEARCH] Query: "${query}"`);
      console.log(`📊 [SEMANTIC-SEARCH] Searching top ${topK} results for companion: ${companionId}`);
      
      const index = this.pinecone.index(this.indexName);

      // Embed query using same model for consistency
      console.log(`🔢 [SEMANTIC-SEARCH] Embedding query...`);
      const result = await this.genAI.models.embedContent({
        model: "gemini-embedding-2",
        contents: query,
      });
      
      if (!result.embeddings || !result.embeddings[0]?.values) {
        throw new Error("Failed to generate query embedding: empty response");
      }
      
      const queryVector = result.embeddings[0].values;
      
      console.log(`✅ [SEMANTIC-SEARCH] Query embedded (${queryVector.length} dimensions)`);

      // Query Pinecone with companion filter
      console.log(`🔎 [SEMANTIC-SEARCH] Searching Pinecone vector database...`);
      const queryResponse = await index.query({
        vector: queryVector,
        topK,
        filter: { companionId },
        includeMetadata: true,
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        console.log(`⚠️  [SEMANTIC-SEARCH] No results found`);
        return [];
      }

      // Log results with similarity scores
      console.log(`✅ [SEMANTIC-SEARCH] Found ${queryResponse.matches.length} relevant chunks:`);
      queryResponse.matches.forEach((match, idx) => {
        const score = (match.score || 0) * 100;
        const preview = ((match.metadata?.text as string) || "").substring(0, 100);
        console.log(`   ${idx + 1}. Score: ${score.toFixed(1)}% | "${preview}..."`);
      });
      console.log(``);

      // Return results with content and metadata
      return queryResponse.matches.map((match) => ({
        content: (match.metadata?.text as string) || "",
        metadata: match.metadata || {},
        score: match.score || 0,
      }));
    } catch (error) {
      console.error("❌ [SEMANTIC-SEARCH] Query failed:", error);
      throw error;
    }
  }

  /**
   * Delete vectors for a document
   */
  async deleteDocument(companionId: string, documentId: string): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);

      // Delete by filter
      await index.deleteMany({
        filter: {
          companionId,
          documentId,
        },
      });

      console.log(`Deleted vectors for document ${documentId}`);
    } catch (error) {
      console.error("Failed to delete document vectors:", error);
      throw error;
    }
  }

  /**
   * Delete a single chunk vector from Pinecone
   */
  async deleteChunk(companionId: string, documentId: string, chunkIndex: number): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);
      const vectorId = this.generateVectorId(companionId, documentId, chunkIndex);
      await index.deleteOne(vectorId);
      console.log(`Deleted chunk vector ${vectorId} from Pinecone`);
    } catch (error) {
      console.error(`Failed to delete chunk vector ${chunkIndex}:`, error);
      throw error;
    }
  }

  /**
   * Delete specific chunk vectors or all document vectors from Pinecone
   */
  async deleteDocumentChunks(companionId: string, documentId: string, chunkIndices?: number[]): Promise<void> {
    const index = this.pinecone.index(this.indexName);

    if (chunkIndices && chunkIndices.length > 0) {
      const vectorIds = chunkIndices.map((idx) =>
        this.generateVectorId(companionId, documentId, idx)
      );
      try {
        await index.deleteMany(vectorIds);
        console.log(`Deleted ${vectorIds.length} vectors for document ${documentId}`);
        return;
      } catch (err) {
        console.warn(`Vector ID batch delete failed, attempting filter delete:`, err);
      }
    }

    try {
      await index.deleteMany({
        filter: {
          companionId,
          documentId,
        },
      });
      console.log(`Deleted vectors via filter for document ${documentId}`);
    } catch (error) {
      console.error("Failed to delete document vectors:", error);
      throw error;
    }
  }

  /**
   * Delete all vectors for a source
   */
  async deleteSource(companionId: string, sourceId: string): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);

      // Delete by filter (gracefully handle empty results)
      try {
        await index.deleteMany({
          filter: {
            companionId,
            sourceId,
          },
        });
        console.log(`Deleted vectors for source ${sourceId}`);
      } catch (error: any) {
        // If 404, it means no vectors exist - that's fine
        if (error.status === 404 || error.message?.includes('404')) {
          console.log(`No vectors found for source ${sourceId} (already clean)`);
          return;
        }
        throw error;
      }
    } catch (error) {
      console.error("Failed to delete source vectors:", error);
      throw error;
    }
  }

  /**
   * Delete all vectors for a companion
   */
  async deleteCompanion(companionId: string): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);

      // Delete by filter
      await index.deleteMany({
        filter: { companionId },
      });

      console.log(`Deleted all vectors for companion ${companionId}`);
    } catch (error) {
      console.error("Failed to delete companion vectors:", error);
      throw error;
    }
  }

  /**
   * Generate stable vector ID
   */
  private generateVectorId(
    companionId: string,
    documentId: string,
    chunkIndex: number
  ): string {
    return `${companionId}:${documentId}:${chunkIndex}`;
  }

  /**
   * Prepare metadata for Pinecone (flatten and filter)
   */
  private prepareMetadata(
    metadata: ChunkMetadata,
    companionId: string,
    sourceId: string,
    documentId: string
  ): Record<string, string | number | boolean> {
    const prepared: Record<string, string | number | boolean> = {
      companionId,
      sourceId,
      documentId,
      sourceType: metadata.sourceType as string,
      title: metadata.title,
      chunkIndex: metadata.chunkIndex,
    };

    // Add optional fields
    if (metadata.sourceUrl) prepared.sourceUrl = metadata.sourceUrl;
    if (metadata.author) prepared.author = metadata.author;
    if (metadata.publishedAt) prepared.publishedAt = metadata.publishedAt.toISOString();
    if (metadata.startSeconds !== undefined) prepared.startSeconds = metadata.startSeconds;
    if (metadata.endSeconds !== undefined) prepared.endSeconds = metadata.endSeconds;
    if (metadata.totalChunks !== undefined) prepared.totalChunks = metadata.totalChunks;

    return prepared;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if vector already exists (for idempotency)
   */
  async vectorExists(companionId: string, documentId: string, chunkIndex: number): Promise<boolean> {
    try {
      const index = this.pinecone.index(this.indexName);
      const vectorId = this.generateVectorId(companionId, documentId, chunkIndex);

      const result = await index.fetch([vectorId]);
      return result.records && Object.keys(result.records).length > 0;
    } catch (error) {
      console.error("Failed to check vector existence:", error);
      return false;
    }
  }
}
