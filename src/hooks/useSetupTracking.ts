'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

/**
 * Track organization setup state
 * Returns setup progress and mutations to update it
 */
export function useSetupTracking(orgId: Id<'organizations'> | null | undefined) {
  const setupState = useQuery(
    api.organizationSetup.getSetupState,
    orgId ? { orgId } : 'skip'
  );

  const initializeSetup = useMutation(api.organizationSetup.initializeSetup);
  const markOnboardingComplete = useMutation(api.organizationSetup.markOnboardingComplete);
  const markLocationSetupComplete = useMutation(api.organizationSetup.markLocationSetupComplete);
  const markTeamSetupComplete = useMutation(api.organizationSetup.markTeamSetupComplete);
  const clearLocationReview = useMutation(api.organizationSetup.clearLocationReview);

  const needsLocationReview = useQuery(
    api.organizationSetup.needsLocationReview,
    orgId ? { orgId } : 'skip'
  );

  // Calculate overall progress (0-100)
  const progress = setupState
    ? (
        [
          setupState.onboardingCompleted,
          setupState.locationSetupCompleted,
          setupState.teamSetupCompleted,
          setupState.billingSetupCompleted,
        ].filter(Boolean).length / 4
      ) * 100
    : 0;

  // Determine if setup is complete
  const isSetupComplete = setupState
    ? setupState.onboardingCompleted &&
      setupState.locationSetupCompleted &&
      setupState.teamSetupCompleted &&
      setupState.billingSetupCompleted
    : false;

  // Get next setup step
  const getNextStep = (): string | null => {
    if (!setupState) return 'onboarding';
    if (!setupState.onboardingCompleted) return 'onboarding';
    if (!setupState.locationSetupCompleted) return 'locations';
    if (!setupState.teamSetupCompleted) return 'team';
    if (!setupState.billingSetupCompleted) return 'billing';
    return null;
  };

  return {
    setupState,
    progress,
    isSetupComplete,
    needsLocationReview: needsLocationReview ?? false,
    nextStep: getNextStep(),

    // Mutations
    initializeSetup: (orgId: Id<'organizations'>) => initializeSetup({ orgId }),
    markOnboardingComplete: (orgId: Id<'organizations'>) => markOnboardingComplete({ orgId }),
    markLocationSetupComplete: (orgId: Id<'organizations'>) => markLocationSetupComplete({ orgId }),
    markTeamSetupComplete: (orgId: Id<'organizations'>) => markTeamSetupComplete({ orgId }),
    clearLocationReview: (orgId: Id<'organizations'>) => clearLocationReview({ orgId }),
  };
}
