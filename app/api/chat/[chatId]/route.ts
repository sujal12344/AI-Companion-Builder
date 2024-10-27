import { LangChainStream, StreamingTextResponse } from "ai";
import { currentUser } from "@clerk/nextjs/server";

import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { MemoryManager } from "@/lib/memory";

import { rateLimit } from "@/lib/rateLimit";
import { Replicate } from "langchain/llms/replicate";
import { CallbackManager } from "langchain/callbacks";

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { prompt } = await request.json(); //like in Express req.body
    const url = new URL(request.url);
    const tone = url.searchParams.get('tone');
    const user = await currentUser();
    // console.log(`tone`, tone);
    // console.log(`prompt`, prompt);
    // console.log("prompt", prompt);
    // console.log("user", user);
    // console.log("user.firstName", user?.firstName);
    // console.log("user.id", user?.id);

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
    console.log("companionKey", companionKey);

    const memoryManager = await MemoryManager.getInstance();

    const records = await memoryManager.readLatestHistory(companionKey); //get the latest history
    console.log("records", records); //give all 30 latest messages according to latest time

    if (records.length === 0 || records === '') {
      const a = await memoryManager?.seedChatHistory(
        companion.seed,
        "\n\n",
        companionKey
      ); //strating me agar kuch nahi hai toh instruction daal rhe hai
      console.log("a", a);
    }

    await memoryManager.writeToHistory("User:" + prompt + `\n`, companionKey); //write the user message to history

    // Query Pinecone
    const recentChatHistory = await memoryManager.readLatestHistory(
      companionKey
    ); //give all 30 latest messages according to latest time

    const similarDocs = await memoryManager.vectorSearch(
      recentChatHistory,
      companion_file_name
    );
    console.log("companion_file_name", companion_file_name);
    console.log("similarDocs", similarDocs);

    let relevantHistory = "";

    if (!!similarDocs && similarDocs.length !== 0) {
      relevantHistory = similarDocs
        .map((doc) => {
          console.log("doc", doc);
          console.log("doc.pageContent", doc.pageContent);
          return doc.pageContent;
        })
        .join("\n"); //get the relevant history
      console.log("similarDocs", similarDocs);
      console.log("relevantHistory", relevantHistory);
    }

    const { handlers } = LangChainStream(); //ye real-time-streaming ke liye kaam aata hai like jaise youtube video ek baar me load nahi hota vaisa
    // log("handlers", handlers);

    // Call Replicate for inference
    const model = new Replicate({
      model:
        "a16z-infra/llama-2-13b-chat:df7690f1994d94e96ad9d568eac121aecf50684a0b0963b25a41cc40061269e5",
      input: {
        max_length: 2048,
        // max_length: 4096,
      },
      apiKey: process.env.REPLICATE_API_TOKEN,
      callbackManager: CallbackManager.fromHandlers(handlers),
      //ye event handlers hai jo events manage karata hai during
    });
    // log("model", model);

    // Turn verbose on for debugging
    model.verbose = true; //Its only for debugging purpose

    const response = String(
      await model
        .call(
          `
        ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${companion.name}: prefix. 

        And You are ${companion.name}, an AI companion with the following characteristics and background:

        ${companion.instructions}

        Important guidelines:
        1. Respond in first person as ${companion.name}.
        2. Do not use any prefixes or labels in your responses.
        3. Maintain the personality, knowledge, and tone consistent with ${companion.name}'s character.
        4. Be engaging, natural, and conversational in your responses.
        5. Reference relevant past interactions when appropriate.

        Below are the relevant details about ${companion.name}'s past and the conversation you are in.
        ${relevantHistory}

        Give Response in ${tone ? tone : companion.name} words only.

        ${recentChatHistory}\n${companion.name}:`
        )
        .catch(console.error)
    );
    console.log("response", response);
    console.log(`tone`, tone);

    const cleaned = response?.replaceAll(",", ""); //clean the response like [Then, you, can, do, this] to [Then you can do this]
    console.log("cleaned", cleaned);
    const chunks = cleaned?.split("\n"); //split the response by new line
    console.log("chunks", chunks);
    const responseBody = chunks?.[0]; //youtube video me usne responseBody ko response liya hai
    console.log("responseBody", responseBody);
    await memoryManager.writeToHistory("" + responseBody?.trim(), companionKey); //write the response to history
    console.log("writeToHistory", "" + responseBody?.trim());
    var Readable = require("stream").Readable; //import Readable from stream
    console.log("Readable", Readable);

    let s = new Readable();
    console.log("s", s);
    s.push(responseBody);
    s.push(null);
    console.log("s", s);

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
