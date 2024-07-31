import { authMiddleware, clerkMiddleware } from "@clerk/nextjs/server";

// export default clerkMiddleware();
export default authMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    // "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/((?!.*\\..*|_next).*)",
    "/", // Always run for the root route
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
