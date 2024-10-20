import { auth } from "@clerk/nextjs/server";
import prismadb from "./prismadb";

const DAY_IN_MS = 24 * 60 * 60 * 1000; //86_400_000

export const checkSubscription = async () => {
  const { userId } = auth();
  // console.log("userId", userId);

  if (!userId) {
    return false;
  }
  const userSubscription = await prismadb.userSubscription.findUnique({
    where: {
      userId,
    },
    select: {
      stripeCurrentPeriodEnd: true,
      stripeCustomerId: true,
      stripePriceId: true,
      stripeSubscriptionId: true,
    },
  });
  // console.log("userSubscription", userSubscription);
  if (!userSubscription) {
    return false;
  }

  const isValid =
    userSubscription.stripePriceId &&
    userSubscription.stripeCurrentPeriodEnd?.getTime()! + DAY_IN_MS >
      Date.now();

  console.log("isValid", isValid);

  return !!isValid;
};
