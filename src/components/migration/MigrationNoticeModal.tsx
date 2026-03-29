'use client';

import { FeatureModal } from '@/components/ui/FeatureModal';
import { Button } from '@/components/ui/button';
import { MapPin, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAppRouter } from '@/hooks/useAppRouter';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface MigrationNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: Id<'organizations'>;
  defaultLocationName: string;
}

/**
 * Modal shown once after migration to multi-location support
 * Explains what happened and provides path to review locations
 */
export function MigrationNoticeModal({
  isOpen,
  onClose,
  orgId,
  defaultLocationName,
}: MigrationNoticeModalProps) {
  const router = useAppRouter();
  const clearLocationReview = useMutation(api.organizationSetup.clearLocationReview);

  const handleReviewLocations = async () => {
    // Clear the flag and navigate to location settings
    await clearLocationReview({ orgId });
    onClose();
    router.push('/settings/locations');
  };

  const handleDismiss = async () => {
    // Clear the flag but don't navigate
    await clearLocationReview({ orgId });
    onClose();
  };

  return (
    <FeatureModal
      isOpen={isOpen}
      onClose={handleDismiss}
      title="🌟 Location Support Added"
      size="medium"
    >
      <div className="space-y-6">
        {/* Welcome Message */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <MapPin className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Multi-Location Support is Here!</h3>
            <p className="text-muted-foreground mt-1">
              [PRODUCT_NAME] now supports managing multiple clinic locations. We've
              automatically set up your existing practice as a location.
            </p>
          </div>
        </div>

        {/* What We Did */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">What we did:</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  Created &quot;{defaultLocationName}&quot; location
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  We used your practice details to create your first location
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">Assigned all existing data</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your patients, encounters, and team members are now linked to this
                  location
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What You Can Do */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <h4 className="font-medium text-sm mb-2">What you can do now:</h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Rename the default location to match your clinic name</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Add additional locations if you have multiple clinics</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Assign team members to specific locations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>View analytics and data by location</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button onClick={handleReviewLocations} className="flex-1">
            <span>Review Locations</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button onClick={handleDismiss} variant="outline" className="flex-1">
            I&apos;ll Do It Later
          </Button>
        </div>

        {/* Note */}
        <p className="text-xs text-muted-foreground text-center">
          You can always access location settings from the Settings menu
        </p>
      </div>
    </FeatureModal>
  );
}
