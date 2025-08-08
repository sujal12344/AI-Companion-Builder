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
  public static instance: MemoryManager;
  private RedisDBhistory: Redis;
  private vectorDB: Pinecone;

  public constructor() {
    this.RedisDBhistory = Redis.fromEnv();
    this.vectorDB = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }

  public async init() {
    try {
      // Check required environment variables
      if (!process.env.PINECONE_INDEX) {
        throw new Error("PINECONE_INDEX environment variable is not defined");
      }
      if (!process.env.PINECONE_API_KEY) {
        throw new Error("PINECONE_API_KEY environment variable is not defined");
      }
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is not defined");
      }

      // Test actual Pinecone connection
      const index = this.vectorDB.index(process.env.PINECONE_INDEX);
      await index.describeIndexStats();

      //console.log("Pinecone connection verified successfully");
    } catch (error) {
      console.error("Failed to initialize Pinecone:", error);
      if (error instanceof TypeError) {
        console.error(
          "Network request failed. Please check your internet connection and API key."
        );
      } else {
        console.error("An unexpected error occurred:", error);
      }
      throw error; // Re-throw to prevent app from continuing with broken connection
    }
  }

  // Add companion knowledge from PDF to vector database
  public async seedCompanionKnowledgeFromPDF(
    companionId: string,
    pdfPath: string
  ) {
    try {
      const pineconeIndex = this.vectorDB.index(process.env.PINECONE_INDEX!);

      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY!,
        model: 'text-embedding-004',
      });

      // Check if already embedded (to avoid re-embedding)
      const existingDocs = await pineconeIndex.query({
        topK: 1,
        vector: await embeddings.embedQuery("test"),
        filter: { companionId },
        includeMetadata: true,
      });

      if (existingDocs.matches && existingDocs.matches.length > 0) {
        console.log(`Companion ${companionId} already embedded, skipping...`);
        return;
      }

      // Load PDF
      const loader = new PDFLoader(pdfPath);
      const docs = await loader.load();

      // Split documents into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        keepSeparator: true
      });

      const chunkedDocs = await textSplitter.splitDocuments(docs);

      // Add metadata to chunks
      const docsWithMetadata = chunkedDocs.map((doc, index) => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          companionId: companionId,
          fileName: `${companionId}.pdf`,
          chunkIndex: index,
        }
      }));

      // Embed and store in Pinecone
      await PineconeStore.fromDocuments(
        docsWithMetadata,
        embeddings,
        {
          pineconeIndex,
          maxConcurrency: 5,
        }
      );

      console.log(`Successfully embedded ${chunkedDocs.length} chunks for companion ${companionId} from PDF`);

    } catch (error) {
      console.error("Failed to seed companion knowledge from PDF:", error);
    }
  }

  public async vectorSearch(
    userQuery: string,
    companionId: string
  ) {
    try {
      const pineconeIndex = this.vectorDB.index(process.env.PINECONE_INDEX!);

      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY!,
        model: 'text-embedding-004',
      });

      // Create query vector
      const queryVector = await embeddings.embedQuery(userQuery);

      // Search with companion filter
      const searchResults = await pineconeIndex.query({
        topK: 10,
        vector: queryVector,
        includeMetadata: true,
        filter: { companionId: companionId },
      });

      // Convert to LangChain document format
      const similarDocs = searchResults.matches?.map(match => ({
        pageContent: match.metadata?.text || '',
        metadata: match.metadata || {}
      })) || [];

      console.log("similarDocs found:", similarDocs.length);
      return similarDocs;

    } catch (error) {
      console.log("WARNING: failed to get vector search results.", error);
      console.log("err.message", {error});
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

  public async writeToHistory(text: string, companionKey: CompanionKey) {
    //console.log("writeToHistoryProps", text, companionKey);

    if (!companionKey || typeof companionKey.userId == "undefined") {
      //console.log("Companion key set incorrectly");
      return "";
    }

    const key = this.generateRedisCompanionKey(companionKey);
    //console.log("key", key);
    const result = await this.RedisDBhistory.zadd(key, {
      score: Date.now(),
      member: text,
    });
    //console.log("result", result);

    return result;
  }

  public async readLatestHistory(companionKey: CompanionKey): Promise<string> {
    if (!companionKey || typeof companionKey.userId == "undefined") {
      return "";
    }

    const key = this.generateRedisCompanionKey(companionKey);
    let result = await this.RedisDBhistory.zrange(key, 0, Date.now(), {
      byScore: true,
    });

    result = result.slice(-30).reverse();
    const recentChats = result.reverse().join("\n");
    return recentChats;
  }

  public async seedChatHistory(
    seedContent: string,
    delimiter: string = "\n",
    companionKey: CompanionKey
  ) {
    const key = this.generateRedisCompanionKey(companionKey);
    if (await this.RedisDBhistory.exists(key)) return;

    const content = seedContent.split(delimiter);

    let counter = 0;
    for (const line of content) {
      await this.RedisDBhistory.zadd(key, { score: counter, member: line });
      counter = counter + 1;
    }
  }
}
