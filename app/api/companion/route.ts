import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { MemoryManager } from "@/lib/memory";
import { ContextItem } from "@/components/ContextUpload";
import { ContextType } from "@prisma/client";
import { contextTypeArray } from "@/app/constants/contextType";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user || !user.id || !user.firstName) {
      return NextResponse.json("Please login or signup before creting companion", { status: 401 });
    }

    const formData = await req.formData();

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const instructions = formData.get("instructions") as string;
    const seed = formData.get("seed") as string;
    const img = formData.get("img") as string;
    const categoryId = formData.get("categoryId") as string;
    const contextsJson = formData.get("contexts") as string;

    if (
      !name ||
      !description ||
      !instructions ||
      !seed ||
      !img ||
      !categoryId
    ) {
      return NextResponse.json("Missing required fields", { status: 400 });
    }

    // Parse contexts if provided
    let parsedContexts: ContextItem[] = [];
    if (contextsJson) {
      try {
        parsedContexts = JSON.parse(contextsJson);
      } catch (error) {
        console.error("Failed to parse contexts:", error);
        return NextResponse.json("Invalid contexts format", { status: 400 });
      }
    }

    // Create companion
    const companion = await prismadb.companion.create({
      data: {
        categoryId,
        userId: user.id,
        userName: user.firstName,
        img,
        name,
        description,
        instructions,
        seed,
      },
    });

    // Process contexts if provided
    if (parsedContexts.length > 0) {
      const memoryManager = await MemoryManager.getInstance();

      // Create contexts in database and process files
      for (let i = 0; i < parsedContexts.length; i++) {
        const context = parsedContexts[i];
        let contextData: {
          companionId: string;
          type: ContextType;
          title: string;
          content?: string;
          url?: string;
          fileName?: string;
          filePath?: string;
        } = {
          companionId: companion.id,
          type: context.type,
          title: context.title,
        };

        switch (context.type) {
          case "TEXT":
            contextData.content = context.content;
            break;

          case "LINK":
            contextData.url = context.url;
            break;

          default:
            if (contextTypeArray.includes(context.type)) {
              const file = formData.get(`file_${i}`) as File;
              if (file) {
                const contextDir = path.join(process.cwd(), "context", companion.name.replaceAll(" ", "-"));
                await mkdir(contextDir, { recursive: true });

                const fileExtension = context.type.toLowerCase();
                const sanitizedTitle = context.title.replace(
                  /[^a-zA-Z0-9]/g,
                  "_"
                );
                const fileName = `${sanitizedTitle}.${fileExtension}`;
                const filePath = path.join(contextDir, fileName);

                const bytes = await file.arrayBuffer();
                await writeFile(filePath, new Uint8Array(bytes));
                console.log(`\n 📁 Saved file: ${filePath}\n`);

                contextData.fileName = fileName;
                contextData.filePath = filePath;

                // Immediately embed this document
                await memoryManager.seedCompanionKnowledgeFromDocument(
                  companion.id,
                  companion.name,
                  filePath,
                  context.type
                );
              }
            }
            break;
        }

        // Save context to database
        await prismadb.companionContext.create({
          data: contextData,
        });
      }

      // Process text contexts with RAG
      const textContexts = parsedContexts.filter(
        (ctx) => ctx.type === "TEXT" && ctx.content
      );
      if (textContexts.length > 0) {
        await memoryManager.seedCompanionKnowledgeFromText(
          companion.id, companion.name,
          textContexts.map((ctx) => ({
            title: ctx.title,
            content: ctx.content!,
          }))
        );
      }

      // Process link contexts with RAG
      const linkContexts = parsedContexts.filter(
        (ctx) => ctx.type === "LINK" && ctx.url
      );
      if (linkContexts.length > 0) {
        await memoryManager.seedCompanionKnowledgeFromLinks(
          companion.id, companion.name,
          linkContexts.map((ctx) => ({ title: ctx.title, url: ctx.url! }))
        );
      }
    }

    return NextResponse.json(companion);
  } catch (error) {
    console.error("[COMPANION_POST]", error);
    return NextResponse.json("Internal Error", { status: 500 });
  }
}
