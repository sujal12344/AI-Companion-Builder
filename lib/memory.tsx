import { Redis } from "@upstash/redis";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { PineconeClient } from "@pinecone-database/pinecone";
import { log } from "console";

export type CompanionKey = {
  companionName: string;
  modelName: string;
  userId: string;
};

export class MemoryManager {
  public static instance: MemoryManager; //Memory me banaya
  private history: Redis; //Redis ke history private kiya
  private vectorDBClient: PineconeClient; //vectorDBClient for clientSide like jaise ham mongodb ko connect karane ke liye mongoose use karte hai vaise hi yaha pineconeClient use kiya hai

  public constructor() {
    this.history = Redis.fromEnv(); //user ka chathistory le rhe hai using env
    this.vectorDBClient = new PineconeClient(); //user ka vectorDBClient bana rhe hai and create instance
    console.log("MemoryManager", MemoryManager);
    console.log("this.history", this.history);
    console.log("this.vectorDBClient", this.vectorDBClient);
  }

  /*  initiallizing function*/
  public async init() {
    //initialize function to connect with pineconeClient with apiKey and environment
    if (this.vectorDBClient instanceof PineconeClient) {
      //if pineconeClient is instance of PineconeClient then initialize it with apiKey and env
      await this.vectorDBClient.init({
        apiKey: process.env.PINECONE_API_KEY!,
        environment: process.env.PINECONE_ENVIRONMENT!,
      });
      console.log(`apiKey`, process.env.PINECONE_API_KEY);
      console.log(`environment`, process.env.PINECONE_ENVIRONMENT);
      console.log(`vectorDBClient`, this.vectorDBClient);
      console.log("PineconeClient", PineconeClient);
      console.log("Constructor", this.vectorDBClient.constructor);
    }
  }

  /* function for verctor search*/
  public async vectorSearch(
    recentChatHistory: string,
    companionFileName: string
  ) {
    console.log("vectorSearchProps", recentChatHistory, companionFileName);

    const pineconeClient = this.vectorDBClient as PineconeClient; //Assign kar rhe hai and Typescript ka Type insertion hai
    console.log(
      "const pineconeClient = this.vectorDBClient as PineconeClient; ",
      pineconeClient
    );

    const pineconeIndex = this.vectorDBClient.Index(
      //Ye pineconeClient ke index ko fetch karata hai
      process.env.PINECONE_INDEX! || ""
    );
    console.log("vectorDBClient.Index", this.vectorDBClient.Index);
    console.log("pineconeIndex", pineconeIndex);
    console.log("process.env.PINECONE_INDEX", process.env.PINECONE_INDEX);

    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
      { pineconeIndex }
    );
    console.log("vectorStore", vectorStore);
    console.log("PineconeStore", PineconeStore);
    console.log(
      "PineconeStore.fromExistingIndex",
      PineconeStore.fromExistingIndex
    );
    console.log("OpenAIEmbeddings", OpenAIEmbeddings);

    const similarDocs = await vectorStore
      .similaritySearch(recentChatHistory, 3, { fileName: companionFileName })
      .catch((err: any) => {
        console.log("WARNING: failed to get vector search results.", err);
      });
    console.log("similarDocs", similarDocs);
    console.log("recentChatHistory", recentChatHistory);
    console.log("companionFileName", companionFileName);

    return similarDocs;
  }

  public static async getInstance(): Promise<MemoryManager> {
    console.log("MemoryManager", MemoryManager);
    console.log("MemoryManager.instance", MemoryManager.instance);

    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
      await MemoryManager.instance.init();
    }
    console.log("MemoryManager.instance", MemoryManager.instance);

    return MemoryManager.instance;
  }

  private generateRedisCompanionKey({
    companionName,
    modelName,
    userId,
  }: CompanionKey): string {
    log("generateRedisCompanionKey", companionName, modelName, userId);
    return `${companionName}-${modelName}-${userId}`;
  }

  public async writeToHistory(text: string, companionKey: CompanionKey) {
    console.log("writeToHistoryProps", text, companionKey);

    if (!companionKey || typeof companionKey.userId == "undefined") {
      console.log("Companion key set incorrectly");
      return "";
    }
    console.log("typeof companionKey.userId", typeof companionKey.userId);

    const key = this.generateRedisCompanionKey(companionKey);
    log("key", key);
    const result = await this.history.zadd(key, {
      score: Date.now(),
      member: text,
    });
    log("history.zadd", this.history.zadd);
    log("result", result);

    return result;
  }

  public async readLatestHistory(companionKey: CompanionKey): Promise<string> {
    log("readLatestHistoryProps", companionKey);
    if (!companionKey || typeof companionKey.userId == "undefined") {
      console.log("Companion key set incorrectly");
      return "";
    }
    log("typeof companionKey.userId", typeof companionKey.userId);

    const key = this.generateRedisCompanionKey(companionKey);
    log("key", key);
    let result = await this.history.zrange(key, 0, Date.now(), {
      byScore: true,
    });
    log("history.zrange", this.history.zrange);
    log("resultBefore", result);

    result = result.slice(-30).reverse();
    const recentChats = result.reverse().join("\n");
    log("recentChats", recentChats);
    log("resultAfter", result);
    return recentChats;
  }

  public async seedChatHistory(
    seedContent: String,
    delimiter: string = "\n",
    companionKey: CompanionKey
  ) {
    log("seedChatHistoryProps", seedContent, delimiter, companionKey);
    const key = this.generateRedisCompanionKey(companionKey);
    log("key", key);
    if (await this.history.exists(key)) {
      console.log("User already has chat history");
      return;
    }
    log("await this.history.exists(key)", await this.history.exists(key));

    const content = seedContent.split(delimiter);
    log("content", content);
    let counter = 0;
    for (const line of content) {
      await this.history.zadd(key, { score: counter, member: line });
      counter = counter + 1;
    }
    console.log("history.zadd", this.history.zadd);
    log("counter", counter);
  }
}
