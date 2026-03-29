'use client';

import { useState } from 'react';
import { Banner } from './Banner';
import { PostUpgradeWizard } from '../upgrade/PostUpgradeWizard';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface SetupPendingBannerProps {
  orgId: Id<'organizations'>;
  userId: string;
  onDismiss: () => void;
}

export function SetupPendingBanner({
  orgId,
  userId,
  onDismiss,
}: SetupPendingBannerProps) {
  const [showWizard, setShowWizard] = useState(false);
  const dismissBanner = useMutation(api.userPreferences.dismissBanner);

  const handleSetupNow = () => {
    setShowWizard(true);
  };

  const handleDismiss = async () => {
    await dismissBanner({
      userId,
      orgId,
      bannerId: 'multi-location-setup',
    });
    onDismiss();
  };

  const handleWizardClose = () => {
    setShowWizard(false);
  };

  if (showWizard) {
    return (
      <PostUpgradeWizard
        orgId={orgId}
        userId={userId}
        onClose={handleWizardClose}
      />
    );
  }

  return (
    <Banner
      variant="info"
      onDismiss={handleDismiss}
      action={{
        label: 'Set up now',
        onClick: handleSetupNow,
      }}
    >
      🌟 Complete your Multi-Location setup to unlock all features
    </Banner>
  );
}
