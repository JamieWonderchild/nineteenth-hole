'use client';

import { Banner } from './Banner';
import { useAppRouter } from '@/hooks/useAppRouter';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface MigrationReviewBannerProps {
  orgId: Id<'organizations'>;
  userId: string;
  onDismiss: () => void;
}

/**
 * Persistent banner reminding users to review location setup after migration
 * Shows if migration notice was dismissed but location setup incomplete
 */
export function MigrationReviewBanner({
  orgId,
  userId,
  onDismiss,
}: MigrationReviewBannerProps) {
  const router = useAppRouter();
  const dismissBanner = useMutation(api.userPreferences.dismissBanner);

  const handleReviewNow = () => {
    router.push('/settings/locations');
  };

  const handleDismiss = async () => {
    await dismissBanner({
      userId,
      orgId,
      bannerId: 'migration-review',
    });
    onDismiss();
  };

  return (
    <Banner
      variant="info"
      onDismiss={handleDismiss}
      action={{
        label: 'Review locations',
        onClick: handleReviewNow,
      }}
    >
      📍 Review your location setup to get the most out of multi-location features
    </Banner>
  );
}
