'use client';

import React, { createContext, useContext, useEffect, useRef, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useOrganizationList } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useOrgContext } from '@/hooks/useOrgContext';
import type { OrgContext } from '@/types/billing';
import { debugLog } from '@/lib/debug-logger';
import { RedirectCircuitBreaker } from '@/lib/redirect-circuit-breaker';
import { CircuitBreakerError } from '@/components/errors/CircuitBreakerError';

interface OrgContextValue {
  orgContext: OrgContext | null;
  isLoading: boolean;
  error: string | null;
  hasOrg: boolean;
}

const OrgCtx = createContext<OrgContextValue>({
  orgContext: null,
  isLoading: true,
  error: null,
  hasOrg: false,
});

const SKIP_REDIRECT_PATHS = ['/onboarding', '/sign-in', '/sign-up', '/companion', '/admin'];

export function OrgContextProvider({ children }: { children: React.ReactNode }) {
  const { orgContext, isLoading, error } = useOrgContext();
  const { userId, orgId: clerkOrgId } = useAuth();
  const { setActive, userMemberships } = useOrganizationList({ userMemberships: { infinite: true } });
  const pathname = usePathname();
  const router = useRouter();
  const autoSwitchAttempted = useRef(false);
  const autoSwitchFailedTimeout = useRef<NodeJS.Timeout | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const circuitBreakerRef = useRef(new RedirectCircuitBreaker());
  const [showCircuitBreaker, setShowCircuitBreaker] = useState(false);

  // Debug logging
  useEffect(() => {
    debugLog.debug('OrgContextProvider', 'State update', {
      pathname,
      userId: userId ? 'present' : 'null',
      clerkOrgId: clerkOrgId || 'null',
      hasOrgContext: !!orgContext,
      isLoading,
      error,
    });
  }, [pathname, userId, clerkOrgId, orgContext, isLoading, error]);

  // Always check if user has memberships in Convex
  const convexMemberships = useQuery(
    api.memberships.getByUser,
    userId ? { userId } : 'skip'
  );

  // Get the first membership's org to extract its Clerk ID
  const firstMembershipOrgId = convexMemberships?.[0]?.orgId;
  const firstConvexOrg = useQuery(
    api.organizations.getById,
    firstMembershipOrgId ? { id: firstMembershipOrgId } : 'skip'
  );

  // Get Clerk organizations the user has access to (memoized with stable array to prevent infinite loops)
  const clerkOrgIds = useMemo(
    () => new Set(userMemberships?.data?.map((m) => m.organization.id) || []),
    [userMemberships?.data]
  );
  const clerkOrgCount = clerkOrgIds.size;

  // Create stable array representation for dependency tracking
  const clerkOrgIdArray = useMemo(
    () => Array.from(clerkOrgIds).sort(),
    [clerkOrgIds]
  );

  // Auto-switch: handle bad Clerk org session (org doesn't exist in Convex)
  useEffect(() => {
    if (!userId || !setActive || autoSwitchAttempted.current) return;
    if (userMemberships?.isLoading) return; // Wait for Clerk memberships to load

    debugLog.debug('OrgContextProvider', 'Auto-switch check', {
      hasClerkOrgId: !!clerkOrgId,
      hasOrgContext: !!orgContext,
      isLoading,
      error,
      clerkOrgsCount: clerkOrgCount,
      convexMembershipsCount: convexMemberships?.length ?? 'loading',
    });

    // Case 1: No Clerk org but user has Clerk memberships → switch to first one
    if (!clerkOrgId && clerkOrgCount > 0) {
      const firstClerkOrgId = Array.from(clerkOrgIds)[0];
      debugLog.info('OrgContextProvider', 'Auto-switching to first Clerk org (no session)', {
        clerkOrgId: firstClerkOrgId,
      });

      autoSwitchAttempted.current = true;
      setActive({ organization: firstClerkOrgId }).catch((err) => {
        debugLog.error('OrgContextProvider', 'Auto-switch to first Clerk org failed', err);
        console.error('Auto-switch to first Clerk org failed:', err);
      });
      return;
    }

    // Case 2: Has Clerk org but it doesn't exist in Convex → switch to valid org
    if (clerkOrgId && !orgContext && !isLoading && error === 'Organization not found') {
      // First, try to find another Clerk org from userMemberships
      if (clerkOrgCount > 1) {
        const alternativeOrgId = Array.from(clerkOrgIds).find((id) => id !== clerkOrgId);

        if (alternativeOrgId) {
          debugLog.warn('OrgContextProvider', 'Bad Clerk org detected, switching to alternative from Clerk list', {
            badClerkOrgId: clerkOrgId,
            alternativeClerkOrgId: alternativeOrgId,
          });

          autoSwitchAttempted.current = true;
          setActive({ organization: alternativeOrgId }).catch((err) => {
            debugLog.error('OrgContextProvider', 'Failed to switch from bad org', err);
            console.error('Failed to switch from bad org:', err);
          });
          return;
        }
      }

      // No alternatives in Clerk userMemberships list, but user has Convex memberships
      // Force-switch to the first valid Convex org's Clerk ID
      if (firstConvexOrg?.clerkOrgId && firstConvexOrg.clerkOrgId !== clerkOrgId) {
        debugLog.warn('OrgContextProvider', 'Force-switching to valid org from Convex membership', {
          badClerkOrgId: clerkOrgId,
          validClerkOrgId: firstConvexOrg.clerkOrgId,
          orgName: firstConvexOrg.name,
        });

        autoSwitchAttempted.current = true;
        setActive({ organization: firstConvexOrg.clerkOrgId }).catch((err) => {
          debugLog.error('OrgContextProvider', 'Force-switch to Convex org failed', err);
          console.error('Force-switch to Convex org failed:', err);

          // Force-switch failed - user doesn't have access to this Clerk org
          // Clear session and redirect to onboarding
          debugLog.warn('OrgContextProvider', 'All org access attempts failed, clearing session and redirecting to onboarding');
          setActive({ organization: null }).catch(() => {});
          setTimeout(() => {
            router.replace('/onboarding');
          }, 500);
        });
        return;
      }

      // Still loading the Convex org
      if (convexMemberships && convexMemberships.length > 0 && firstConvexOrg === undefined) {
        debugLog.debug('OrgContextProvider', 'Waiting for Convex org to load before force-switch', {
          badClerkOrgId: clerkOrgId,
        });
        return;
      }

      // No Convex memberships at all → clear session to trigger onboarding
      debugLog.warn('OrgContextProvider', 'No valid orgs available, clearing session', {
        badClerkOrgId: clerkOrgId,
      });

      autoSwitchAttempted.current = true;
      setActive({ organization: null }).catch((err) => {
        debugLog.error('OrgContextProvider', 'Failed to clear bad org session', err);
        console.error('Failed to clear bad org session:', err);
      });
    }
  }, [
    userId,
    clerkOrgId,
    orgContext,
    isLoading,
    error,
    userMemberships?.isLoading,
    clerkOrgIdArray,
    clerkOrgCount,
    setActive,
  ]);

  // Fallback: if auto-switch was attempted but still no org context after 5 seconds, force redirect to onboarding
  useEffect(() => {
    if (autoSwitchFailedTimeout.current) {
      clearTimeout(autoSwitchFailedTimeout.current);
      autoSwitchFailedTimeout.current = null;
    }

    if (autoSwitchAttempted.current && !orgContext && !isLoading && userId) {
      debugLog.warn('OrgContextProvider', 'Auto-switch attempted but no org context yet, setting fallback timeout');

      autoSwitchFailedTimeout.current = setTimeout(() => {
        if (!orgContext && pathname !== '/onboarding') {
          debugLog.error('OrgContextProvider', 'Auto-switch failed timeout - forcing redirect to onboarding');
          router.replace('/onboarding');
        }
      }, 5000);
    }

    return () => {
      if (autoSwitchFailedTimeout.current) {
        clearTimeout(autoSwitchFailedTimeout.current);
      }
    };
  }, [autoSwitchAttempted.current, orgContext, isLoading, userId, pathname, router]);

  // Redirect to onboarding only if authenticated, no org context, AND no existing membership
  useEffect(() => {
    // Clear any pending redirect
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }

    debugLog.debug('OrgContextProvider', 'Redirect check', {
      userId: userId ? 'present' : 'null',
      isLoading,
      hasOrgContext: !!orgContext,
      clerkOrgId: clerkOrgId || 'null',
      clerkOrgsCount: clerkOrgCount,
      convexMembershipsCount: convexMemberships?.length ?? 'undefined',
      pathname,
    });

    if (!userId || isLoading) {
      debugLog.debug('OrgContextProvider', 'Skip redirect: not authenticated or loading');
      return;
    }

    if (orgContext) {
      debugLog.debug('OrgContextProvider', 'Skip redirect: has org context');
      return; // Has a working org context — all good
    }

    // Clerk session has an active org — wait for Convex to confirm it.
    // The auto-switch effect handles the case where the org doesn't exist in Convex
    // (it clears clerkOrgId, at which point this effect will redirect).
    if (clerkOrgId) {
      debugLog.debug('OrgContextProvider', 'Skip redirect: Clerk session has orgId, waiting for org context to load', { clerkOrgId });
      return;
    }

    // Still loading Clerk memberships or Convex memberships — wait
    if (userMemberships?.isLoading || convexMemberships === undefined) {
      debugLog.debug('OrgContextProvider', 'Skip redirect: waiting for memberships to load');
      return;
    }

    // User has Clerk orgs — auto-switch is in progress or will happen, don't redirect
    if (clerkOrgCount > 0 && !autoSwitchAttempted.current) {
      debugLog.info('OrgContextProvider', 'Skip redirect: has Clerk orgs, waiting for auto-switch', {
        clerkOrgsCount: clerkOrgCount,
        clerkOrgId: clerkOrgId || 'null',
      });
      return;
    }

    // Auto-switch was attempted but still no orgContext
    // This could mean the auto-switch is still in progress
    if (clerkOrgCount > 0 && autoSwitchAttempted.current) {
      debugLog.info('OrgContextProvider', 'Skip redirect: auto-switch attempted, waiting for session update', {
        clerkOrgsCount: clerkOrgCount,
        clerkOrgId: clerkOrgId || 'null',
      });
      return;
    }

    // Check if current path should skip redirect
    const shouldSkip = SKIP_REDIRECT_PATHS.some((p) => pathname.startsWith(p));
    if (shouldSkip) {
      debugLog.debug('OrgContextProvider', 'Skip redirect: path in skip list', { pathname });
      return;
    }

    // Check circuit breaker before redirecting
    const breaker = circuitBreakerRef.current;
    if (breaker.isOpen()) {
      debugLog.error('OrgContextProvider', 'Circuit breaker is OPEN - showing error UI');
      setShowCircuitBreaker(true);
      return;
    }

    // Record this redirect attempt
    breaker.recordAttempt('No org context and no memberships', pathname, {
      userId: userId || undefined,
      clerkOrgId: clerkOrgId || undefined,
      hasOrgContext: !!orgContext,
      clerkOrgCount,
    });

    // Check again after recording (might have opened)
    if (breaker.isOpen()) {
      debugLog.error('OrgContextProvider', 'Circuit breaker OPENED after recording attempt');
      setShowCircuitBreaker(true);
      return;
    }

    // Debounce redirect to give Clerk session time to settle
    // This prevents premature redirects during org creation/switching
    // Short timeout to avoid flash of wrong content while still handling edge cases
    debugLog.warn('OrgContextProvider', 'Scheduling redirect to onboarding in 500ms', {
      reason: 'No org context and no memberships',
      pathname,
    });

    redirectTimeoutRef.current = setTimeout(() => {
      debugLog.info('OrgContextProvider', 'REDIRECTING to /onboarding', { from: pathname });
      router.replace('/onboarding');
    }, 500);

    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [
    userId,
    orgContext,
    isLoading,
    pathname,
    router,
    clerkOrgId,
    convexMemberships,
    clerkOrgCount,
    userMemberships?.isLoading,
  ]);

  // Show circuit breaker error if open
  if (showCircuitBreaker) {
    return (
      <CircuitBreakerError
        breadcrumbs={circuitBreakerRef.current.getBreadcrumbs()}
        remainingCooldown={circuitBreakerRef.current.getRemainingCooldown()}
        onReset={() => {
          circuitBreakerRef.current.reset();
          setShowCircuitBreaker(false);
        }}
      />
    );
  }

  return (
    <OrgCtx.Provider
      value={{
        orgContext,
        isLoading: isLoading || userMemberships?.isLoading || convexMemberships === undefined,
        error,
        hasOrg: !!orgContext,
      }}
    >
      {children}
    </OrgCtx.Provider>
  );
}

export function useOrgCtx(): OrgContextValue {
  return useContext(OrgCtx);
}
