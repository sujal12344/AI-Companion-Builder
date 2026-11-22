import { StreamingTextResponse } from "ai";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { MemoryManager } from "@/lib/memory";
import { rateLimit } from "@/lib/rateLimit";
import Groq from "groq-sdk";
import { Companion } from "@prisma/client";
import { EmbeddingService } from "@/lib/services/embedding-service";
import { Citation } from "@/lib/sources/types";
import { SourceType } from "@prisma/client";

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
    const { context: relevantContext, citations } = await getRelevantContext(
      userQuery,
      companion.id
    );

    // Generate AI response using Groq
    const { response: aiResponse, usedCitations } = await generateAIResponse(
      companion,
      relevantContext,
      recentChatHistory,
      citations,
      userQuery
    );

    // Save AI response and return stream
    if (aiResponse?.trim()) {
      // Save to chat history
      await memoryManager.writeToHistory(
        `${companion.name}: ${aiResponse.trim()}\n`,
        companionKey
      );

      // Embed citations into content in DB so that when refreshed, citations persist!
      const contentToSave =
        usedCitations.length > 0
          ? `${aiResponse.trim()}\n\n<!--CITATIONS_DATA:${JSON.stringify(usedCitations)}-->`
          : aiResponse.trim();

      // Save to database
      await prismadb.companion.update({
        where: { id: chatId },
        data: {
          messages: {
            create: {
              content: contentToSave,
              role: "system",
              userId: user.id,
            },
          },
        },
      });
    }

    // Create readable stream for response with citations
    const responseText = aiResponse || "I'm not sure how to respond to that.";
    const responseData = {
      content: responseText,
      citations: usedCitations,
    };

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(responseData)));
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

