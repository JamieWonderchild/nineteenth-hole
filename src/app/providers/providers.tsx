"use client";

import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "./convex-client-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
      <ConvexClientProvider>
        {children}
      </ConvexClientProvider>
    </ThemeProvider>
  );
}