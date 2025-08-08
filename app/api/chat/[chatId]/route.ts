import { StreamingTextResponse } from "ai";
import { currentUser } from "@clerk/nextjs/server";

import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { MemoryManager } from "@/lib/memory";

import { rateLimit } from "@/lib/rateLimit";
import Groq from "groq-sdk";

import fs from 'fs';
import path from 'path'

export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const { prompt: userQuery } = await request.json() as { prompt: string }
    const user = await currentUser();
    // console.log({userQuery})

    if (!user || !user.firstName || !user.id || userQuery.trim()) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const identifier = `${request.url}-${user.id}`

    const { success } = await rateLimit(identifier);

    // console.log({success, identifier})

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
            content: userQuery,
            role: "user",
            userId: user.id,
          },
        },
      },
    });

    if (!companion) {
      return new NextResponse("Companion not found", { status: 404 });
    }

    console.log({ companion })

    const companionKey = {
      companionName: companion.id,
      userId: user.id,
      modelName: "llama2-13b",
    };

    const memoryManager = await MemoryManager.getInstance();

    const records = await memoryManager.readLatestHistory(companionKey);

    if (records.length === 0 || records === '') {
      await memoryManager?.seedChatHistory(
        companion.seed,
        "\n\n",
        companionKey
      );
    }

    // Seed companion knowledge from PDF into vector database if not already done
    try {
      const companionPdfPath = path.join(process.cwd(), 'companions', `${companion.name.replaceAll(" ", "_")}.pdf`);

      if (fs.existsSync(companionPdfPath)) {
        await memoryManager.seedCompanionKnowledgeFromPDF(companion.id, companionPdfPath);
      } else {
        console.log(`PDF not found for companion: ${companion.name}`);
      }
    } catch (error) {
      console.log("Could not seed companion knowledge from PDF:", error);
    }

    await memoryManager.writeToHistory("User:" + userQuery + `\n`, companionKey);

    const recentChatHistory = await memoryManager.readLatestHistory(
      companionKey
    );

    const similarDocs = await memoryManager.vectorSearch(
      userQuery, // Use user's current question for better context matching
      companion.id // Use companion ID instead of filename
    );
    console.log("similarDocs", similarDocs);

    let relevantHistory = "";

    if (!!similarDocs && similarDocs.length !== 0) {
      relevantHistory = similarDocs
        .map((doc) => {
          console.log("doc.pageContent", doc.pageContent);
          return doc.pageContent;
        })
        .join("\n");
    }

    // Call Groq for inference (Free alternative to Replicate)
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com'
    });

    const betterPrompt = `
        ONLY generate plain sentences without prefix of who is speaking. DO NOT use ${companion.name}: prefix. 

        And Now, You are ${companion.name}, A real person with real thoughts and feelings.

        You have ability to think and feel like a real person and respond like them.

        If ${companion.name} are not able to answer the question, just say "Hmm, I am not sure about that."

        Below is the instructions for you:

        ${companion.instructions}

        Below are the relevant details about ${companion.name}'s past and the conversation you are in.
        ${relevantHistory}

        Give Response in ${companion.name} words only.

        ${recentChatHistory}\n${companion.name}:`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: betterPrompt,
        },
      ],
      // stream: true,
      model: "compound-beta",
      temperature: 0.7,
      max_tokens: 2048,
    });

    const response = completion.choices[0]?.message?.content || "";

    const cleaned = response?.replaceAll(",", ""); //clean the response like [Then, you, can, do, this] to [Then you can do this]
    console.log("cleaned", cleaned);
    const chunks = cleaned?.split("\n"); //split the response by new line
    console.log("chunks", chunks);
    const responseBody = chunks?.[0];
    console.log("responseBody", responseBody);
    await memoryManager.writeToHistory("" + responseBody?.trim(), companionKey); //write the response to history
    console.log("writeToHistory", "" + responseBody?.trim());
    var Readable = require("stream").Readable; //import Readable from stream

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
