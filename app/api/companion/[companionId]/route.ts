import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { MemoryManager } from "@/lib/memory";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ companionId: string }> }
) {
  try {
    const user = await currentUser();
    if (!user || !user.id || !user.firstName) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { companionId } = await params;
    const formData = await req.formData();

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const instructions = formData.get('instructions') as string;
    const seed = formData.get('seed') as string;
    const src = formData.get('src') as string;
    const categoryId = formData.get('categoryId') as string;
    const contextsJson = formData.get('contexts') as string;

    if (!name || !description || !instructions || !seed || !src || !categoryId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Check if user owns this companion
    const existingCompanion = await prismadb.companion.findUnique({
      where: { id: companionId },
    });

    if (!existingCompanion || existingCompanion.userId !== user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Update companion
    const companion = await prismadb.companion.update({
      where: { id: companionId },
      data: {
        categoryId,
        src,
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

        if (context.type === 'TEXT') {
          contextData.content = context.content;
        } else if (context.type === 'LINK') {
          contextData.url = context.url;
        } else if (context.type === 'PDF') {
          const pdfFile = formData.get(`pdf_${i}`) as File;
          if (pdfFile) {
            // Save PDF file
            const companionsDir = path.join(process.cwd(), 'companions');
            await mkdir(companionsDir, { recursive: true });

            const fileName = `${companion.id}_${context.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            const filePath = path.join(companionsDir, fileName);

            const bytes = await pdfFile.arrayBuffer();
            await writeFile(filePath, new Uint8Array(bytes));

            contextData.fileName = fileName;
            contextData.filePath = filePath;

            // Process PDF with RAG
            await memoryManager.seedCompanionKnowledgeFromPDF(companion.id, filePath);
          }
        }

        // Save context to database
        await prismadb.companionContext.create({
          data: contextData,
        });
      }

      // Process text contexts with RAG
      const textContexts = contexts.filter((ctx: any) => ctx.type === 'TEXT' && ctx.content);
      if (textContexts.length > 0) {
        await memoryManager.seedCompanionKnowledgeFromText(
          companion.id,
          textContexts.map((ctx: any) => ({ title: ctx.title, content: ctx.content }))
        );
      }

      // Process link contexts with RAG
      const linkContexts = contexts.filter((ctx: any) => ctx.type === 'LINK' && ctx.url);
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
    return new NextResponse("Internal Error", { status: 500 });
  }
}