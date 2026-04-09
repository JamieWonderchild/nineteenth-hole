"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { AuthLoading, Authenticated, ConvexReactClient, Unauthenticated } from "convex/react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

let _convex: ConvexReactClient | null = null;
function getConvex() {
  if (!_convex) _convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  return _convex;
}

function LoadingState() {
  return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
    </div>
  );
}

function UnauthenticatedRedirect() {
  const router = useRouter();
  useEffect(() => { router.push("/sign-in"); }, [router]);
  return <LoadingState />;
}

// Routes accessible without auth
const PUBLIC_PREFIXES = ["/", "/sign-in", "/sign-up", "/terms", "/privacy"];
// App routes that look like /:slug but require auth
const AUTH_ONLY_PATHS = new Set(["/manage", "/pools", "/games", "/onboarding", "/home"]);

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const isPublic =
    pathname === "/" ||
    PUBLIC_PREFIXES.some(p => p !== "/" && pathname.startsWith(p)) ||
    // Club landing pages are public — /finchley-golf-club etc.
    (/^\/[^/]+$/.test(pathname) && !AUTH_ONLY_PATHS.has(pathname)) ||
    // Club competition pages are public (read-only leaderboard)
    /^\/[^/]+\/[^/]+$/.test(pathname) ||
    /^\/[^/]+\/[^/]+\/enter/.test(pathname);

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk useAuth={useAuth} client={getConvex()}>
        {isPublic ? (
          children
        ) : (
          <>
            <Authenticated>{children}</Authenticated>
            <Unauthenticated><UnauthenticatedRedirect /></Unauthenticated>
            <AuthLoading><LoadingState /></AuthLoading>
          </>
        )}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
