'use client';

import * as React from 'react';
import { useUser } from '@clerk/nextjs';
import { Smartphone, Monitor } from 'lucide-react';
import { isSuperadmin } from '@/lib/superadmin';

/**
 * Superadmin-only toggle to simulate mobile mode on desktop
 * Press 'M' key or click the floating toggle to switch modes
 * Available in both dev and production for testing
 */
export function MobileToggle() {
  const { user, isLoaded } = useUser();
  const [forceMobile, setForceMobile] = React.useState<boolean | null>(null);
  const [mounted, setMounted] = React.useState(false);

  // ALL HOOKS MUST BE AT THE TOP - before any conditional returns

  // Wait for client-side mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Load saved preference and set up keyboard shortcut
  React.useEffect(() => {
    if (!mounted) return; // Don't run until mounted

    // Load saved preference
    const saved = localStorage.getItem('dev-force-mobile');
    if (saved) {
      setForceMobile(saved === 'true');
    }

    // Keyboard shortcut: M key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        // Don't trigger if typing in input/textarea
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        setForceMobile((prev) => {
          const newValue = prev === null ? true : !prev;
          localStorage.setItem('dev-force-mobile', String(newValue));
          // Defer event dispatch to avoid setState during render
          setTimeout(() => {
            window.dispatchEvent(new Event('mobile-mode-changed'));
          }, 0);
          return newValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted]);

  // Check permissions AFTER all hooks
  const email = user?.primaryEmailAddress?.emailAddress;
  const isAdmin = isSuperadmin(email);

  // Don't render during SSR or before Clerk loads
  if (!mounted || !isLoaded) {
    return null;
  }

  // Only show to superadmins
  if (!isAdmin) {
    return null;
  }

  const handleToggle = () => {
    setForceMobile((prev) => {
      const newValue = prev === null ? true : !prev;
      localStorage.setItem('dev-force-mobile', String(newValue));
      // Defer event dispatch to avoid setState during render
      setTimeout(() => {
        window.dispatchEvent(new Event('mobile-mode-changed'));
      }, 0);
      return newValue;
    });
  };

  const handleReset = () => {
    setForceMobile(null);
    localStorage.removeItem('dev-force-mobile');
    // Defer event dispatch to avoid setState during render
    setTimeout(() => {
      window.dispatchEvent(new Event('mobile-mode-changed'));
    }, 0);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-2">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium shadow-lg hover:bg-accent transition-colors"
        title="Toggle mobile mode (or press 'M')"
      >
        {forceMobile ? (
          <>
            <Smartphone className="h-4 w-4 text-blue-600" />
            <span>Mobile Mode</span>
          </>
        ) : (
          <>
            <Monitor className="h-4 w-4" />
            <span>Desktop Mode</span>
          </>
        )}
      </button>
      {forceMobile !== null && (
        <button
          onClick={handleReset}
          className="rounded-lg border bg-card px-2 py-2 text-xs hover:bg-accent transition-colors"
          title="Reset to auto-detect"
        >
          ×
        </button>
      )}
    </div>
  );
}
