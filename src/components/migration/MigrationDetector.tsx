'use client';

import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { MigrationNoticeModal } from './MigrationNoticeModal';
import type { Id } from 'convex/_generated/dataModel';

interface MigrationDetectorProps {
  orgId: Id<'organizations'> | null | undefined;
  userId: string | null | undefined;
}

/**
 * Detects if organization was migrated to multi-location support
 * Shows migration notice modal once when detected
 */
export function MigrationDetector({ orgId, userId }: MigrationDetectorProps) {
  const [showModal, setShowModal] = useState(false);

  // Check if org needs location review (post-migration)
  const needsReview = useQuery(
    api.organizationSetup.needsLocationReview,
    orgId ? { orgId } : 'skip'
  );

  // Get organization to show location name
  const organization = useQuery(
    api.organizations.getById,
    orgId ? { id: orgId } : 'skip'
  );

  // Get locations to find default location name
  const locations = useQuery(
    api.locations.getByOrg,
    orgId ? { orgId } : 'skip'
  );

  const isLoading = needsReview === undefined || organization === undefined || locations === undefined;

  useEffect(() => {
    if (isLoading || !needsReview || !userId || !organization) return;

    // Show modal if org needs location review
    setShowModal(true);
  }, [isLoading, needsReview, userId, organization]);

  // Don't show anything while loading
  if (isLoading || !orgId || !userId) {
    return null;
  }

  if (!showModal || !organization) {
    return null;
  }

  // Find default location name
  const defaultLocation = locations?.find((loc) => loc.isDefault);
  const defaultLocationName =
    defaultLocation?.name || organization.clinicName || 'Main Location';

  return (
    <MigrationNoticeModal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      orgId={orgId}
      defaultLocationName={defaultLocationName}
    />
  );
}
