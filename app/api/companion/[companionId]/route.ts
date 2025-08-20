import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { MemoryManager } from "@/lib/memory";
import { contextTypeArray } from "@/app/constants/contextType";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user || !user.id || !user.firstName) {
      return NextResponse.json({ error: "Please login or signup before creating context" }, { status: 401 });
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
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
    if (contextsJson) {
      const contexts = JSON.parse(contextsJson);
      const memoryManager = await MemoryManager.getInstance();

      for (let i = 0; i < contexts.length; i++) {
        const context = contexts[i];
        let contextData: any = {
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
                // Save file
                const companionsDir = path.join(process.cwd(), "context", companion.name);
                await mkdir(companionsDir, { recursive: true });

                const fileExtension = context.type.toLowerCase();
                const fileName = `${context.title.replace(/[^a-zA-Z0-9]/g, "_")}.${fileExtension}`;
                const filePath = path.join(companionsDir, fileName);

                const bytes = await file.arrayBuffer();
                await writeFile(filePath, new Uint8Array(bytes));

                contextData.fileName = fileName;
                contextData.filePath = filePath;
                contextData.fileType = fileExtension;

                // Process document with RAG
                await memoryManager.seedCompanionKnowledgeFromDocument(
                  companion.id,
                  filePath,
                  fileExtension
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
      const textContexts = contexts.filter(
        (ctx: any) => ctx.type === "TEXT" && ctx.content
      );
      if (textContexts.length > 0) {
        await memoryManager.seedCompanionKnowledgeFromText(
          companion.id,
          textContexts.map((ctx: any) => ({
            title: ctx.title,
            content: ctx.content,
          }))
        );
      }

      // Process link contexts with RAG
      const linkContexts = contexts.filter(
        (ctx: any) => ctx.type === "LINK" && ctx.url
      );
      if (linkContexts.length > 0) {
        await memoryManager.seedCompanionKnowledgeFromLinks(
          companion.id,
          linkContexts.map((ctx: any) => ({ title: ctx.title, url: ctx.url }))
        );
      }
    }

    return NextResponse.json(companion);
  } catch (error) {
    console.error("[COMPANION_POST]", error);
    return NextResponse.json("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ companionId: string }> }
) {
  try {
    const user = await currentUser();
    if (!user || !user.id || !user.firstName) {
      return NextResponse.json("Please login", { status: 401 });
    }

    const { companionId } = await params;
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

    // Check if user owns this companion
    const existingCompanion = await prismadb.companion.findUnique({
      where: { id: companionId },
    });

    if (!existingCompanion || existingCompanion.userId !== user.id) {
      return NextResponse.json("Companion already exist", { status: 401 });
    }

    // Update companion
    const companion = await prismadb.companion.update({
      where: { id: companionId },
      data: {
        categoryId,
        img,
        name,
        description,
        instructions,
        seed,
      },
    });

    // Delete existing contexts
    await prismadb.companionContext.deleteMany({
      where: { companionId },
    });

    // Process new contexts if provided
    if (contextsJson) {
      const contexts = JSON.parse(contextsJson);
      const memoryManager = await MemoryManager.getInstance();

      // Clear existing embeddings for this companion
      await memoryManager.clearCompanionEmbeddings(companionId);

      for (let i = 0; i < contexts.length; i++) {
        const context = contexts[i];
        let contextData: any = {
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
                // Save file
                const companionsDir = path.join(process.cwd(), "companions");
                await mkdir(companionsDir, { recursive: true });

                const fileExtension = context.type.toLowerCase();
                const fileName = `${companion.id}_${context.title.replace(
                  /[^a-zA-Z0-9]/g,
                  "_"
                )}.${fileExtension}`;
                const filePath = path.join(companionsDir, fileName);

                const bytes = await file.arrayBuffer();
                await writeFile(filePath, new Uint8Array(bytes));

                contextData.fileName = fileName;
                contextData.filePath = filePath;
                contextData.fileType = fileExtension;

                // Process document with RAG
                await memoryManager.seedCompanionKnowledgeFromDocument(
                  companion.id,
                  filePath,
                  fileExtension
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
      const textContexts = contexts.filter(
        (ctx: any) => ctx.type === "TEXT" && ctx.content
      );
      if (textContexts.length > 0) {
        await memoryManager.seedCompanionKnowledgeFromText(
          companion.id,
          textContexts.map((ctx: any) => ({
            title: ctx.title,
            content: ctx.content,
          }))
        );
      }

      // Process link contexts with RAG
      const linkContexts = contexts.filter(
        (ctx: any) => ctx.type === "LINK" && ctx.url
      );
      if (linkContexts.length > 0) {
        await memoryManager.seedCompanionKnowledgeFromLinks(
          companion.id,
          linkContexts.map((ctx: any) => ({ title: ctx.title, url: ctx.url }))
        );
      }
    }

    return NextResponse.json(companion);
  } catch (error) {
    console.error("[COMPANION_PATCH]", error);
    return NextResponse.json("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ companionId: string }> }
) {
  try {
    const user = await currentUser();
    if (!user || !user.id || !user.firstName) {
      return NextResponse.json("Please login", { status: 401 });
    }

    const { companionId } = await params;

    // Check if user owns this companion
    const existingCompanion = await prismadb.companion.findUnique({
      where: { id: companionId },
    });

    if (!existingCompanion) {
      return NextResponse.json({ error: "Companion not found" }, { status: 404 });
    }

    if (existingCompanion.userId !== user.id) {
      return NextResponse.json({ error: "You haven't owned this companion" }, { status: 401 });
    }

    // Delete companion
    await prismadb.companion.delete({
      where: { id: companionId },
    });

    return NextResponse.json("Success");
  } catch (error) {
    console.error("[COMPANION_DELETE]", error);
    return NextResponse.json("Internal Error", { status: 500 });
  }
}