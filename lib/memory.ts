import { Redis } from "@upstash/redis";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export type CompanionKey = {
  companionName: string;
  modelName: string;
  userId: string;
};

export class MemoryManager {
  private static instance: MemoryManager;
  private redis: Redis;
  private pinecone: Pinecone;
  private embeddings: GoogleGenerativeAIEmbeddings;

  private constructor() {
    this.redis = Redis.fromEnv();
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY!,
      model: 'text-embedding-004',
    });
  }

  private async init() {
    // Validate environment variables
    const requiredEnvVars = ['PINECONE_INDEX', 'PINECONE_API_KEY', 'GEMINI_API_KEY'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`${envVar} environment variable is required`);
      }
    }

    // Test Pinecone connection
    try {
      const index = this.pinecone.index(process.env.PINECONE_INDEX!);
      await index.describeIndexStats();
    } catch (error) {
      console.error("Failed to connect to Pinecone:", error);
      throw error;
    }
  }

  // Load and embed PDF content for a companion
  public async seedCompanionKnowledgeFromPDF(companionId: string, pdfPath: string) {
    try {
      const pineconeIndex = this.pinecone.index(process.env.PINECONE_INDEX!);

      // Check if already embedded
      const existingDocs = await pineconeIndex.query({
        topK: 1,
        vector: await this.embeddings.embedQuery("test"),
        filter: { companionId },
        includeMetadata: true,
      });

      if (existingDocs.matches?.length > 0) {
        console.log(`Companion ${companionId} already embedded`);
        return;
      }

      // Load and process PDF
      const loader = new PDFLoader(pdfPath);
      const docs = await loader.load();

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const chunks = await textSplitter.splitDocuments(docs);

      // Add metadata and embed
      const docsWithMetadata = chunks.map((doc, index) => ({
        ...doc,
        metadata: {
          companionId,
          chunkIndex: index,
          source: pdfPath,
        }
      }));

      await PineconeStore.fromDocuments(docsWithMetadata, this.embeddings, {
        pineconeIndex,
        maxConcurrency: 5,
      });

      console.log(`Embedded ${chunks.length} chunks for companion ${companionId}`);
    } catch (error) {
      console.error("Failed to embed PDF:", error);
    }
  }

  public async vectorSearch(
    userQuery: string,
    companionId: string
  ) {
    try {
      const pineconeIndex = this.pinecone.index(process.env.PINECONE_INDEX!);
      const queryVector = await this.embeddings.embedQuery(userQuery);
      console.log({ queryVector })

      const searchResults = await pineconeIndex.query({
        topK: 5,
        vector: queryVector,
        includeMetadata: true,
        filter: { companionId },
      });

      return searchResults.matches?.map(match => ({
        pageContent: match.metadata?.text,
        metadata: match.metadata || {}
      })) || [];

    } catch (error) {
      console.error("Vector search failed:", error);
      return [];
    }
  }

  public static async getInstance(): Promise<MemoryManager> {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
      await MemoryManager.instance.init();
    }
    return MemoryManager.instance;
  }

  private generateRedisCompanionKey({
    companionName,
    modelName,
    userId,
  }: CompanionKey): string {
    return `${companionName}-${modelName}-${userId}`;
  }

  // Save message to chat history
  public async writeToHistory(text: string, companionKey: CompanionKey) {
    if (!companionKey?.userId) return null;

    const key = this.generateRedisCompanionKey(companionKey);
    return await this.redis.zadd(key, {
      score: Date.now(),
      member: text,
    });
  }

  // Get recent chat history
  public async readLatestHistory(companionKey: CompanionKey): Promise<string> {
    if (!companionKey?.userId) return "";

    const key = this.generateRedisCompanionKey(companionKey);

    const result = await this.redis.zrange(key, 0, Date.now(), { byScore: true });

    return result.slice(-10).join("\n"); // Get last 10 messages
  }

  // Initialize chat history with seed content
  public async seedChatHistory(seedContent: string, delimiter: string = "\n", companionKey: CompanionKey) {
    const key = this.generateRedisCompanionKey(companionKey);
    if (await this.redis.exists(key)) return;

    const lines = seedContent.split(delimiter);
    for (let i = 0; i < lines.length; i++) {
      await this.redis.zadd(key, { score: i, member: lines[i] });
    }
  }
}
