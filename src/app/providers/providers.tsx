"use client";

import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "./convex-client-provider";
import { ClubProvider } from "@/lib/club-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <ConvexClientProvider>
        <ClubProvider>
          {children}
        </ClubProvider>
      </ConvexClientProvider>
    </ThemeProvider>
  );
}