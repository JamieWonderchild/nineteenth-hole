'use client';

import { useSearchParams } from 'next/navigation';

/** Returns `?assume=<id>` if in assume mode, or '' otherwise. Append to hrefs. */
export function useAssumeParam(): string {
  const searchParams = useSearchParams();
  const assumeId = searchParams.get('assume');
  return assumeId ? `?assume=${assumeId}` : '';
}
