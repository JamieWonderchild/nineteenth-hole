'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { useAppRouter } from '@/hooks/useAppRouter';

interface LoadingLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  showSpinner?: boolean;
  onClick?: () => void;
  preserveParams?: boolean;
  additionalParams?: Record<string, string>;
}

/**
 * Link component that provides immediate visual feedback during navigation
 * with automatic persistent param preservation
 */
export function LoadingLink({
  href,
  children,
  className,
  showSpinner = false,
  onClick,
  preserveParams = true,
  additionalParams,
}: LoadingLinkProps) {
  const router = useAppRouter();
  const [isPending, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick?.();

    setIsNavigating(true);
    startTransition(() => {
      router.push(href, { preserveParams, additionalParams });
    });
  };

  const loading = isPending || isNavigating;

  return (
    <AppLink
      href={href}
      preserveParams={preserveParams}
      additionalParams={additionalParams}
      className={className}
      onClick={handleClick}
      style={{ pointerEvents: loading ? 'none' : 'auto' }}
    >
      {loading && showSpinner && (
        <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" />
      )}
      {children}
    </AppLink>
  );
}
