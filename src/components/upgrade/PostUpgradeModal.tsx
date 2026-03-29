'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FeatureModal } from '@/components/ui/FeatureModal';
import { PostUpgradeWizard } from './PostUpgradeWizard';
import { MapPin, Users, BarChart3 } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface PostUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: Id<'organizations'>;
  userId: string;
}

export function PostUpgradeModal({
  isOpen,
  onClose,
  orgId,
  userId,
}: PostUpgradeModalProps) {
  const [showWizard, setShowWizard] = useState(false);
  const dismissWizard = useMutation(api.upgrade.dismissUpgradeWizard);

  const handleSetupNow = () => {
    setShowWizard(true);
  };

  const handleRemindLater = async () => {
    // Dismiss the modal but show banner
    await dismissWizard({ userId, orgId });
    onClose();
  };

  const handleWizardClose = () => {
    setShowWizard(false);
    onClose();
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
    <FeatureModal
      isOpen={isOpen}
      onClose={handleRemindLater}
      title="Welcome to Multi-Location!"
      size="medium"
    >
      <div className="space-y-6">
        {/* Hero Message */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
          </div>
          <p className="text-muted-foreground">
            You've unlocked powerful multi-location features! Let's set up your
            practice locations and team access.
          </p>
        </div>

        {/* Features List */}
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Multiple Locations</h4>
              <p className="text-sm text-muted-foreground">
                Manage all your practice locations from one account
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Location-Based Access</h4>
              <p className="text-sm text-muted-foreground">
                Assign team members to specific locations for better control
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Location Analytics</h4>
              <p className="text-sm text-muted-foreground">
                Track performance metrics across all your locations
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button onClick={handleSetupNow} className="w-full" size="lg">
            Set Up Now
          </Button>
          <Button
            onClick={handleRemindLater}
            variant="outline"
            className="w-full"
          >
            Remind Me Later
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Setup takes about 2 minutes. You can always resume later from where
          you left off.
        </p>
      </div>
    </FeatureModal>
  );
}
