import { LangChainStream, StreamingTextResponse } from "ai";
import { currentUser } from "@clerk/nextjs/server";

import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { MemoryManager } from "@/lib/memory";

import { rateLimit } from "@/lib/rateLimit";
import { Replicate } from "langchain/llms/replicate";
import { CallbackManager } from "langchain/callbacks";
import { log } from "console";

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { prompt } = await request.json(); //like in Express req.body
    const user = await currentUser();
    console.log("prompt", prompt);
    console.log("user", user);

    if (!user || !user.firstName || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const identifier = `${request.url}-${user.id}`; //indenifier for rate limit
    console.log("identifier", identifier);

    const { success } = await rateLimit(identifier); //check the rate limit for the user
    console.log("success", success);

    if (!success) {
      return new NextResponse("Rate limit exceeded", { status: 429 });
    }

    const companion = await prismadb.companion.update({
      where: {
        id: params.chatId,
      },
      data: {
        messages: {
          create: {
            content: prompt,
            role: "user",
            userId: user.id,
          },
        },
      },
    });
    console.log("companion", companion);

    if (!companion) {
      return new NextResponse("Companion not found", { status: 404 });
    }

    const companion_file_name = `${companion.id}.txt`;
    console.log("companion_file_name", companion_file_name);

    const companionKey = {
      companionName: companion.id,
      userId: user.id,
      modelName: "llama2-13b", //from we changed to another model
    };
    log("companionKey", companionKey);

    const memoryManager = await MemoryManager.getInstance(); //get the instance of MemoryManager
    log("memoryManager", memoryManager);

    const records = await memoryManager.readLatestHistory(companionKey); //get the latest history
    log("records", records);

    if (records.length === 0) {
      const a = await memoryManager?.seedChatHistory(
        companion.seed,
        "\n\n",
        companionKey
      ); //seed the chat history
      log("a", a);
    }

    await memoryManager.writeToHistory("User:" + prompt + `\n`, companionKey); //write the user message to history
    log("writeToHistory", "User:" + prompt + `\n`);

    // Query Pinecone
    const recentChatHistory = await memoryManager.readLatestHistory(
      companionKey
    ); //get the latest history
    log("recentChatHistory", recentChatHistory);

    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      companion_file_name
    ); //calling the vector search with the parameter recentChatHistory and companion_file_name
    console.log("recentChatHistory", recentChatHistory);
    log("companion_file_name", companion_file_name);
    log("similarDocs", similarDocs);

    let relevantHistory = "";

    if (!!similarDocs && similarDocs.length !== 0) {
      relevantHistory = similarDocs
        .map((doc) => {
          log("doc", doc);
          log("doc.pageContent", doc.pageContent);
          return doc.pageContent;
        })
        .join("\n"); //get the relevant history
      log("similarDocs", similarDocs);
      log("relevantHistory", relevantHistory);
    }

    const { handlers } = LangChainStream(); //get the handlers
    log("handlers", handlers);

    // Call Replicate for inference
    const model = new Replicate({
      model:
        "a16z-infra/llama-2-13b-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
      input: {
        max_length: 2048,
        // max_length: 4096,
      },
      apiKey: process.env.REPLICATE_API_TOKEN,
      callbackManager: CallbackManager.fromHandlers(handlers), //pass the handlers to the callbackManager
    });
    log("model", model);

    // Turn verbose on for debugging
    model.verbose = true;
    const message = `
                      ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${companion.name}: prefix. 

                      ${companion.instructions}

                      Below are the relevant details about ${companion.name}'s past and the conversation you are in.
                      ${relevantHistory}


                      ${recentChatHistory}\n${companion.name}:`;
    log("message", message);

    const response = String(await model.call(message).catch(console.error));
    log("response", response);

    const cleaned = response?.replaceAll(",", ""); //clean the response like [Then, you, can, do, this] to [Then you can do this]
    log("cleaned", cleaned);
    const chunks = cleaned?.split("\n"); //split the response by new line
    log("chunks", chunks);
    const responseBody = chunks?.[0]; //youtube video me usne responseBody ko response liya hai
    log("responseBody", responseBody);
    await memoryManager.writeToHistory("" + responseBody?.trim(), companionKey); //write the response to history
    log("writeToHistory", "" + responseBody?.trim());
    var Readable = require("stream").Readable; //import Readable from stream
    log("Readable", Readable);

    let s = new Readable();
    log("s", s);
    s.push(responseBody);
    s.push(null);
    log("s", s);

    if (responseBody && responseBody.length > 1) {
      await memoryManager.writeToHistory(
        `${responseBody.trim()}`,
        companionKey
      );

      await prismadb.companion.update({
        where: {
          id: params.chatId,
        },
        data: {
          messages: {
            create: {
              content: responseBody.trim(),
              role: "system",
              userId: user.id,
            },
          },
        },
      });
    }

    return new StreamingTextResponse(s);
  } catch (error) {
    console.log("[CHAT_POST]", error);
    return new NextResponse(`Internal Server: ${error}`, { status: 500 });
  }
}
