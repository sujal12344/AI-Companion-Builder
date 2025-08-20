import { Redis } from "@upstash/redis";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { DocxLoader } from 'langchain/document_loaders/fs/docx';
import { CSVLoader } from 'langchain/document_loaders/fs/csv';
import { JSONLoader } from 'langchain/document_loaders/fs/json';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { scrapeWebContent } from './webScraper';
import { ContextType } from "@prisma/client";

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

  // Load and embed document content for a companion
  public async seedCompanionKnowledgeFromDocument(companionId: string, filePath: string, fileType: ContextType) {
    try {
      const pineconeIndex = this.pinecone.index(process.env.PINECONE_INDEX!);

      // Check if already embedded for this specific document
      const existingDocs = await pineconeIndex.query({
        topK: 1,
        vector: await this.embeddings.embedQuery("test"),
        filter: { companionId, source: filePath },
        includeMetadata: true,
      });

      if (existingDocs.matches?.length > 0) {
        console.log(`Document ${filePath} already embedded for companion ${companionId}`);
        return;
      }

      let docs;

      // Load document based on file type
      switch (fileType) {
        case 'PDF':
          console.log(`Loading PDF: ${filePath}`);
          const pdfLoader = new PDFLoader(filePath);
          docs = await pdfLoader.load();
          console.log(`PDF loaded successfully: ${docs.length} pages`);
          break;
        case 'DOCX':
          console.log(`Loading DOCX: ${filePath}`);
          const docxLoader = new DocxLoader(filePath);
          docs = await docxLoader.load();
          console.log(`DOCX loaded successfully: ${docs.length} documents`);
          break;
        case 'TXT':
          console.log(`Loading TXT: ${filePath}`);
          const textLoader = new TextLoader(filePath);
          docs = await textLoader.load();
          console.log(`TXT loaded successfully: ${docs.length} documents`);
          break;
        case 'CSV':
          console.log(`Loading CSV: ${filePath}`);
          const csvLoader = new CSVLoader(filePath);
          docs = await csvLoader.load();
          console.log(`CSV loaded successfully: ${docs.length} rows`);
          break;
        case 'JSON':
          console.log(`Loading JSON: ${filePath}`);
          const jsonLoader = new JSONLoader(filePath);
          docs = await jsonLoader.load();
          console.log(`JSON loaded successfully: ${docs.length} documents`);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

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
          source: filePath,
          type: fileType.toUpperCase(),
        }
      }));

      await PineconeStore.fromDocuments(docsWithMetadata, this.embeddings, {
        pineconeIndex,
        maxConcurrency: 5,
      });

      console.log(`Embedded ${chunks.length} chunks for companion ${companionId} from ${fileType} document`);
    } catch (error) {
      console.error(`Failed to embed ${fileType} document:`, error);
    }
  }

  // Load and embed text content for a companion
  public async seedCompanionKnowledgeFromText(
    companionId: string,
    textContexts: { title: string; content: string }[]
  ) {
    try {
      const pineconeIndex = this.pinecone.index(process.env.PINECONE_INDEX!);

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const allChunks = [];

      for (const textContext of textContexts) {
        // Create document from text
        const doc = {
          pageContent: textContext.content,
          metadata: {
            title: textContext.title,
            companionId,
            type: 'TEXT',
            source: `text_${textContext.title}`,
          }
        };

        // Split text into chunks
        const chunks = await textSplitter.splitDocuments([doc]);

        // Add metadata to chunks
        const chunksWithMetadata = chunks.map((chunk, index) => ({
          ...chunk,
          metadata: {
            ...chunk.metadata,
            chunkIndex: index,
          }
        }));

        allChunks.push(...chunksWithMetadata);
      }

      if (allChunks.length > 0) {
        await PineconeStore.fromDocuments(allChunks, this.embeddings, {
          pineconeIndex,
          maxConcurrency: 5,
        });

        console.log(`Embedded ${allChunks.length} text chunks for companion ${companionId}`);
      }
    } catch (error) {
      console.error("Failed to embed text contexts:", error);
    }
  }

  // Load and embed web content for a companion
  public async seedCompanionKnowledgeFromLinks(
    companionId: string,
    linkContexts: { title: string; url: string }[]
  ) {
    try {
      const pineconeIndex = this.pinecone.index(process.env.PINECONE_INDEX!);
      const allChunks = [];

      for (const linkContext of linkContexts) {
        try {
          const chunks = await scrapeWebContent(linkContext.url, linkContext.title);

          // Add companion metadata to chunks
          const chunksWithMetadata = chunks.map(chunk => ({
            ...chunk,
            metadata: {
              ...chunk.metadata,
              companionId,
            }
          }));

          allChunks.push(...chunksWithMetadata);
        } catch (error) {
          console.error(`Failed to scrape ${linkContext.url}:`, error);
          // Continue with other links even if one fails
        }
      }

      if (allChunks.length > 0) {
        await PineconeStore.fromDocuments(allChunks, this.embeddings, {
          pineconeIndex,
          maxConcurrency: 5,
        });

        console.log(`Embedded ${allChunks.length} link chunks for companion ${companionId}`);
      }
    } catch (error) {
      console.error("Failed to embed link contexts:", error);
    }
  }

  public async vectorSearch(
    userQuery: string,
    companionId: string
  ) {
    try {
      const pineconeIndex = this.pinecone.index(process.env.PINECONE_INDEX!);
      const queryVector = await this.embeddings.embedQuery(userQuery);

      const searchResults = await pineconeIndex.query({
        topK: 5,
        vector: queryVector,
        includeMetadata: true,
        filter: { companionId },
      });

      return searchResults.matches?.map(match => ({
        pageContent: match.metadata?.text || match.metadata?.pageContent,
        metadata: match.metadata || {}
      })) || [];

    } catch (error) {
      console.error("Vector search failed:", error);
      return [];
    }
  }

  // Clear all embeddings for a companion
  public async clearCompanionEmbeddings(companionId: string) {
    try {
      const pineconeIndex = this.pinecone.index(process.env.PINECONE_INDEX!);

      // Query all vectors for this companion
      const queryResponse = await pineconeIndex.query({
        topK: 10000, // Large number to get all vectors
        vector: await this.embeddings.embedQuery("dummy"),
        filter: { companionId },
        includeMetadata: false,
      });

      if (queryResponse.matches && queryResponse.matches.length > 0) {
        const vectorIds = queryResponse.matches.map(match => match.id);
        await pineconeIndex.deleteMany(vectorIds);
        console.log(`Cleared ${vectorIds.length} embeddings for companion ${companionId}`);
      }
    } catch (error) {
      console.error("Failed to clear companion embeddings:", error);
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
