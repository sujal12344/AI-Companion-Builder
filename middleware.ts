import { authMiddleware } from "@clerk/nextjs"

export default authMiddleware({
  publicRoutes: ['/', '/api(.*)', '/sign-in(.*)', '/sign-up(.*)'],
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}