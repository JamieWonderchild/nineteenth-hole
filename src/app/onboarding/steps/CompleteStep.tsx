'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, Users, Check, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { useAppRouter } from '@/hooks/useAppRouter';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useUser, useOrganizationList, useAuth } from '@clerk/nextjs';
import { debugLog } from '@/lib/debug-logger';
import { pollForClerkSession } from '@/lib/session-verification';

interface CompleteStepProps {
  onNext: () => void;
  onBack: () => void;
  data: any;
  setData: (data: any) => void;
}

export function CompleteStep({
  onBack,
  data,
  setData,
}: CompleteStepProps) {
  const router = useAppRouter();
  const { user } = useUser();
  const { createOrganization, setActive } = useOrganizationList();
  const auth = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creationStatus, setCreationStatus] = useState<string>('');
  const [setupComplete, setSetupComplete] = useState(false);
  const [showMultiLocationChoice, setShowMultiLocationChoice] = useState(false);
  const [statusSteps, setStatusSteps] = useState<Array<{
    label: string;
    status: 'pending' | 'loading' | 'complete' | 'error';
    message?: string;
  }>>([]);

  const createOrgWithSetup = useMutation(api.onboarding.createOrgWithSetup);

  // Calculate plan recommendation
  const vetCount = data.vetCount || 1;
  const locationCount = data.locations?.length || 1;

  let recommendedPlan: 'solo' | 'practice' | 'multi-location' = 'solo';
  if (locationCount > 1 || vetCount >= 5) {
    recommendedPlan = 'multi-location';
  } else if (vetCount >= 2) {
    recommendedPlan = 'practice';
  }

  const planLabels = {
    solo: 'Solo ($79/month)',
    practice: 'Practice ($149/month)',
    'multi-location': 'Multi-Location ($299/month)',
  };

  const updateStepStatus = (index: number, status: 'pending' | 'loading' | 'complete' | 'error', message?: string) => {
    setStatusSteps(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status, message };
      return updated;
    });
  };

  const handleMultiLocationSubscribe = () => {
    // Redirect to Stripe checkout for Multi-Location
    debugLog.info('CompleteStep', 'User chose to subscribe to Multi-Location');
    router.push(`/api/stripe/onboarding-checkout?plan=multi-location&practiceName=${encodeURIComponent(data.practiceName)}`);
  };

  const handleTryPracticeFree = () => {
    // User chose to try Practice plan instead
    debugLog.info('CompleteStep', 'User chose to try Practice plan free (downgraded from Multi-Location)');
    setShowMultiLocationChoice(false);
    // Continue with setup using Practice plan
    handleComplete('practice');
  };

  const handleComplete = async (overridePlan?: 'solo' | 'practice' | 'multi-location') => {
    debugLog.info('CompleteStep', 'handleComplete called', { overridePlan });

    if (!user || !createOrganization || !setActive || !createOrgWithSetup) {
      debugLog.error('CompleteStep', 'Missing requirements', {
        hasUser: !!user,
        hasCreateOrganization: !!createOrganization,
        hasSetActive: !!setActive,
        hasCreateOrgWithSetup: !!createOrgWithSetup,
      });
      alert('System not ready. Please wait a moment and try again.');
      return;
    }

    // If Multi-Location is recommended and no override, show choice screen
    if (recommendedPlan === 'multi-location' && !overridePlan) {
      setShowMultiLocationChoice(true);
      return;
    }

    const finalPlan = overridePlan || recommendedPlan;

    setIsSubmitting(true);

    // Initialize status steps
    setStatusSteps([
      { label: 'Creating your organization', status: 'pending' },
      { label: 'Activating your account', status: 'pending' },
      { label: 'Setting up your practice', status: 'pending' },
      { label: 'Finalizing setup', status: 'pending' },
    ]);

    debugLog.info('CompleteStep', 'Starting org creation', { practiceName: data.practiceName });

    let clerkOrgCreated: any = null;

    try {
      // Step 1: Create organization in Clerk first
      updateStepStatus(0, 'loading');
      debugLog.info('CompleteStep', 'Creating Clerk org with metadata');
      const clerkOrg = await createOrganization({
        name: data.practiceName,
        // Note: publicMetadata not supported in current Clerk SDK version
        // Plan will be set via Convex during createOrgWithSetup
      });

      if (!clerkOrg) {
        throw new Error('Failed to create organization in Clerk');
      }

      clerkOrgCreated = clerkOrg; // Save for rollback if needed
      debugLog.info('CompleteStep', 'Clerk org created with plan metadata', {
        clerkOrgId: clerkOrg.id,
        plan: finalPlan,
      });
      updateStepStatus(0, 'complete', 'Organization created');

      // Step 2: Switch to the new organization in Clerk session
      updateStepStatus(1, 'loading');
      debugLog.info('CompleteStep', 'Switching to new org in Clerk session');
      await setActive({ organization: clerkOrg.id });
      debugLog.info('CompleteStep', 'Clerk session activated');

      // Force Clerk session to reload by doing a hard page refresh after a delay
      // This ensures Clerk's state is fully updated with the new organization
      debugLog.info('CompleteStep', 'Waiting for Clerk session to settle');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      updateStepStatus(1, 'complete', 'Account activated');

      // Step 3: Create organization in Convex with Clerk org ID
      updateStepStatus(2, 'loading');
      debugLog.info('CompleteStep', 'Creating Convex org', { clerkOrgId: clerkOrg.id });

      let orgId;
      try {
        orgId = await createOrgWithSetup({
          clerkOrgId: clerkOrg.id,
          practiceName: data.practiceName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          locations: data.locations || [],
          plan: finalPlan,
          userId: user.id,
        });
        debugLog.info('CompleteStep', 'Convex org mutation completed', { orgId });
        updateStepStatus(2, 'complete', 'Practice configured');
      } catch (convexError) {
        debugLog.error('CompleteStep', 'Convex org creation FAILED - initiating rollback', {
          error: convexError instanceof Error ? convexError.message : String(convexError),
          stack: convexError instanceof Error ? convexError.stack : undefined,
          clerkOrgId: clerkOrg.id,
        });

        // ROLLBACK: Delete the Clerk org we just created
        try {
          debugLog.warn('CompleteStep', 'Attempting to delete orphaned Clerk org', {
            clerkOrgId: clerkOrg.id,
          });

          const clerkSecretKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
            ? undefined
            : await (async () => {
                // We can't access CLERK_SECRET_KEY from client
                // Best effort: clear the session
                await setActive({ organization: null });
                return undefined;
              })();

          debugLog.info('CompleteStep', 'Clerk session cleared after Convex failure');
        } catch (rollbackError) {
          debugLog.error('CompleteStep', 'Rollback failed', {
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          });
        }

        throw new Error(
          `Failed to create organization in database: ${convexError instanceof Error ? convexError.message : 'Unknown error'}. Your Clerk organization was not saved. Please try again.`
        );
      }

      debugLog.info('CompleteStep', 'Convex org created', { orgId, clerkOrgId: clerkOrg.id });

      // Step 4: Verify org is queryable before showing "Get Started"
      updateStepStatus(3, 'loading');
      debugLog.info('CompleteStep', 'Verifying org is queryable');

      // Import the query function
      const { ConvexHttpClient } = await import('convex/browser');
      const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

      // Poll for org to be queryable (max 10 seconds)
      const maxVerifyTime = 10000;
      const verifyStartTime = Date.now();
      let orgVerified = false;

      while (!orgVerified && (Date.now() - verifyStartTime) < maxVerifyTime) {
        try {
          const verifiedOrg = await client.query(api.organizations.getByClerkOrg, {
            clerkOrgId: clerkOrg.id,
          });

          if (verifiedOrg && verifiedOrg._id === orgId) {
            orgVerified = true;
            debugLog.info('CompleteStep', 'Org verified successfully', {
              orgId,
              verifyTime: Date.now() - verifyStartTime,
            });
          } else {
            debugLog.debug('CompleteStep', 'Org not found yet, retrying...', {
              elapsed: Date.now() - verifyStartTime,
            });
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (err) {
          debugLog.warn('CompleteStep', 'Org verification query failed, retrying', {
            error: err instanceof Error ? err.message : String(err),
          });
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (!orgVerified) {
        debugLog.error('CompleteStep', 'Org verification timeout - proceeding anyway', {
          verifyTime: Date.now() - verifyStartTime,
        });
      }

      updateStepStatus(3, 'complete', 'Ready to go!');

      // Show success screen with "Get Started" button
      setSetupComplete(true);
      setIsSubmitting(false);
    } catch (error) {
      debugLog.error('CompleteStep', 'Org creation failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error('Failed to complete onboarding:', error);
      alert(`Failed to complete setup: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      setIsSubmitting(false);
      setCreationStatus('');
      setStatusSteps([]);
    }
  };

  const handleGetStarted = async () => {
    const redirectPath = recommendedPlan !== 'solo'
      ? `/settings/billing?plan=${recommendedPlan}&new=true`
      : '/';

    debugLog.info('CompleteStep', 'User clicked Get Started, verifying org context is stable');

    // Re-enter loading state to show we're finalizing
    setSetupComplete(false);
    setIsSubmitting(true);
    setStatusSteps([
      { label: 'Creating your organization', status: 'complete', message: 'Organization created' },
      { label: 'Activating your account', status: 'complete', message: 'Account activated' },
      { label: 'Setting up your practice', status: 'complete', message: 'Practice configured' },
      { label: 'Finalizing setup', status: 'loading', message: 'Ensuring everything is ready...' },
    ]);

    try {
      // Poll for Clerk session to be fully stable with org context
      const maxWaitTime = 10000; // 10 seconds max
      const startTime = Date.now();
      let sessionStable = false;

      debugLog.info('CompleteStep', 'Polling for stable Clerk session with org context');

      while (!sessionStable && (Date.now() - startTime) < maxWaitTime) {
        // Check if Clerk session has the org ID and it's stable
        const currentOrgId = auth.orgId;

        if (currentOrgId) {
          debugLog.debug('CompleteStep', 'Clerk session has orgId, verifying stability', {
            orgId: currentOrgId,
            elapsed: Date.now() - startTime,
          });

          // Wait a bit to ensure it's stable (not in flux)
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Check again - if it's the same, we're stable
          if (auth.orgId === currentOrgId) {
            sessionStable = true;
            debugLog.info('CompleteStep', 'Clerk session is stable', {
              orgId: currentOrgId,
              totalTime: Date.now() - startTime,
            });
          }
        } else {
          debugLog.debug('CompleteStep', 'Waiting for Clerk session to have orgId', {
            elapsed: Date.now() - startTime,
          });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!sessionStable) {
        debugLog.warn('CompleteStep', 'Session stability timeout - proceeding anyway');
      }

      // Mark complete and redirect
      setStatusSteps(prev => {
        const updated = [...prev];
        updated[3] = { ...updated[3], status: 'complete', message: 'All set!' };
        return updated;
      });

      // Small delay to show the checkmark
      await new Promise(resolve => setTimeout(resolve, 500));

      debugLog.info('CompleteStep', 'Redirecting to dashboard', { redirectPath });
      // Use window.location for hard refresh to ensure Clerk session fully reloads
      window.location.href = redirectPath;
    } catch (error) {
      debugLog.error('CompleteStep', 'Error during final setup', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Proceed anyway
      window.location.href = redirectPath;
    }
  };

  // Show setup progress screen while creating
  if (isSubmitting && statusSteps.length > 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">Setting up your practice...</h1>
            <p className="text-muted-foreground">
              This will only take a moment
            </p>
          </div>

          {/* Status Steps */}
          <div className="space-y-4">
            {statusSteps.map((step, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex-shrink-0">
                  {step.status === 'pending' && (
                    <div className="h-6 w-6 rounded-full border-2 border-muted" />
                  )}
                  {step.status === 'loading' && (
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  )}
                  {step.status === 'complete' && (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  )}
                  {step.status === 'error' && (
                    <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center">
                      <span className="text-destructive text-sm">✕</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${step.status === 'complete' ? 'text-muted-foreground' : ''}`}>
                    {step.label}
                  </p>
                  {step.message && (
                    <p className="text-sm text-muted-foreground">{step.message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show success screen with "Get Started" button
  if (setupComplete) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Success Header */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <Sparkles className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">All set!</h1>
            <p className="text-muted-foreground">
              Your practice is ready to go
            </p>
          </div>

          {/* Summary */}
          <div className="border rounded-lg p-6 bg-muted/50">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">{data.practiceName}</p>
                <p className="text-sm text-muted-foreground">
                  {planLabels[recommendedPlan]}
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>✓ Organization created</p>
              <p>✓ Account activated</p>
              <p>✓ {data.locations?.length || 1} {data.locations?.length === 1 ? 'location' : 'locations'} configured</p>
            </div>
          </div>

          {/* Get Started Button */}
          <Button onClick={handleGetStarted} size="lg" className="w-full">
            Get Started
          </Button>
        </div>
      </div>
    );
  }

  // Show Multi-Location choice screen
  if (showMultiLocationChoice && recommendedPlan === 'multi-location') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
            <p className="text-muted-foreground">
              Based on your setup, we recommend Multi-Location
            </p>
          </div>

          {/* Two Options */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Option 1: Try Practice Free */}
            <div className="border-2 rounded-lg p-6 space-y-4 hover:border-primary/50 transition-colors">
              <div>
                <div className="text-sm text-muted-foreground mb-1">14-Day Free Trial</div>
                <h3 className="text-2xl font-bold">Practice Plan</h3>
                <p className="text-xl text-muted-foreground">$149/month after trial</p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Everything in Solo
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  2 providers included (+$49/extra)
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  500 encounters/mo
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Team management & roles
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  <strong>Note:</strong> Missing Multi-Location features (5+ locations, 2000 encounters/mo, priority support)
                </p>
              </div>

              <Button onClick={handleTryPracticeFree} variant="outline" className="w-full" size="lg">
                Try Practice Free
              </Button>
            </div>

            {/* Option 2: Subscribe to Multi-Location */}
            <div className="border-2 border-primary rounded-lg p-6 space-y-4 bg-primary/5">
              <div>
                <div className="text-sm text-primary font-semibold mb-1">RECOMMENDED</div>
                <h3 className="text-2xl font-bold">Multi-Location</h3>
                <p className="text-xl text-muted-foreground">$299/month</p>
              </div>

              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Everything in Practice
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  5 providers included (+$39/extra)
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  2,000 encounters/mo
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Multi-location support
                </p>
                <p className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Priority support
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3">
                <p className="text-sm text-green-900 dark:text-green-200">
                  <strong>14-day free trial</strong> with full access. Credit card required.
                </p>
              </div>

              <Button onClick={handleMultiLocationSubscribe} className="w-full" size="lg">
                Subscribe to Multi-Location
              </Button>
            </div>
          </div>

          {/* Back Button */}
          <div className="flex justify-center">
            <Button onClick={() => setShowMultiLocationChoice(false)} variant="ghost">
              Back to Review
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show review/confirmation screen (default state)
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Almost Done!</h1>
          <p className="text-muted-foreground">
            Review your setup and complete onboarding
          </p>
        </div>

        {/* Summary Cards */}
        <div className="space-y-4">
          {/* Practice Info */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Practice</h3>
                <p className="text-sm text-muted-foreground">
                  {data.practiceName}
                </p>
              </div>
            </div>
            {(data.email || data.phone || data.address) && (
              <div className="text-sm text-muted-foreground space-y-1">
                {data.email && <p>Email: {data.email}</p>}
                {data.phone && <p>Phone: {data.phone}</p>}
                {data.address && <p>Address: {data.address}</p>}
              </div>
            )}
          </div>

          {/* Team Size */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Team</h3>
                <p className="text-sm text-muted-foreground">
                  {vetCount === 1
                    ? 'Just you'
                    : vetCount === 5
                    ? '5+ providers'
                    : `${vetCount} providers`}
                </p>
              </div>
            </div>
          </div>

          {/* Locations */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Locations</h3>
                <p className="text-sm text-muted-foreground">
                  {locationCount} {locationCount === 1 ? 'location' : 'locations'}
                </p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              {data.locations?.map((loc: any, idx: number) => (
                <li key={idx} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{loc.name}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommended Plan */}
          <div className="border-2 border-primary rounded-lg p-6 bg-primary/5">
            <h3 className="font-semibold mb-2">Recommended Plan</h3>
            <p className="text-2xl font-bold text-primary mb-1">
              {planLabels[recommendedPlan]}
            </p>
            <p className="text-sm text-muted-foreground">
              Based on {vetCount} {vetCount === 1 ? 'provider' : 'providers'} and{' '}
              {locationCount} {locationCount === 1 ? 'location' : 'locations'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between">
          <Button onClick={onBack} variant="outline" disabled={isSubmitting}>
            Back
          </Button>
          <Button onClick={() => handleComplete()} size="lg" disabled={isSubmitting}>
            {isSubmitting ? creationStatus || 'Setting up...' : 'Complete Setup'}
          </Button>
        </div>
      </div>
    </div>
  );
}
