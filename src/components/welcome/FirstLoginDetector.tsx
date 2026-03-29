'use client';

import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { useFirstLogin } from '@/hooks/useFirstLogin';
import { OwnerWelcomeModal } from './modals/OwnerWelcome';
import { AdminWelcomeModal } from './modals/AdminWelcome';
import { PracticeAdminWelcomeModal } from './modals/PracticeAdminWelcome';
import { VetWelcomeModal } from './modals/ProviderWelcome';
import type { Id } from 'convex/_generated/dataModel';

interface FirstLoginDetectorProps {
  orgId: Id<'organizations'> | null | undefined;
  userId: string | null | undefined;
}

/**
 * Detects first-time login and shows role-specific welcome modals
 * Skips modal for owners during initial onboarding (just completed wizard)
 */
export function FirstLoginDetector({ orgId, userId }: FirstLoginDetectorProps) {
  const [showModal, setShowModal] = useState(false);
  const { orgContext } = useOrgCtx();

  // Use first login hook
  const { isFirstLogin, membership, role, isLoading } = useFirstLogin({
    userId,
    orgId,
  });

  // Get organization data
  const organization = useQuery(
    api.organizations.getById,
    orgId ? { id: orgId } : 'skip'
  );

  // Get setup state to check onboarding completion
  const setupState = useQuery(
    api.organizationSetup.getSetupState,
    orgId ? { orgId } : 'skip'
  );

  // Get locations if location-scoped
  const locations = useQuery(
    api.locations.getByOrg,
    orgId ? { orgId } : 'skip'
  );

  useEffect(() => {
    if (!isFirstLogin || isLoading || !membership || !organization) return;

    // Skip modal for owner who just completed onboarding
    // Check if onboarding was completed within the last minute
    if (role === 'owner' && setupState?.onboardingCompletedAt && membership.joinedAt) {
      const onboardingTime = new Date(setupState.onboardingCompletedAt).getTime();
      const joinedTime = new Date(membership.joinedAt).getTime();
      const timeDiffMinutes = (joinedTime - onboardingTime) / (1000 * 60);

      // If joined within 1 minute of onboarding completion, skip modal
      if (Math.abs(timeDiffMinutes) < 1) {
        return;
      }
    }

    // Show modal for first login (invited users or owners returning later)
    setShowModal(true);
  }, [isFirstLogin, isLoading, membership, role, setupState, organization]);

  // Don't show anything while loading
  if (isLoading || !orgId || !userId) {
    return null;
  }

  if (!showModal || !organization || !membership) {
    return null;
  }

  // Determine if organization is multi-location
  const isMultiLocation = organization.plan === 'multi-location';

  // Filter locations to user's assigned locations
  const userLocations = locations?.filter((loc) =>
    membership.locationIds?.includes(loc._id)
  ) || [];

  // Determine if user is location-scoped
  const isLocationScoped = !!(membership.locationIds && membership.locationIds.length > 0);

  const handleClose = () => {
    setShowModal(false);
  };

  // Render appropriate modal based on role
  switch (role) {
    case 'owner':
      return (
        <OwnerWelcomeModal
          isOpen={showModal}
          onClose={handleClose}
          orgName={organization.name}
          isMultiLocation={isMultiLocation}
        />
      );

    case 'admin':
      return (
        <AdminWelcomeModal
          isOpen={showModal}
          onClose={handleClose}
          orgName={organization.name}
        />
      );

    case 'practice-admin':
      return (
        <PracticeAdminWelcomeModal
          isOpen={showModal}
          onClose={handleClose}
          orgName={organization.name}
          locations={userLocations}
        />
      );

    case 'provider':
      return (
        <VetWelcomeModal
          isOpen={showModal}
          onClose={handleClose}
          orgName={organization.name}
          locations={userLocations}
          isLocationScoped={isLocationScoped}
        />
      );

    default:
      return null;
  }
}
