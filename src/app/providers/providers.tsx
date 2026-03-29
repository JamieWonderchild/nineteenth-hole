"use client";

import { ThemeProvider } from "next-themes";
import { ConvexClientProvider } from "./convex-client-provider";
import { OrgContextProvider } from "./org-context-provider";
import { NavigationProvider } from "@/contexts/NavigationContext";
// import { MobileToggle } from "@/components/dev/MobileToggle";
import { BannerSystem } from "@/components/banners/BannerSystem";
import { UpgradeDetector } from "@/components/upgrade/UpgradeDetector";
import { FirstLoginDetector } from "@/components/welcome/FirstLoginDetector";
import { MigrationDetector } from "@/components/migration/MigrationDetector";
import { useOrgCtx } from "./org-context-provider";
import { useUser } from "@clerk/nextjs";
import type { Id } from 'convex/_generated/dataModel';

function AppFeatures() {
  const { orgContext } = useOrgCtx();
  const { user } = useUser();

  const orgId = orgContext?.orgId as Id<"organizations"> | undefined;

  return (
    <>
      <BannerSystem orgId={orgId} userId={user?.id} />
      <MigrationDetector orgId={orgId} userId={user?.id} />
      <UpgradeDetector orgId={orgId} userId={user?.id} />
      <FirstLoginDetector orgId={orgId} userId={user?.id} />
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ConvexClientProvider>
        <NavigationProvider>
          <OrgContextProvider>
            <AppFeatures />
            {children}
            {/* <MobileToggle /> */}
          </OrgContextProvider>
        </NavigationProvider>
      </ConvexClientProvider>
    </ThemeProvider>
  );
}