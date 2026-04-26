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
  // Club invite page & competition pages — public
  "/:clubSlug",
  "/:clubSlug/:competitionSlug",
  "/:clubSlug/:competitionSlug/enter",
  // Kiosk POS — accessed by staff on dedicated devices, no login required
  "/kiosk/pos",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
