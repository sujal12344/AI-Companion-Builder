import { auth } from "@clerk/nextjs/server";
import prismadb from "@/lib/prismadb";
import { redirect } from "next/navigation";
import { ChatClient } from "./components/client";

interface ChatIdProps {
  params: Promise<{
    chatId: string;
  }>;
}

const ChatIdPage = async ({ params }: ChatIdProps) => {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { chatId } = await params;

  const companion = await prismadb.companion.findUnique({
    where: {
      id: chatId,
    },
    include: {
      messages: {
        orderBy: {
          created: "asc",
        },
        where: {
          userId,
        },
      },
      sources: {
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
        },
      },
      documents: {
        select: {
          id: true,
          title: true,
          sourceType: true,
          chunkCount: true,
          processingStatus: true,
        },
      },
      _count: {
        select: {
          messages: true,
          sources: true,
          documents: true,
        },
      },
    },
  });
  if (!companion) {
    redirect("/");
  }
  return <ChatClient companion={companion} />;
};
export default ChatIdPage;
