'use client';

import { useEffect } from 'react';
import { useAppRouter } from '@/hooks/useAppRouter';
import { Loader2 } from 'lucide-react';

export default function BillingCatalogRedirect() {
  const router = useAppRouter();

  useEffect(() => {
    router.replace('/billing', { additionalParams: { tab: 'catalog' } });
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
