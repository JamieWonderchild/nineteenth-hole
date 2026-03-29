'use client';

import { useOrgCtx } from '@/app/providers/org-context-provider';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Shield, X } from 'lucide-react';

export function AssumeModeBanner() {
  const { orgContext } = useOrgCtx();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!orgContext?.assumedMode) return null;

  const handleExit = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('assume');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 text-sm font-medium px-4 py-2 flex items-center justify-center gap-2">
      <Shield className="h-4 w-4" />
      <span>
        Superadmin: viewing <strong>{orgContext.name}</strong> as owner
        {orgContext.assumedBy && <span className="ml-1 opacity-75">({orgContext.assumedBy})</span>}
      </span>
      <button
        onClick={handleExit}
        className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-amber-50 text-xs transition-colors"
      >
        <X className="h-3 w-3" />
        Exit
      </button>
    </div>
  );
}
