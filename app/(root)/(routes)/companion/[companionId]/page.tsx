import prismadb from "@/lib/prismadb";
import { CompanionForm } from "./components/CompanionForm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { checkSubscription } from "@/lib/subscription";
import { toast } from "@/components/ui/use-toast";

interface companionPageProps {
  params: Promise<{
    companionId: string;
  }>;
}

const CompanionPage = async ({ params }: companionPageProps) => {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  // PAYMENT TEMPORARILY DISABLED - Everyone has Pro access
  const isPro = true; // Set to true to give everyone Pro features
  
  // const isPro = await checkSubscription();
  // if (!isPro) {
  //   toast({ description: "Please upgrade to create companion" });
  //   redirect("/settings");
  // }

  const { companionId } = await params;

  const companion = await prismadb.companion.findUnique({
    where: {
      id: companionId,
      userId,
    },
  });

  let initialSources: any[] = [];
  if (companion) {
    const sources = await prismadb.source.findMany({
      where: { companionId },
      include: {
        _count: {
          select: { documents: true },
        },
        documents: {
          select: {
            id: true,
            externalId: true,
            title: true,
            sourceUrl: true,
            sourceType: true,
            author: true,
            publishedAt: true,
            processingStatus: true,
            chunkCount: true,
            errorMessage: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    initialSources = sources.map((source) => {
      const completedCount = source.documents.filter(
        (d) => d.processingStatus === "COMPLETED"
      ).length;
      const totalChunks = source.documents.reduce(
        (acc, d) => acc + (d.chunkCount || 0),
        0
      );

      let status = source.status;
      if (
        (status === "INGESTING" || status === "DISCOVERING") &&
        completedCount > 0
      ) {
        const isStuck =
          Date.now() - new Date(source.updatedAt).getTime() > 5 * 60 * 1000;
        if (isStuck) {
          status = (completedCount >= source.totalItems ? "READY" : "PARTIAL") as any;
        }
      }

      if (status === "READY" && source.totalItems > 0 && completedCount < source.totalItems) {
        status = "PARTIAL" as any;
      }

      const formattedDocuments = source.documents.map((doc) => {
        const meta = (doc.metadata as any) || {};
        const isYoutube = doc.sourceType.startsWith("YOUTUBE");
        const thumbnail =
          meta.thumbnail ||
          (isYoutube && doc.externalId
            ? `https://img.youtube.com/vi/${doc.externalId}/hqdefault.jpg`
            : null);

        return {
          id: doc.id,
          externalId: doc.externalId,
          title: doc.title,
          sourceUrl: doc.sourceUrl,
          sourceType: doc.sourceType,
          author: doc.author,
          publishedAt: doc.publishedAt,
          processingStatus: doc.processingStatus,
          chunkCount: doc.chunkCount,
          errorMessage: doc.errorMessage,
          thumbnail,
          duration: meta.duration || null,
          hasTranscript: meta.hasTranscript || false,
          originalLanguage: meta.originalLanguage || "en",
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          processingDurationMs: meta.processingDurationMs || null,
          processedAt: meta.processedAt || doc.createdAt,
        };
      });

      return {
        id: source.id,
        type: source.type,
        title: source.title,
        originalUrl: source.originalUrl,
        canonicalUrl: source.canonicalUrl,
        status,
        totalItems: source.totalItems,
        processedItems: completedCount,
        failedItems: source.failedItems,
        totalChunks,
        lastSyncedAt: source.lastSyncedAt,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
        configuration: source.configuration,
        documents: formattedDocuments,
      };
    });
  }

  // Serialize data properly to avoid hydration errors
  const serializedCompanion = companion ? JSON.parse(JSON.stringify(companion)) : null;
  const serializedSources = JSON.parse(JSON.stringify(initialSources));

  return (
    <CompanionForm
      initialData={serializedCompanion}
      initialSources={serializedSources}
    />
  );
};

export default CompanionPage;
