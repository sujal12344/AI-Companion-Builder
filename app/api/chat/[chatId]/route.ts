import { StreamingTextResponse } from "ai";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

import prismadb from "@/lib/prismadb";
import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rateLimit";
import Groq from "groq-sdk";
import { Companion } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { prompt: userQuery } = await request.json() as { prompt: string };
    const user = await currentUser();

    // Validate user and query
    if (!user?.firstName || !user?.id || !userQuery?.trim()) {
      return new NextResponse("Unauthorized or empty query", { status: 401 });
    }
    const { chatId } = await params;

    // Rate limiting
    const identifier = `chat-${chatId}-${user.id}`;
    const { success } = await rateLimit(identifier);
    if (!success) {
      return new NextResponse("Rate limit exceeded", { status: 429 });
    }


    // Get companion and save user message
    const companion = await prismadb.companion.update({
      where: { id: chatId },
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

    // Initialize memory manager and chat history
    const memoryManager = await MemoryManager.getInstance();
    const companionKey = {
      companionName: companion.id,
      userId: user.id,
      modelName: "groq-llama3",
    };

    // Seed initial chat history if empty
    const chatHistory = await memoryManager.readLatestHistory(companionKey);
    if (!chatHistory) {
      await memoryManager.seedChatHistory(companion.seed, "\n\n", companionKey);
    }

    // Load companion's PDF knowledge (if exists)
    await loadCompanionPDF(memoryManager, companion);

    // Save user query to chat history
    await memoryManager.writeToHistory(`User: ${userQuery}\n`, companionKey);

    // Get recent chat history and relevant context from PDF
    const recentChatHistory = await memoryManager.readLatestHistory(companionKey);
    const relevantContext = await getRelevantContext(memoryManager, userQuery, companion.id);

    // Generate AI response using Groq
    const aiResponse = await generateAIResponse(companion, relevantContext, recentChatHistory);

    // Save AI response and return stream
    if (aiResponse?.trim()) {
      // Save to chat history
      await memoryManager.writeToHistory(`${companion.name}: ${aiResponse.trim()}\n`, companionKey);

      // Save to database
      await prismadb.companion.update({
        where: { id: chatId },
        data: {
          messages: {
            create: {
              content: aiResponse.trim(),
              role: "system",
              userId: user.id,
            },
          },
        },
      });
    }

    // Create readable stream for response
    const responseText = aiResponse || "I'm not sure how to respond to that.";

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(responseText));
        controller.close();
      },
    });

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("[CHAT_POST]", error);
    return new NextResponse(`Internal Server Error: ${error}`, { status: 500 });
  }
}

// Helper function to load companion PDF
async function loadCompanionPDF(memoryManager: MemoryManager, companion: Companion) {
  try {
    const pdfFileName = companion.name.replaceAll(" ", "_") + ".pdf";
    const pdfPath = path.join(process.cwd(), 'companions', pdfFileName);

    if (fs.existsSync(pdfPath)) {
      await memoryManager.seedCompanionKnowledgeFromPDF(companion.id, pdfPath);
    } else {
      console.log(`PDF not found: ${pdfFileName}`);
    }
  } catch (error) {
    console.error("Error loading companion PDF:", error);
  }
}

// Helper function to get relevant context from PDF
async function getRelevantContext(memoryManager: MemoryManager, userQuery: string, companionId: string) {
  try {
    const similarDocs = await memoryManager.vectorSearch(userQuery, companionId);

    if (similarDocs?.length > 0) {
      return similarDocs
        .map(doc => doc.pageContent)
        .join("\n");
    }

    return "";
  } catch (error) {
    console.error("Error getting relevant context:", error);
    return "";
  }
}

// Helper function to generate AI response
async function generateAIResponse(companion: any, relevantContext: string, recentChatHistory: string) {
  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const prompt = `
    You are ${companion.name}. Respond naturally without using your name as a prefix.

    Instructions: ${companion.instructions}

    Relevant context about you: ${relevantContext}

    Recent conversation: ${recentChatHistory}

    Respond as ${companion.name} would, using the context provided.
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-8b-8192",
      temperature: 0.7,
      max_tokens: 2048,
    });

    return completion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "I'm having trouble responding right now. Please try again.";
  }
}
