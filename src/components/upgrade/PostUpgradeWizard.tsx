'use client';

import { Wizard, WizardStep } from '@/components/ui/Wizard';
import { LocationSetupStep } from './steps/LocationSetupStep';
import { TeamAssignmentStep } from './steps/TeamAssignmentStep';
import { CompleteStep } from './steps/CompleteStep';
import { useWizardState } from '@/hooks/useWizardState';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface PostUpgradeWizardProps {
  orgId: Id<'organizations'>;
  userId: string;
  onClose: () => void;
}

const WIZARD_ID = 'multi-location-upgrade-v1';

export function PostUpgradeWizard({
  orgId,
  userId,
  onClose,
}: PostUpgradeWizardProps) {
  const completeSetup = useMutation(api.upgrade.completeMultiLocationSetup);
  // Wizard state management
  const {
    currentStep,
    data,
    setData,
    goToNext,
    goToBack,
    complete,
  } = useWizardState({
    wizardId: WIZARD_ID,
    userId,
    orgId,
    totalSteps: 3,
    autoSave: true,
    onComplete: () => {
      // Completion is handled in CompleteStep
      // which marks setup as done and redirects
      onClose();
    },
  });

  // Initialize orgId in wizard data
  if (!data.orgId) {
    setData({ ...data, orgId });
  }

  // Handle dismiss - mark setup as complete so wizard doesn't show again
  const handleDismiss = async () => {
    try {
      await completeSetup({ orgId });
      onClose();
    } catch (error) {
      console.error('Failed to dismiss wizard:', error);
      // Close anyway to avoid blocking the user
      onClose();
    }
  };

  // Define wizard steps
  const steps: WizardStep[] = [
    {
      id: 'location-setup',
      title: 'Locations',
      component: LocationSetupStep,
    },
    {
      id: 'team-assignment',
      title: 'Team Assignment',
      component: TeamAssignmentStep,
    },
    {
      id: 'complete',
      title: 'Complete',
      component: CompleteStep,
    },
  ];

  return (
    <Wizard
      steps={steps}
      currentStep={currentStep}
      onNext={goToNext}
      onBack={goToBack}
      onComplete={complete}
      onClose={handleDismiss}
      data={data}
      setData={setData}
      showStepIndicator={true}
    />
  );
}
