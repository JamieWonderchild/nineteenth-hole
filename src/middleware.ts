import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/terms",
  "/privacy",
  "/api/stripe/webhook",
  // Platform tour pools — public leaderboard
  "/pools",
  "/pools/(.*)",
  // Club pool pages — public leaderboard & entry
  "/:clubSlug/:competitionSlug",
  "/:clubSlug/:competitionSlug/enter",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
