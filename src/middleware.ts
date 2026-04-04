import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",                           // Landing page (public)
  "/companion/(.*)",           // Owner companion pages (public)
  "/api/companion/(.*)",       // Companion API (public)
  "/api/corti/extract-billing",       // Billing extraction (called from Convex)
  "/api/corti/extract-lab-results",   // Lab extraction (called from Convex)
  "/api/corti/extract-orders",        // Order extraction (called from Convex)
  "/api/corti/triage-result",         // Result triage (called from Convex)
  "/api/corti/build-patient-profile", // Patient profile build (called from Convex)
  "/api/stripe/webhook",       // Stripe webhooks
  "/api/clerk/webhook",        // Clerk webhooks
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/terms",                    // Terms of Service (public)
  "/privacy",                  // Privacy Policy (public)
]);

// Routes that should bypass the org-redirect check
const isOnboardingRoute = createRouteMatcher([
  "/onboarding(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const { userId, orgId } = await auth();

  // Signed in but no active org → send to onboarding
  // (unless already going there or it's a public/API route)
  if (
    userId &&
    !orgId &&
    !isOnboardingRoute(req) &&
    !isPublicRoute(req) &&
    !req.nextUrl.pathname.startsWith("/api/")
  ) {
    const onboardingUrl = new URL("/onboarding", req.url);
    return NextResponse.redirect(onboardingUrl);
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
