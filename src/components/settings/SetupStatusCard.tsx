'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { PostUpgradeWizard } from '../upgrade/PostUpgradeWizard';
import type { Id } from 'convex/_generated/dataModel';

interface SetupStatusCardProps {
  orgId: Id<'organizations'>;
  userId: string;
  setupState: {
    locationSetupCompleted: boolean;
    teamSetupCompleted?: boolean;
  } | null | undefined;
}

/**
 * Shows incomplete setup tasks in Settings page
 * Always visible when setup is incomplete
 */
export function SetupStatusCard({
  orgId,
  userId,
  setupState,
}: SetupStatusCardProps) {
  const [showWizard, setShowWizard] = useState(false);

  // Don't show if setup is complete
  if (setupState?.locationSetupCompleted !== false) {
    return null;
  }

  const handleComplete = () => {
    setShowWizard(true);
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
    <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20 mb-6">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-orange-900 dark:text-orange-100">
              Complete Your Setup
            </h3>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
              You're on the Multi-Location plan but haven't set up your locations yet.
              Complete the setup to unlock all features.
            </p>

            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2 text-sm">
                {setupState?.locationSetupCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-orange-400" />
                )}
                <span className={setupState?.locationSetupCompleted ? 'text-muted-foreground line-through' : 'text-orange-800 dark:text-orange-200'}>
                  Set up practice locations
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {setupState?.teamSetupCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-orange-400" />
                )}
                <span className={setupState?.teamSetupCompleted ? 'text-muted-foreground line-through' : 'text-orange-800 dark:text-orange-200'}>
                  Review team access (optional)
                </span>
              </div>
            </div>

            <Button
              onClick={handleComplete}
              className="mt-4"
              size="sm"
            >
              Complete Setup
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
