"use client";

import { useRouter as useNextRouter } from "next/navigation";
import { useCallback } from "react";
import { useNavigation } from "@/contexts/NavigationContext";

interface NavigationOptions {
  preserveParams?: boolean;
  additionalParams?: Record<string, string>;
}

export function useAppRouter() {
  const nextRouter = useNextRouter();
  const { buildUrl } = useNavigation();

  const push = useCallback(
    (href: string, options: NavigationOptions = {}) => {
      const { preserveParams = true, additionalParams } = options;
      const finalHref = preserveParams ? buildUrl(href, additionalParams) : href;
      nextRouter.push(finalHref);
    },
    [nextRouter, buildUrl]
  );

  const replace = useCallback(
    (href: string, options: NavigationOptions = {}) => {
      const { preserveParams = true, additionalParams } = options;
      const finalHref = preserveParams ? buildUrl(href, additionalParams) : href;
      nextRouter.replace(finalHref);
    },
    [nextRouter, buildUrl]
  );

  return {
    push,
    replace,
    back: nextRouter.back,
    forward: nextRouter.forward,
    refresh: nextRouter.refresh,
    prefetch: nextRouter.prefetch,
  };
}
