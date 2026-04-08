"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { AuthLoading, Authenticated, ConvexReactClient, Unauthenticated } from "convex/react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const isPublic =
    pathname === "/" ||
    PUBLIC_PREFIXES.some(p => p !== "/" && pathname.startsWith(p)) ||
    // Club pool pages are public (read-only leaderboard)
    /^\/[^/]+\/[^/]+$/.test(pathname) ||
    /^\/[^/]+\/[^/]+\/enter/.test(pathname);

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk useAuth={useAuth} client={convex}>
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
