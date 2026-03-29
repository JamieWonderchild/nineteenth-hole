'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Wizard, WizardStep } from '@/components/ui/Wizard';
import { PracticeSetupStep } from './steps/PracticeSetupStep';
import { LocationSetupStep } from './steps/LocationSetupStep';
import { CompleteStep } from './steps/CompleteStep';
import { useWizardState } from '@/hooks/useWizardState';
import { Loader2, Stethoscope } from 'lucide-react';
import { debugLog } from '@/lib/debug-logger';

const WIZARD_ID = 'onboarding-v1';

export default function OnboardingPage() {
  const router = useRouter();
  const { userId, orgId: clerkOrgId, isLoaded } = useAuth();
  const { user } = useUser();

  // Redirect to sign-in if not authenticated
  React.useEffect(() => {
    if (isLoaded && !userId) {
      debugLog.warn('OnboardingPage', 'User not authenticated, redirecting to sign-in');
      router.replace('/sign-in');
    }
  }, [isLoaded, userId, router]);

  // Check if user already has an org — if so, redirect to dashboard
  const existingMemberships = useQuery(
    api.memberships.getByUser,
    userId ? { userId } : 'skip'
  );

  React.useEffect(() => {
    debugLog.debug('OnboardingPage', 'Membership check', {
      hasMemberships: !!existingMemberships,
      count: existingMemberships?.length ?? 'undefined',
      hasClerkOrgId: !!clerkOrgId,
    });

    // Only redirect if user has BOTH Convex memberships AND a Clerk org
    // This prevents redirect loop when user has stale memberships but no Clerk orgs
    if (existingMemberships && existingMemberships.length > 0 && clerkOrgId) {
      // User already has an org — go to dashboard
      debugLog.info('OnboardingPage', 'User has memberships AND Clerk org, REDIRECTING to /', {
        count: existingMemberships.length,
        clerkOrgId,
      });
      router.replace('/');
    } else if (existingMemberships && existingMemberships.length > 0 && !clerkOrgId) {
      // User has stale Convex memberships but no Clerk org
      debugLog.warn('OnboardingPage', 'User has stale memberships but no Clerk org - staying on onboarding', {
        count: existingMemberships.length,
      });
      // Stay on onboarding page - they need to create a new org
    }
  }, [existingMemberships, clerkOrgId, router]);

  // Get org context for wizard state tracking
  const firstOrgId = existingMemberships?.[0]?.orgId;

  // Wizard state management
  const {
    currentStep,
    data,
    setData,
    goToNext,
    goToBack,
    complete,
    isInitialized,
  } = useWizardState({
    wizardId: WIZARD_ID,
    userId,
    orgId: firstOrgId,
    totalSteps: 3,
    autoSave: true,
    onComplete: () => {
      // Completion is handled in CompleteStep component
      // which redirects to billing or dashboard
    },
  });

  // Define wizard steps
  const steps: WizardStep[] = [
    {
      id: 'practice-setup',
      title: 'Practice Setup',
      component: PracticeSetupStep,
    },
    {
      id: 'location-setup',
      title: 'Location Setup',
      component: LocationSetupStep,
    },
    {
      id: 'complete',
      title: 'Complete',
      component: CompleteStep,
    },
  ];

  // Show loading while checking existing memberships
  if (existingMemberships === undefined || !isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <h2 className="text-lg font-semibold">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with branding */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Stethoscope className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">[PRODUCT_NAME]</h1>
        </div>
      </div>

      {/* Wizard */}
      <Wizard
        steps={steps}
        currentStep={currentStep}
        onNext={goToNext}
        onBack={goToBack}
        onComplete={complete}
        data={data}
        setData={setData}
        showStepIndicator={true}
      />
    </div>
  );
}