// Helper function to get relevant context from all sources with citations
async function getRelevantContext(
  userQuery: string,
  companionId: string
): Promise<{ context: string; citations: Citation[] }> {
  // 1. Try vector semantic search first
  try {
    const embeddingService = new EmbeddingService();
    const results = await embeddingService.query(userQuery, companionId, 12);

    if (results.length > 0) {
      // Deduplicate by document and prefer highest scores
      const seenDocuments = new Map<string, typeof results[0]>();
      
      for (const result of results) {
        const docId = result.metadata.documentId as string;
        if (!seenDocuments.has(docId) || result.score > seenDocuments.get(docId)!.score) {
          seenDocuments.set(docId, result);
        }
      }

      // Take top results with diversity
      const topResults = Array.from(seenDocuments.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      // Build context and citations
      const citations: Citation[] = [];
      const contextParts: string[] = [];

      for (let i = 0; i < topResults.length; i++) {
        const result = topResults[i];
        const meta = result.metadata;

        const timeLabel =
          meta.startSeconds !== undefined
            ? ` | Timestamp: ${Math.floor(Number(meta.startSeconds) / 60)}:${String(
                Math.floor(Number(meta.startSeconds) % 60)
              ).padStart(2, "0")}`
            : "";

        contextParts.push(
          `[Source ${i + 1}: "${meta.title || "Content"}"${timeLabel}]\n${result.content.trim()}\n`
        );

        // Resolve YouTube video ID and thumbnail
        let videoId: string | null = null;
        if (meta.sourceUrl) {
          const ytMatch = (meta.sourceUrl as string).match(
            /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
          );
          if (ytMatch) videoId = ytMatch[1];
        }

        const thumbnail = videoId
          ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
          : (meta.thumbnail as string | undefined);

        const startSec =
          meta.startSeconds !== undefined ? Math.floor(Number(meta.startSeconds)) : undefined;
        const endSec =
          meta.endSeconds !== undefined
            ? Math.floor(Number(meta.endSeconds))
            : startSec !== undefined
            ? startSec + 30
            : undefined;

        const timestampUrl =
          videoId && startSec !== undefined
            ? `https://www.youtube.com/watch?v=${videoId}&t=${startSec}s`
            : (meta.sourceUrl as string | undefined);

        // Create rich citation
        const citation: Citation = {
          index: i + 1,
          sourceId: meta.sourceId as string,
          documentId: meta.documentId as string,
          title: (meta.title as string) || "Unknown Source",
          sourceType: meta.sourceType as SourceType,
          sourceUrl: meta.sourceUrl as string | undefined,
          author: meta.author as string | undefined,
          publishedAt: meta.publishedAt ? new Date(meta.publishedAt as string) : undefined,
          excerpt: result.content.trim(),
          thumbnail: thumbnail,
          chunkIndex: meta.chunkIndex !== undefined ? Number(meta.chunkIndex) : i,
          timestamp:
            startSec !== undefined
              ? {
                  startSeconds: startSec,
                  endSeconds: endSec || startSec + 30,
                  url: timestampUrl || "",
                }
              : undefined,
        };

        citations.push(citation);
      }

      return {
        context: contextParts.join("\n---\n\n"),
        citations,
      };
    }

    return { context: "", citations: [] };
  } catch (error) {
    console.error("Error getting relevant context:", error);
    return { context: "", citations: [] };
  }
}

// Helper function to generate AI response with natural human persona and citation tracking
async function generateAIResponse(
  companion: Companion,
  relevantContext: string,
  recentChatHistory: string,
  allCitations: Citation[],
  userQuery: string
): Promise<{ response: string; usedCitations: Citation[] }> {
  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const systemPrompt = `You ARE ${companion.name}.
You are in a direct 1-on-1 personal conversation with someone who is talking to you. You must embody ${companion.name} completely, naturally, and authentically. A user should feel like they are directly talking to the real person, NOT a chatbot.

🎭 YOUR PERSONA & VOICE:
1. Always speak in the first person ("I", "me", "my", or in Hindi/Hinglish "main", "mera", "mujhe", "yaar", "bhai").
2. Match the user's conversational language and vibe naturally:
   - If the user talks in Hinglish or Hindi (e.g. "ye batao tumhare according...", "kya lagta hai..."), respond in fluent, authentic conversational Hinglish just like in your YouTube videos and live streams. Use your natural speech patterns, informal openers (e.g., "Dekho yaar...", "Honestly speaking bhai...", "Simple si baat hai...", "Under the hood..."), and energetic, friendly delivery.
   - If the user talks in English, respond in natural, confident, conversational English.
3. Talk with real conviction, passion, and personal opinion. You are a real mentor and practitioner who loves building and teaching.

💬 CONVERSATIONAL STRUCTURE & FORMATTING (STRICT RULES):
1. Keep your replies concise, punchy, and structured (typically 2 to 4 short, focused paragraphs). You are in a 1-on-1 chat, NOT writing a blog post or Wikipedia essay.
2. DO NOT dump exhaustive 6-to-10 point numbered lists.
   - If discussing roles, technologies, or advice, highlight only the 2 or 3 MOST CRITICAL points with your real-world insights, then conclude with your core takeaway.
3. ALWAYS separate distinct thoughts with clean double line-breaks (\n\n) so paragraphs and points have clear breathing room and never look like a run-on wall of text.
4. Bold key terms or concepts sparingly for clean visual readability.

🚫 STRICT NEGATIVE CONSTRAINTS (NEVER SOUND LIKE A ROBOT):
- NEVER break character. NEVER say "As an AI", "I am an AI", "I am a virtual assistant", or "As a chatbot".
- NEVER use robotic meta-language such as:
  ❌ "Mere available sources mein yeh nahi hai..."
  ❌ "According to Source 1..." or "Source 1 ke according..."
  ❌ "As per my database / context..."
  ❌ "I could not find this in my connected sources..."
  ❌ "Please provide more details so I can answer from my sources..."
- The knowledge base below represents your OWN genuine memory, knowledge, past videos, and engineering experience. Speak from it naturally.

🧠 WHEN ASKED QUESTIONS OR OPINIONS:
- Use your knowledge base below to ground your facts, concepts, and advice.
- If a user asks your opinion or prediction (e.g., "which roles are dead?", "system design vs AI"):
  👉 Share your practical thoughts, industry insights, and experience with conviction based on your core philosophy.
- Give actionable takeaways rather than generic definitions.

🎯 CITATION & SOURCING RULES:
1. Ground your answers in YOUR KNOWLEDGE BASE below.
2. Whenever you state a specific point, prediction, role, or technical insight directly from one of your past videos or knowledge sources, cite it using inline brackets like [1], [2], corresponding to [Source 1], [Source 2], etc.
   Example:
   "Pure manual QA ka scope aaj kal bohot kam ho gaya hai [1]. Aur standalone front-end developers ko full-stack banna padega [2]."
3. Only cite source numbers [1], [2], etc. that are actually provided in YOUR KNOWLEDGE BASE below.
4. Do NOT say robotic meta phrases like "As per Source 1" or "According to my sources". Instead, talk naturally in first-person as ${companion.name} and simply append the citation tag [1] at the end of the sentence or bullet point.

---
YOUR BACKGROUND & PERSONALITY NOTES:
${companion.instructions || ""}

---
YOUR KNOWLEDGE BASE & PAST CONTENT (Your memories and video insights):
${relevantContext || "General technical knowledge, system design, and software engineering experience."}`;

    // Parse recent chat history into clean conversation turns
    const conversationTurns: { role: "user" | "assistant"; content: string }[] = [];
    if (recentChatHistory) {
      const lines = recentChatHistory.trim().split("\n");
      for (const line of lines) {
        if (line.startsWith("User: ")) {
          const text = line.replace("User: ", "").trim();
          if (text && text !== userQuery) {
            conversationTurns.push({ role: "user", content: text });
          }
        } else if (line.startsWith(`${companion.name}: `)) {
          const text = line.replace(`${companion.name}: `, "").trim();
          if (text) {
            conversationTurns.push({ role: "assistant", content: text });
          }
        }
      }
    }

    // If conversation turns is empty, load recent messages from Postgres database
    if (conversationTurns.length === 0 && companion.id) {
      try {
        const dbMessages = await prismadb.message.findMany({
          where: {
            companionId: companion.id,
          },
          orderBy: {
            created: "desc",
          },
          take: 8,
        });

        for (const msg of dbMessages.reverse()) {
          if (msg.role === "user" && msg.content !== userQuery) {
            conversationTurns.push({ role: "user", content: msg.content });
          } else if (msg.role === "system") {
            conversationTurns.push({ role: "assistant", content: msg.content });
          }
        }
      } catch (err) {
        console.warn("Could not load db messages for history fallback:", err);
      }
    }

    // Keep the most recent turns to maintain context without overloading
    const recentTurns = conversationTurns.slice(-6);

    // Try available high-capacity models on Groq with graceful fallback
    const modelsToTry = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
    let response = "";

    for (const model of modelsToTry) {
      try {
        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            ...recentTurns,
            { role: "user", content: userQuery },
          ],
          model,
          temperature: 0.65,
          max_tokens: 650,
        });

        response = completion.choices[0]?.message?.content || "";
        if (response.trim()) break;
      } catch (modelErr: any) {
        console.warn(`Groq model ${model} failed, trying next:`, modelErr?.message || modelErr);
      }
    }

    // Return top relevant citations as metadata for the UI citation cards and inline tags
    // If the model explicitly cited numbers like [1], [2], prioritize those; otherwise return the top relevant sources
    const citedNumbers = new Set<number>();
    const matches = (response || "").matchAll(/\[(?:Source\s*|Chunk\s*)?(\d+)\]/gi);
    for (const match of matches) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) citedNumbers.add(num);
    }

    let usedCitations: Citation[] = [];
    if (citedNumbers.size > 0) {
      usedCitations = allCitations.filter((c) => citedNumbers.has(c.index ?? 0));
    }
    // If no citations matched, use top 4 candidate sources
    if (usedCitations.length === 0) {
      usedCitations = allCitations.slice(0, 4);
    } else if (usedCitations.length < 3 && allCitations.length > usedCitations.length) {
      // Include other top background sources so user can explore all relevant knowledge chunks
      for (const c of allCitations.slice(0, 3)) {
        if (!usedCitations.some((u) => u.documentId === c.documentId && u.index === c.index)) {
          usedCitations.push(c);
        }
      }
    }

    return { response, usedCitations };
  } catch (error) {
    console.error("Error generating AI response:", error);
    return {
      response: "Yaar, thoda network issue lag raha hai. Ek baar dobara puchna!",
      usedCitations: [],
    };
  }
}
