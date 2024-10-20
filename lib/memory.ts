import { Redis as RedisClient } from "@upstash/redis";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { PineconeClient } from "@pinecone-database/pinecone";
import { OpenAI } from "openai";

export type CompanionKey = {
  companionName: string;
  modelName: string;
  userId: string;
};

export class MemoryManager {
  public static instance: MemoryManager; //Memory me banaya
  private RedisDBhistory: RedisClient; //RedisClient ke history private kiya
  private vectorDBClient: PineconeClient; //vectorDBClient for clientSide like jaise ham mongodb ko connect karane ke liye mongoose use karte hai vaise hi yaha pineconeClient use kiya hai

  public constructor() {
    this.RedisDBhistory = RedisClient.fromEnv();
    this.vectorDBClient = new PineconeClient();
  }

  public async init() {
    if (this.vectorDBClient instanceof PineconeClient) {
      try {
        await this.vectorDBClient.init({
          apiKey: process.env.PINECONE_API_KEY!,
          environment: process.env.PINECONE_ENVIRONMENT!,
          // projectName: process.env.PINECONE_INDEX!,
        });

        if (!process.env.PINECONE_INDEX) {
          throw new Error("PINECONE_INDEX environment variable is not defined");
        }
        
        this.vectorDBClient.projectName = process.env.PINECONE_INDEX!;
        console.log("PineconeClient initialized successfully");
      } catch (error) {
        console.error("Failed to initialize PineconeClient:", error);
        if (error instanceof TypeError) {
          console.error(
            "Network request failed. Please check your internet connection and API key."
          );
        } else {
          console.error("An unexpected error occurred:", error, typeof error);
        }
      }
    }
  }

  public async vectorSearch(
    recentChatHistory: string,
    companionFileName: string
  ) {
    const pineconeClient = <PineconeClient>this.vectorDBClient;
    console.log("pineconeClient", pineconeClient);

    pineconeClient.projectName = process.env.PINECONE_INDEX!;
    const pineconeIndex = pineconeClient.Index(process.env.PINECONE_INDEX!);
    console.log("pineconeIndex", pineconeIndex);

    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        // modelName: "gpt-3",
        // modelName: "text-embedding-3-large",
      }), //create instance of OpenAIEmbeddings using my OpenAI API key

      { pineconeIndex: pineconeIndex } //passing pineconeIndex to PineconeStore
    ); //based on OpenAIEmbeddings instanse and pineconeIndex creating vectorStore instance

    // new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log("vectorStore", vectorStore);
    // console.log("OpenAIEmbeddings", OpenAIEmbeddings);

    const similarSearch = await vectorStore
      .similaritySearch(recentChatHistory, 3, { fileName: companionFileName })
      .catch((err: any) => {
        console.log("WARNING: failed to get vector search results.", err);
      });
    console.log("similarDocs", similarSearch);

    return similarSearch;
  }

  public static async getInstance(): Promise<MemoryManager> {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
      await MemoryManager.instance.init();
    }
    return MemoryManager.instance;
  }

  private generateRedisClientCompanionKey({
    companionName,
    modelName,
    userId,
  }: CompanionKey): string {
    return `${companionName}-${modelName}-${userId}`;
  }

  public async writeToHistory(text: string, companionKey: CompanionKey) {
    console.log("writeToHistoryProps", text, companionKey);

    if (!companionKey || typeof companionKey.userId == "undefined") {
      console.log("Companion key set incorrectly");
      return "";
    }

    const key = this.generateRedisClientCompanionKey(companionKey);
    console.log("key", key);
    const result = await this.RedisDBhistory.zadd(key, {
      score: Date.now(),
      member: text,
    });
    console.log("result", result);

    return result;
  }

  public async readLatestHistory(companionKey: CompanionKey): Promise<string> {
    if (!companionKey || typeof companionKey.userId == "undefined") {
      console.log("Companion key set incorrectly");
      return "";
    }

    const key = this.generateRedisClientCompanionKey(companionKey);
    let result = await this.RedisDBhistory.zrange(key, 0, Date.now(), {
      byScore: true,
    });
    console.log("working", result);
    //zrange returns the elements with the lowest scores, here we are getting the latest 30 messages from today to last 30 messages
    // log("resultBefore", result);

    result = result.slice(-30).reverse();
    const recentChats = result.reverse().join("\n");
    console.log("recentChats", recentChats);
    console.log("resultAfter", result);
    return recentChats;
  }

  public async seedChatHistory(
    seedContent: String,
    delimiter: string = "\n",
    companionKey: CompanionKey
  ) {
    console.log("seedChatHistoryProps", seedContent, delimiter, companionKey);
    const key = this.generateRedisClientCompanionKey(companionKey);
    console.log("key", key);
    if (await this.RedisDBhistory.exists(key)) {
      console.log("User already has chat history");
      return;
    }
    console.log(
      "await this.RedisDBhistory.exists(key)",
      await this.RedisDBhistory.exists(key)
    );

    const content = seedContent.split(delimiter);
    console.log("content", content);
    let counter = 0;
    for (const line of content) {
      await this.RedisDBhistory.zadd(key, { score: counter, member: line });
      counter = counter + 1;
    }
  }
}
