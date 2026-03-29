'use client';

import { useAuth, useOrganization, useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { useSearchParams, usePathname } from 'next/navigation';
import { api } from 'convex/_generated/api';
import { isSuperadmin } from '@/lib/superadmin';
import type { OrgContext } from '@/types/billing';
import type { Id } from 'convex/_generated/dataModel';
import { debugLog } from '@/lib/debug-logger';

export function useOrgContext(): {
  orgContext: OrgContext | null;
  isLoading: boolean;
  error: string | null;
} {
  const { userId, orgId: clerkOrgId } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Superadmin assume mode: ?assume=<org_id>
  const assumeOrgId = searchParams.get('assume');
  const email = user?.primaryEmailAddress?.emailAddress;
  const isAssuming = !!assumeOrgId && isSuperadmin(email);

  // Look up the assumed org (superadmin mode) - pass email for server-side verification
  const assumedOrg = useQuery(
    api.admin.getOrgById,
    isAssuming && email ? { id: assumeOrgId as Id<"organizations">, callerEmail: email } : 'skip'
  );

  // Normal flow: Look up the Convex organization by Clerk org ID
  const org = useQuery(
    api.organizations.getByClerkOrg,
    !isAssuming && clerkOrgId ? { clerkOrgId } : 'skip'
  );

  // Look up the user's membership (skip in assume mode)
  const activeOrg = isAssuming ? assumedOrg : org;
  const membership = useQuery(
    api.memberships.getByOrgAndUser,
    !isAssuming && activeOrg && userId ? { orgId: activeOrg._id, userId } : 'skip'
  );

  // Look up locations for this org
  const locations = useQuery(
    api.locations.getByOrg,
    activeOrg ? { orgId: activeOrg._id } : 'skip'
  );

  // Loading state
  if (!userId) {
    return { orgContext: null, isLoading: false, error: 'Not authenticated' };
  }

  // Superadmin assume mode
  if (isAssuming) {
    if (assumedOrg === undefined) {
      return { orgContext: null, isLoading: true, error: null };
    }
    if (!assumedOrg) {
      return { orgContext: null, isLoading: false, error: 'Assumed organization not found' };
    }

    const orgContext: OrgContext = {
      orgId: assumedOrg._id,
      clerkOrgId: assumedOrg.clerkOrgId,
      name: assumedOrg.name,
      slug: assumedOrg.slug,
      plan: assumedOrg.plan as OrgContext['plan'],
      billingStatus: assumedOrg.billingStatus as OrgContext['billingStatus'],
      stripeSubscriptionId: assumedOrg.stripeSubscriptionId,
      role: 'owner',
      maxProviderSeats: assumedOrg.maxProviderSeats,
      isOwner: true,
      isAdmin: true,
      canManageBilling: true,
      canManageTeam: true,
      canUseFeatures: true, // superadmin always has access
      assumedMode: true,
      assumedBy: email || undefined,
      // Multi-location support (superadmin has full access)
      locationIds: undefined,
      isLocationScoped: false,
      accessibleLocationIds: null, // null = all locations
    };

    return { orgContext, isLoading: false, error: null };
  }

  // Check if we're on an onboarding path - be more patient
  const isOnboardingPath = pathname.startsWith('/onboarding');

  // Normal flow
  if (!clerkOrgId) {
    // If user is authenticated but no clerkOrgId, could be:
    // 1. Genuinely no org (return loading: false)
    // 2. Clerk session is switching (should be loading: true)
    // We check if organizationList is loaded to distinguish
    // During onboarding, suppress the warning to avoid console spam
    if (!isOnboardingPath) {
      debugLog.warn('useOrgContext', 'No clerkOrgId in session', {
        userId: userId ? 'present' : 'null',
        isAssuming,
      });
    }
    return { orgContext: null, isLoading: !userId, error: null };
  }

  if (org === undefined) {
    return { orgContext: null, isLoading: true, error: null };
  }

  if (!org) {
    // During onboarding, treat "org not found" as still loading
    // This prevents error spam when org is being created
    if (isOnboardingPath) {
      debugLog.debug('useOrgContext', 'Org not found yet (onboarding in progress)', { clerkOrgId });
      return { orgContext: null, isLoading: true, error: null };
    }

    debugLog.error('useOrgContext', 'Organization not found in Convex', { clerkOrgId });
    return { orgContext: null, isLoading: false, error: 'Organization not found' };
  }

  if (membership === undefined) {
    debugLog.debug('useOrgContext', 'Loading membership', { orgId: org._id });
    return { orgContext: null, isLoading: true, error: null };
  }

  if (!membership || membership.status !== 'active') {
    debugLog.warn('useOrgContext', 'No active membership', {
      hasMembership: !!membership,
      status: membership?.status,
    });
    return { orgContext: null, isLoading: false, error: 'Not a member of this organization' };
  }

  debugLog.info('useOrgContext', 'Org context successfully loaded', {
    orgId: org._id,
    orgName: org.name,
    clerkOrgId: org.clerkOrgId,
    role: membership.role,
  });

  const role = membership.role as OrgContext['role'];
  const trialExpired = org.billingStatus === 'trialing' && org.trialEndsAt && new Date(org.trialEndsAt) < new Date();
  const billingActive = org.billingStatus === 'active' || (org.billingStatus === 'trialing' && !trialExpired);
  const isSuperadminUser = isSuperadmin(email);

  // Calculate location context
  const locationIds = membership.locationIds;
  const isLocationScoped =
    role === 'practice-admin' ||
    (role === 'provider' && !!(locationIds && locationIds.length > 0));

  // Determine accessible location IDs
  const accessibleLocationIds: string[] | null =
    role === 'owner' || role === 'admin'
      ? locationIds && locationIds.length > 0
        ? locationIds
        : null // null = all locations
      : locationIds || []; // practice-admin/provider: specific locations or none

  const orgContext: OrgContext = {
    orgId: org._id,
    clerkOrgId: org.clerkOrgId,
    name: organization?.name || org.name,
    slug: org.slug,
    plan: org.plan as OrgContext['plan'],
    billingStatus: org.billingStatus as OrgContext['billingStatus'],
    stripeSubscriptionId: org.stripeSubscriptionId,
    role,
    maxProviderSeats: org.maxProviderSeats,
    isOwner: role === 'owner',
    isAdmin: role === 'owner' || role === 'admin',
    canManageBilling: role === 'owner',
    canManageTeam: role === 'owner' || role === 'admin' || role === 'practice-admin',
    canUseFeatures: billingActive || isSuperadminUser,
    // Multi-location support
    locationIds,
    isLocationScoped,
    accessibleLocationIds,
  };

  return { orgContext, isLoading: false, error: null };
}
