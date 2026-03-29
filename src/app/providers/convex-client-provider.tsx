"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { AuthLoading, Authenticated, ConvexReactClient, Unauthenticated } from "convex/react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const convex = new ConvexReactClient(convexUrl);

// Suppress harmless WebSocket connection errors in Safari
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    // Suppress Safari WebSocket connection errors that don't affect functionality
    const message = args[0]?.toString() || '';
    if (
      message.includes('WebSocket connection') &&
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    ) {
      // WebSocket errors in Safari are often false positives - suppress them
      return;
    }
    originalError.apply(console, args);
  };
}

function LoadingState() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

function UnauthenticatedRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.push("/sign-in");
  }, [router]);
  return <LoadingState />;
}

export const ConvexClientProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Public routes that don't require authentication
  const isPublicRoute =
    pathname === "/" ||
    pathname?.startsWith("/companion") ||
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up") ||
    pathname === "/terms" ||
    pathname === "/privacy";

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk
        useAuth={useAuth}
        client={convex}
      >
        {isPublicRoute ? (
          children
        ) : (
          <>
            <Authenticated>
              {children}
            </Authenticated>
            <Unauthenticated>
              <UnauthenticatedRedirect />
            </Unauthenticated>
            <AuthLoading>
              <LoadingState />
            </AuthLoading>
          </>
        )}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
};
