'use client';

import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { PostUpgradeModal } from './PostUpgradeModal';
import type { Id } from 'convex/_generated/dataModel';

interface UpgradeDetectorProps {
  orgId: Id<'organizations'> | null | undefined;
  userId: string | null | undefined;
}

/**
 * Monitors for plan upgrades to multi-location
 * Shows post-upgrade modal when detected
 */
export function UpgradeDetector({ orgId, userId }: UpgradeDetectorProps) {
  const [showModal, setShowModal] = useState(false);

  // Check upgrade state
  const upgradeState = useQuery(
    api.upgrade.getUpgradeState,
    orgId ? { orgId } : 'skip'
  );

  // Check if user has dismissed the wizard
  const hasDismissed = useQuery(
    api.upgrade.hasDissmissedUpgradeWizard,
    orgId && userId ? { orgId, userId } : 'skip'
  );

  const isLoading = upgradeState === undefined || hasDismissed === undefined;

  useEffect(() => {
    if (isLoading || !upgradeState || !userId) return;

    // Show modal if:
    // - Upgrade state indicates wizard should be shown
    // - User hasn't dismissed it
    // - Modal not already showing
    if (
      upgradeState.showWizard &&
      !hasDismissed &&
      !showModal
    ) {
      setShowModal(true);
    }
  }, [isLoading, upgradeState, hasDismissed, showModal, userId]);

  // Don't show anything while loading
  if (isLoading || !orgId || !userId) return null;

  if (!showModal) return null;

  return (
    <PostUpgradeModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      orgId={orgId}
      userId={userId}
    />
  );
}
