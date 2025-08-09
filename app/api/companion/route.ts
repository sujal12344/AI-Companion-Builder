import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { MemoryManager } from "@/lib/memory";
import { ContextItem } from "@/components/ContextUpload";
import { ContextType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user || !user.id || !user.firstName) {
      return new NextResponse("Unauthorized", { status: 401 });
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
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Parse contexts if provided
    let parsedContexts: ContextItem[] = [];
    if (contextsJson) {
      try {
        parsedContexts = JSON.parse(contextsJson);
      } catch (error) {
        console.error("Failed to parse contexts:", error);
        return new NextResponse("Invalid contexts format", { status: 400 });
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
      for (const context of parsedContexts) {
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

        if (context.type === "TEXT") {
          contextData.content = context.content;
        } else if (context.type === "LINK") {
          contextData.url = context.url;
        } else if (context.type === "PDF") {
          const pdfFile = formData.get(`pdf_${context.title}`) as File;
          if (pdfFile) {
            // Save PDF file
            const companionsDir = path.join(process.cwd(), "companions");
            await mkdir(companionsDir, { recursive: true });

            const fileName = `${companion.id}_${context.title.replace(
              /[^a-zA-Z0-9]/g,
              "_"
            )}.pdf`;
            const filePath = path.join(companionsDir, fileName);

            const bytes = await pdfFile.arrayBuffer();
            await writeFile(filePath, new Uint8Array(bytes));

            contextData.fileName = fileName;
            contextData.filePath = filePath;
          }
        } else if (context.type === "JSON") {
          const jsonFile = formData.get(`json_${context.title}`) as File;
          if (jsonFile) {
            // Save JSON file
            const companionsDir = path.join(process.cwd(), "companions");
            await mkdir(companionsDir, { recursive: true });

            const fileName = `${companion.id}_${context.title.replace(
              /[^a-zA-Z0-9]/g,
              "_"
            )}.json`;
            const filePath = path.join(companionsDir, fileName);

            const bytes = await jsonFile.arrayBuffer();
            await writeFile(filePath, new Uint8Array(bytes));

            contextData.fileName = fileName;
            contextData.filePath = filePath;
          }
        } else if (context.type === "CSV") {
          const csvFile = formData.get(`csv_${context.title}`) as File;
          if (csvFile) {
            // Save CSV file
            const companionsDir = path.join(process.cwd(), "companions");
            await mkdir(companionsDir, { recursive: true });

            const fileName = `${companion.id}_${context.title.replace(
              /[^a-zA-Z0-9]/g,
              "_"
            )}.csv`;
            const filePath = path.join(companionsDir, fileName);

            const bytes = await csvFile.arrayBuffer();
            await writeFile(filePath, new Uint8Array(bytes));

            contextData.fileName = fileName;
            contextData.filePath = filePath;
          }
        } else if (context.type === "DOCX") {
          const docxFile = formData.get(`docx_${context.title}`) as File;
          if (docxFile) {
            // Save DOCX file
            const companionsDir = path.join(process.cwd(), "companions");
            await mkdir(companionsDir, { recursive: true });

            const fileName = `${companion.id}_${context.title.replace(
              /[^a-zA-Z0-9]/g,
              "_"
            )}.docx`;
            const filePath = path.join(companionsDir, fileName);

            const bytes = await docxFile.arrayBuffer();
            await writeFile(filePath, new Uint8Array(bytes));

            contextData.fileName = fileName;
            contextData.filePath = filePath;
          }
        } else if (context.type === "TXT") {
          const txtFile = formData.get(`txt_${context.title}`) as File;
          if (txtFile) {
            // Save TXT file
            const companionsDir = path.join(process.cwd(), "companions");
            await mkdir(companionsDir, { recursive: true });

            const fileName = `${companion.id}_${context.title.replace(
              /[^a-zA-Z0-9]/g,
              "_"
            )}.txt`;
            const filePath = path.join(companionsDir, fileName);

            const bytes = await txtFile.arrayBuffer();
            await writeFile(filePath, new Uint8Array(bytes));

            contextData.fileName = fileName;
            contextData.filePath = filePath;
          }
        }

        // Save context to database
        await prismadb.companionContext.create({
          data: contextData,
        });
      }

      // Process contexts with RAG (outside the loop)
      // Process text contexts
      const textContexts = parsedContexts.filter(
        (ctx) => ctx.type === "TEXT" && ctx.content
      );
      if (textContexts.length > 0) {
        await memoryManager.seedCompanionKnowledgeFromText(
          companion.id,
          textContexts.map((ctx) => ({
            title: ctx.title,
            content: ctx.content!,
          }))
        );
      }

      // Process link contexts
      const linkContexts = parsedContexts.filter(
        (ctx) => ctx.type === "LINK" && ctx.url
      );
      if (linkContexts.length > 0) {
        await memoryManager.seedCompanionKnowledgeFromLinks(
          companion.id,
          linkContexts.map((ctx) => ({ title: ctx.title, url: ctx.url! }))
        );
      }

      // Process document contexts
      const documentContexts = parsedContexts.filter((ctx) =>
        ["PDF", "DOCX", "TXT", "CSV", "JSON"].includes(ctx.type)
      );
      for (const context of documentContexts) {
        if (context.file) {
          const fileType = context.type;
          await memoryManager.seedCompanionKnowledgeFromDocument(
            companion.id,
            context.file.name,
            fileType
          );
        }
      }
    }

    return NextResponse.json(companion);
  } catch (error) {
    console.error("[COMPANION_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
