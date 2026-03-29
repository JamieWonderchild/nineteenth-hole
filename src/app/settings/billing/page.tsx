'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { UsageMeter } from '@/components/billing/UsageMeter';
import { PricingTable } from '@/components/billing/PricingTable';
import { DowngradeWarningModal } from '@/components/billing/DowngradeWarningModal';
import { PostUpgradeWizard } from '@/components/upgrade/PostUpgradeWizard';
import { PLAN_CONFIGS } from '@/types/billing';
import type { PlanTier } from '@/types/billing';
import {
  CreditCard,
  ExternalLink,
  Check,
  Loader2,
  ArrowLeft,
  Shield,
  Plus,
  Minus,
  Users,
} from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { useUser } from '@clerk/nextjs';
import { isSuperadmin } from '@/lib/superadmin';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { orgContext, isLoading: orgLoading } = useOrgCtx();
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [portalLoading, setPortalLoading] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [adminPlanLoading, setAdminPlanLoading] = React.useState<string | null>(null);
  const [downgradeTarget, setDowngradeTarget] = React.useState<PlanTier | null>(null);
  const [showWizard, setShowWizard] = React.useState(false);
  const [seatTarget, setSeatTarget] = React.useState<number | null>(null);
  const [seatLoading, setSeatLoading] = React.useState(false);
  const [seatError, setSeatError] = React.useState<string | null>(null);
  const [showSeatConfirm, setShowSeatConfirm] = React.useState(false);

  const updateOrgPlan = useMutation(api.admin.updateOrgPlan);
  const markPlanUpgrade = useMutation(api.upgrade.markPlanUpgrade);

  const isAdmin = isSuperadmin(user?.primaryEmailAddress?.emailAddress);

  const usage = useQuery(
    api.usage.getCurrentUsage,
    orgContext ? { orgId: orgContext.orgId as Id<"organizations"> } : 'skip'
  );

  const seatCount = useQuery(
    api.memberships.countActiveSeats,
    orgContext ? { orgId: orgContext.orgId as Id<"organizations"> } : 'skip'
  );

  const upgradeState = useQuery(
    api.upgrade.getUpgradeState,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const success = searchParams.get('success') === 'true';
  const canceled = searchParams.get('canceled') === 'true';

  // Auto-show wizard when upgrade to multi-location is detected
  React.useEffect(() => {
    if (upgradeState?.showWizard && !showWizard) {
      setShowWizard(true);
    }
  }, [upgradeState?.showWizard, showWizard]);

  const handleCheckout = async (plan: PlanTier) => {
    if (!orgContext) return;

    // Check if this is a downgrade
    const planOrder = { solo: 1, practice: 2, 'multi-location': 3 };
    const isDowngrade = planOrder[plan] < planOrder[orgContext.plan];

    // If downgrade, show warning modal first
    if (isDowngrade) {
      setDowngradeTarget(plan);
      return;
    }

    // If upgrade, proceed and mark upgrade
    await proceedWithCheckout(plan);
  };

  const proceedWithCheckout = async (plan: PlanTier) => {
    if (!orgContext) return;

    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      // If existing subscription, update inline instead of creating new checkout
      if (orgContext.stripeSubscriptionId) {
        const response = await fetch('/api/stripe/update-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });

        const data = await response.json();
        if (data.success) {
          // Mark upgrade for wizard trigger
          const planOrder = { solo: 1, practice: 2, 'multi-location': 3 };
          const isUpgrade = planOrder[plan] > planOrder[orgContext.plan];

          if (isUpgrade) {
            await markPlanUpgrade({
              orgId: orgContext.orgId as Id<'organizations'>,
              fromPlan: orgContext.plan,
              toPlan: plan,
            });
          }

          // Redirect to billing page with success message
          window.location.href = '/settings/billing?success=true';
        } else {
          setCheckoutError(data.error || 'Failed to update subscription.');
        }
      } else {
        // No subscription - create new via checkout
        const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          setCheckoutError(data.error || 'Failed to start checkout. Stripe may not be configured yet.');
        }
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setCheckoutError('Failed to connect to payment service.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpdateSeats = async () => {
    if (!orgContext || seatTarget === null) return;
    setSeatLoading(true);
    setSeatError(null);
    try {
      const response = await fetch('/api/stripe/update-seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalSeats: seatTarget }),
      });
      const data = await response.json();
      if (data.success) {
        setSeatTarget(null);
        window.location.href = '/settings/billing?success=true';
      } else {
        setSeatError(data.error || 'Failed to update seats.');
      }
    } catch {
      setSeatError('Failed to connect to payment service.');
    } finally {
      setSeatLoading(false);
    }
  };

  const handleAdminPlanChange = async (plan: PlanTier) => {
    if (!orgContext || !user?.primaryEmailAddress?.emailAddress) return;

    setAdminPlanLoading(plan);
    try {
      // Update plan via admin mutation
      await updateOrgPlan({
        orgId: orgContext.orgId as Id<'organizations'>,
        plan,
        callerEmail: user.primaryEmailAddress.emailAddress,
      });

      // Mark upgrade to trigger wizard (if it's an upgrade)
      const planOrder = { solo: 1, practice: 2, 'multi-location': 3 };
      const isUpgrade = planOrder[plan] > planOrder[orgContext.plan];

      if (isUpgrade) {
        await markPlanUpgrade({
          orgId: orgContext.orgId as Id<'organizations'>,
          fromPlan: orgContext.plan,
          toPlan: plan,
        });
      }

      // Refresh the page to show updated plan and trigger wizard
      window.location.reload();
    } catch (err) {
      console.error('Admin plan update error:', err);
      alert(`Failed to update plan: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setAdminPlanLoading(null);
    }
  };

  if (orgLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const planConfig = orgContext
    ? PLAN_CONFIGS[orgContext.plan]
    : null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <AppLink
            href="/settings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Settings
          </AppLink>
          <h1 className="text-2xl font-bold">Billing & Usage</h1>
          <p className="text-muted-foreground mt-1">
            Manage your subscription and monitor usage
          </p>
        </div>

        {/* Success/Cancel messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
            <Check className="h-5 w-5" />
            Subscription updated successfully!
          </div>
        )}
        {canceled && (
          <div className="mb-6 p-4 bg-amber-50 text-amber-700 rounded-lg">
            Checkout was canceled. No changes were made.
          </div>
        )}

        {/* Super Admin Plan Override */}
        {isAdmin && orgContext && (
          <div className="mb-8 p-6 rounded-xl border-2 border-purple-500 bg-purple-50/50 dark:bg-purple-950/20">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                Admin Plan Override
              </h2>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
              Bypass Stripe and instantly switch this organization&apos;s plan
            </p>
            <div className="flex gap-3">
              {(['solo', 'practice', 'multi-location'] as const).map((plan) => (
                <button
                  key={plan}
                  onClick={() => handleAdminPlanChange(plan)}
                  disabled={adminPlanLoading !== null}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all disabled:opacity-50 ${
                    orgContext.plan === plan
                      ? 'border-purple-600 bg-purple-600 text-white'
                      : 'border-purple-200 bg-white hover:border-purple-400 text-purple-900 dark:bg-purple-950/40 dark:border-purple-700 dark:text-purple-100'
                  }`}
                >
                  {adminPlanLoading === plan ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    <>
                      {PLAN_CONFIGS[plan].name}
                      {orgContext.plan === plan && (
                        <span className="ml-2">✓</span>
                      )}
                    </>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-3">
              This updates Convex directly without touching Stripe. Use this for testing or manual overrides.
            </p>
          </div>
        )}

        {/* Current Plan */}
        {orgContext && planConfig && (
          <div className="mb-8 p-6 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {planConfig.name} Plan
                </h2>
                <p className="text-sm text-muted-foreground">
                  ${planConfig.price + Math.max(0, orgContext.maxProviderSeats - planConfig.includedSeats) * (planConfig.extraSeatPrice ?? 0)}/month
                  {orgContext.billingStatus === 'trialing' && (
                    <span className="ml-2 text-green-600 font-medium">
                      Free trial
                    </span>
                  )}
                </p>
              </div>
              {orgContext.stripeSubscriptionId && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Manage Subscription
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm mb-4">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{orgContext.billingStatus}</span>
              {seatCount !== undefined && (
                <span className="text-muted-foreground">
                  &middot; {seatCount}/{orgContext.maxProviderSeats} seats
                </span>
              )}
            </div>

            {/* Usage Meters */}
            {usage && (
              <div className="space-y-4 pt-4 border-t border-border">
                <UsageMeter
                  label="Encounters"
                  used={usage.encounters}
                  limit={planConfig.consultationLimit}
                />
                <UsageMeter
                  label="Companion Sessions"
                  used={usage.companions}
                  limit={planConfig.companionLimit}
                />
                <UsageMeter
                  label="Documents Generated"
                  used={usage.documents}
                  limit={null}
                />
              </div>
            )}

            {/* Seat Management */}
            {orgContext.stripeSubscriptionId && planConfig.extraSeatPrice && (() => {
              const current = seatTarget ?? orgContext.maxProviderSeats;
              const min = planConfig.includedSeats;
              const extraSeats = current - min;
              const monthlyCost = extraSeats * planConfig.extraSeatPrice;
              const isDirty = seatTarget !== null && seatTarget !== orgContext.maxProviderSeats;
              return (
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Provider Seats</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSeatTarget(Math.max(min, current - 1))}
                        disabled={current <= min || seatLoading}
                        className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center font-semibold tabular-nums">{current}</span>
                      <button
                        onClick={() => setSeatTarget(current + 1)}
                        disabled={seatLoading}
                        className="h-8 w-8 rounded-md border border-border flex items-center justify-center hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {min} included
                      {extraSeats > 0 && (
                        <span> + {extraSeats} extra · <span className="font-medium text-foreground">${monthlyCost}/mo</span></span>
                      )}
                    </div>
                    {isDirty && (
                      <button
                        onClick={() => setShowSeatConfirm(true)}
                        disabled={seatLoading}
                        className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        Update seats
                      </button>
                    )}
                  </div>
                  {seatError && (
                    <p className="text-sm text-destructive">{seatError}</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Pricing Table */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {orgContext?.stripeSubscriptionId
              ? 'Change Plan'
              : 'Choose a Plan'}
          </h2>
          {checkoutError && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
              {checkoutError}
            </div>
          )}
          <PricingTable
            currentPlan={orgContext?.plan}
            onSelectPlan={handleCheckout}
            loading={checkoutLoading}
          />
        </div>
      </div>

      {/* Seat Update Confirmation */}
      {showSeatConfirm && orgContext && planConfig && seatTarget !== null && (() => {
        const prevExtra = Math.max(0, orgContext.maxProviderSeats - planConfig.includedSeats);
        const newExtra = Math.max(0, seatTarget - planConfig.includedSeats);
        const prevCost = prevExtra * (planConfig.extraSeatPrice ?? 0);
        const newCost = newExtra * (planConfig.extraSeatPrice ?? 0);
        const diff = newCost - prevCost;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
              <h2 className="text-lg font-semibold mb-1">Confirm seat change</h2>
              <p className="text-sm text-muted-foreground mb-4">
                You&apos;re changing from {orgContext.maxProviderSeats} to {seatTarget} seats.
              </p>
              <div className="bg-muted rounded-lg p-4 text-sm space-y-1 mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base plan</span>
                  <span>${planConfig.price}/mo</span>
                </div>
                {newExtra > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{newExtra} extra seat{newExtra > 1 ? 's' : ''}</span>
                    <span>${newCost}/mo</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-border pt-2 mt-2">
                  <span>New total</span>
                  <span>${planConfig.price + newCost}/mo</span>
                </div>
              </div>
              {diff !== 0 && (
                <p className="text-sm text-muted-foreground mb-4">
                  {diff > 0
                    ? `You'll be charged an additional $${diff}/month, prorated immediately.`
                    : `Your subscription will decrease by $${Math.abs(diff)}/month.`}
                </p>
              )}
              {seatError && (
                <p className="text-sm text-destructive mb-3">{seatError}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowSeatConfirm(false); setSeatError(null); }}
                  disabled={seatLoading}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSeats}
                  disabled={seatLoading}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {seatLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirm
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Downgrade Warning Modal */}
      {downgradeTarget && orgContext && (
        <DowngradeWarningModal
          orgId={orgContext.orgId as Id<'organizations'>}
          currentPlan={orgContext.plan}
          targetPlan={downgradeTarget}
          open={!!downgradeTarget}
          onConfirm={() => {
            proceedWithCheckout(downgradeTarget);
            setDowngradeTarget(null);
          }}
          onCancel={() => setDowngradeTarget(null)}
        />
      )}

      {/* Post-Upgrade Wizard Modal */}
      {showWizard && orgContext && user && (
        <PostUpgradeWizard
          orgId={orgContext.orgId as Id<'organizations'>}
          userId={user.id}
          onClose={() => setShowWizard(false)}
        />
      )}
    </Layout>
  );
}
