"use client";

import Link from "next/link";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { useNavigation } from "@/contexts/NavigationContext";

interface AppLinkProps extends Omit<ComponentPropsWithoutRef<typeof Link>, "href"> {
  href: string;
  preserveParams?: boolean; // Default true
  additionalParams?: Record<string, string>;
}

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  function AppLink({ href, preserveParams = true, additionalParams, ...props }, ref) {
    const { buildUrl } = useNavigation();
    const finalHref = preserveParams ? buildUrl(href, additionalParams) : href;
    return <Link ref={ref} href={finalHref} {...props} />;
  }
);
