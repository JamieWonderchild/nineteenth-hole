'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * Hook to detect if the current viewport is mobile-sized
 * Uses Tailwind's sm breakpoint (640px) as the threshold
 *
 * Uses useSyncExternalStore to avoid hydration mismatches
 *
 * Dev mode: Press 'M' key or use MobileToggle component to force mobile mode
 */

function getSnapshot(): boolean {
  const forceMobile = typeof window !== 'undefined' ? localStorage.getItem('dev-force-mobile') : null;
  if (forceMobile !== null) {
    return forceMobile === 'true';
  }
  return typeof window !== 'undefined' ? window.innerWidth < 640 : false;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  const handleChange = () => {
    callback();
  };

  window.addEventListener('resize', handleChange);
  window.addEventListener('mobile-mode-changed', handleChange);

  return () => {
    window.removeEventListener('resize', handleChange);
    window.removeEventListener('mobile-mode-changed', handleChange);
  };
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
