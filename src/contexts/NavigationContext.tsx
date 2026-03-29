"use client";

import { createContext, useContext, useMemo, useCallback, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { NavigationContext, PersistentParams, PersistentParamKey } from "@/types/navigation";

const NavContext = createContext<NavigationContext | null>(null);

const PERSISTENT_KEYS: PersistentParamKey[] = ["assume"];

function NavigationProviderInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();

  // Memoized param extraction
  const params = useMemo<PersistentParams>(() => {
    const extracted: PersistentParams = {};
    for (const key of PERSISTENT_KEYS) {
      const value = searchParams.get(key);
      if (value) extracted[key] = value;
    }
    return extracted;
  }, [searchParams]);

  // Build URL with persistent + additional params
  const buildUrl = useCallback(
    (path: string, additionalParams?: Record<string, string>): string => {
      const url = new URL(path, "http://dummy.com");

      // Add persistent params
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });

      // Add/override with additional params
      if (additionalParams) {
        Object.entries(additionalParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      }

      return url.pathname + url.search;
    },
    [params]
  );

  // Note: setParam is a placeholder for future use
  // Would require router.push/replace to actually update URL
  const setParam = useCallback(
    (_key: PersistentParamKey, _value: string | null) => {
      // Future implementation: router.push with updated params
      console.warn("setParam not yet implemented");
    },
    []
  );

  const value = useMemo(
    () => ({ params, buildUrl, setParam }),
    [params, buildUrl, setParam]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <NavigationProviderInner>{children}</NavigationProviderInner>
    </Suspense>
  );
}

export function useNavigation(): NavigationContext {
  const context = useContext(NavContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}
