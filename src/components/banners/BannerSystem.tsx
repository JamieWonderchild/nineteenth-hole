'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { SetupPendingBanner } from './SetupPendingBanner';
import { MigrationReviewBanner } from './MigrationReviewBanner';
import type { Id } from 'convex/_generated/dataModel';

interface BannerSystemProps {
  orgId: Id<'organizations'> | null | undefined;
  userId: string | null | undefined;
}

/**
 * Manages and displays banners based on org and user state
 */
export function BannerSystem({ orgId, userId }: BannerSystemProps) {
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);

  // Check upgrade state
  const upgradeState = useQuery(
    api.upgrade.getUpgradeState,
    orgId ? { orgId } : 'skip'
  );

  // Check if setup banner is dismissed
  const isSetupBannerDismissed = useQuery(
    api.userPreferences.isBannerDismissed,
    orgId && userId
      ? { orgId, userId, bannerId: 'multi-location-setup' }
      : 'skip'
  );

  // Check if migration review banner is dismissed
  const isMigrationBannerDismissed = useQuery(
    api.userPreferences.isBannerDismissed,
    orgId && userId
      ? { orgId, userId, bannerId: 'migration-review' }
      : 'skip'
  );

  // Get organization to check migration state
  const organization = useQuery(
    api.organizations.getById,
    orgId ? { id: orgId } : 'skip'
  );

  const handleDismiss = (bannerId: string) => {
    setDismissedBanners([...dismissedBanners, bannerId]);
  };

  if (!orgId || !userId) return null;

  // NOTE: Multi-location setup banner now shown on dashboard only
  // via SubtleSetupBanner component, not here
  const showSetupBanner = false;

  // Show migration review banner if:
  // - Organization was migrated (has migratedAt timestamp)
  // - Migration modal was dismissed (needsLocationReview = false)
  // - Location setup not completed
  // - User hasn't dismissed banner
  // - Not already dismissed in this session
  const showMigrationBanner =
    organization?.migratedAt &&
    !organization?.needsLocationReview &&
    upgradeState?.setupState?.locationSetupCompleted === false &&
    !isMigrationBannerDismissed &&
    !dismissedBanners.includes('migration-review');

  return (
    <>
      {showMigrationBanner && (
        <MigrationReviewBanner
          orgId={orgId}
          userId={userId}
          onDismiss={() => handleDismiss('migration-review')}
        />
      )}
      {showSetupBanner && !showMigrationBanner && (
        <SetupPendingBanner
          orgId={orgId}
          userId={userId}
          onDismiss={() => handleDismiss('multi-location-setup')}
        />
      )}
    </>
  );
}
