'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { PostUpgradeWizard } from '../upgrade/PostUpgradeWizard';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface SubtleSetupBannerProps {
  orgId: Id<'organizations'>;
  userId: string;
}

/**
 * Subtle, non-intrusive banner shown only on dashboard
 * after user dismisses the upgrade modal
 */
export function SubtleSetupBanner({
  orgId,
  userId,
}: SubtleSetupBannerProps) {
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
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Complete your multi-location setup
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
            Set up your locations and team access to unlock all features. Takes about 2 minutes.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSetupNow}
              className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 underline"
            >
              Set up now
            </button>
            <span className="text-blue-300 dark:text-blue-700">•</span>
            <button
              onClick={handleDismiss}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
