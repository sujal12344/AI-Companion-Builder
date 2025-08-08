import prismadb from "@/lib/prismadb";
import { CompanionForm } from "./components/CompanionForm";
import { auth, redirectToSignIn } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { checkSubscription } from "@/lib/subscription";

interface companionPageProps {
  params: Promise<{
    companionId: string;
  }>
}

const CompanionPage = async ({ params }: companionPageProps) => {
  const { userId } = auth();
  if (!userId) {
    return redirectToSignIn;
  }

  const isPro = await checkSubscription();
  if (!isPro) {
    redirect("/settings");
  }

  const { companionId } = await params;

  const companion = await prismadb.companion.findUnique({
    where: {
      id: companionId,
      userId,
    },
  });

  const categories = await prismadb.category.findMany();

  return <CompanionForm initialData={companion} categories={categories} />;
};

export default CompanionPage;
