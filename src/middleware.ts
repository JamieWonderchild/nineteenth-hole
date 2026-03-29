import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",                           // Landing page (public)
  "/companion/(.*)",           // Owner companion pages (public)
  "/api/companion/(.*)",       // Companion API (public)
  "/api/corti/extract-billing", // Billing extraction (called from Convex)
  "/api/stripe/webhook",       // Stripe webhooks
  "/api/clerk/webhook",        // Clerk webhooks
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/terms",                    // Terms of Service (public)
  "/privacy",                  // Privacy Policy (public)
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
