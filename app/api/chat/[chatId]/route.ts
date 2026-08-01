import { StreamingTextResponse } from "ai";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
    const { prompt: userQuery } = (await request.json()) as { prompt: string };
    const user = await currentUser();

    // Validate user and query
    if (!user?.firstName || !user?.id || !userQuery?.trim()) {
      return NextResponse.json("Unauthorized or empty query", { status: 401 });
    }
    const { chatId } = await params;

    // Rate limiting
    const identifier = `chat-${chatId}-${user.id}`;
    const { success } = await rateLimit(identifier);
    if (!success) {
      return NextResponse.json("Rate limit exceeded", { status: 429 });
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
      return NextResponse.json("Companion not found", { status: 404 });
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
      await memoryManager.seedChatHistory(
        companion.seed || "",
        "\n\n",
        companionKey
      );
    }

    // Save user query to chat history
    await memoryManager.writeToHistory(`User: ${userQuery}\n`, companionKey);

    // Get recent chat history and relevant context from all sources
    const recentChatHistory = await memoryManager.readLatestHistory(
      companionKey
    );
    const relevantContext = await getRelevantContext(
      memoryManager,
      userQuery,
      companion.id
    );

    // Generate AI response using Groq
    const aiResponse = await generateAIResponse(
      companion,
      relevantContext,
      recentChatHistory
    );

    // Save AI response and return stream
    if (aiResponse?.trim()) {
      // Save to chat history
      await memoryManager.writeToHistory(
        `${companion.name}: ${aiResponse.trim()}\n`,
        companionKey
      );

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
    return NextResponse.json(`Internal Server Error: ${error}`, {
      status: 500,
    });
  }
}

// Helper function to get relevant context from all sources
async function getRelevantContext(
  memoryManager: MemoryManager,
  userQuery: string,
  companionId: string
) {
  try {
    const similarDocs = await memoryManager.vectorSearch(
      userQuery,
      companionId
    );

    if (similarDocs?.length > 0) {
      return similarDocs
        .map((doc) => {
          const source = doc.metadata?.type || "Unknown";
          const title = doc.metadata?.title || "";
          return `[${source}${title ? ` - ${title}` : ""}]: ${doc.pageContent}`;
        })
        .join("\n\n");
    }

    return "";
  } catch (error) {
    console.error("Error getting relevant context:", error);
    return "";
  }
}

// Helper function to generate AI response
async function generateAIResponse(
  companion: Companion,
  relevantContext: string,
  recentChatHistory: string
) {
  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Strict source-based system prompt
    const systemPrompt = `You are an AI companion representing ${companion.name}. Follow these CRITICAL rules:

🔒 SOURCE-BASED RESPONSES ONLY:
- Answer ONLY using information from the SOURCE_CONTEXT provided below
- DO NOT use your general knowledge, training data, or make assumptions
- DO NOT invent ${companion.name}'s opinions, experiences, or statements
- If sources don't contain the answer, clearly state: "Mere available sources mein is question ka answer nahi mila hai."

📚 SOURCE CITATION:
- Always mention which source you're referencing (document name, URL, or title)
- Preserve the exact meaning and context from sources
- If multiple sources support an answer, mention all relevant ones

💬 RESPONSE STYLE:
- Respond naturally as ${companion.name} would speak
- Keep the tone consistent with ${companion.name}'s personality
- Be conversational but stay grounded in provided sources
- You are an unofficial AI companion, not the actual ${companion.name}

⚠️ WHEN NO ANSWER EXISTS:
If the question cannot be answered from sources, respond with:
"Mere available sources mein is topic ke baare mein information nahi hai. Main sirf apne sources se hi answer de sakta hoon. Kya aap kuch aur puchna chahenge jo mere sources mein ho?"

---

INSTRUCTIONS FOR ${companion.name}:
${companion.instructions}

---

SOURCE_CONTEXT (Your Knowledge Base):
${relevantContext || "No specific context available for this query."}

---

RECENT CONVERSATION:
${recentChatHistory}

Remember: You can ONLY answer based on SOURCE_CONTEXT. If unsure, say you don't have that information in your sources.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: recentChatHistory.split('\n').pop() || "" }
      ],
      model: "llama-3.3-70b-versatile", // Updated to current active model
      temperature: 0.5, // Lower temperature for more factual responses
      max_tokens: 2048,
    });

    return completion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "I'm having trouble responding right now. Please try again.";
  }
}
