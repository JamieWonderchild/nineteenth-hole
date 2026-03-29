'use client';

import React from 'react';
import { AppLink } from '@/components/navigation/AppLink';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { AlertTriangle, CreditCard } from 'lucide-react';

interface BillingGuardProps {
  children: React.ReactNode;
  feature?: string;
}

export function BillingGuard({ children, feature }: BillingGuardProps) {
  const { orgContext, isLoading } = useOrgCtx();

  if (isLoading) return <>{children}</>;

  // No org context = no guard needed (maybe onboarding)
  if (!orgContext) return <>{children}</>;

  // Active billing = allow access
  if (orgContext.canUseFeatures) return <>{children}</>;

  const statusMessages: Record<string, { title: string; message: string }> = {
    trialing: {
      title: 'Free Trial Expired',
      message:
        'Your 14-day free trial has ended. Choose a plan to continue using [PRODUCT_NAME].',
    },
    canceled: {
      title: 'Subscription Canceled',
      message:
        'Your subscription has been canceled. Reactivate to continue using [PRODUCT_NAME].',
    },
    past_due: {
      title: 'Payment Past Due',
      message:
        'Your payment is past due. Please update your payment method to continue.',
    },
    unpaid: {
      title: 'Payment Required',
      message:
        'Your account has an unpaid balance. Please update your payment method.',
    },
    incomplete: {
      title: 'Setup Incomplete',
      message:
        'Your subscription setup is incomplete. Please complete the payment process.',
    },
  };

  const status =
    statusMessages[orgContext.billingStatus] || statusMessages.canceled;

  return (
    <div className="flex items-center justify-center min-h-[300px] p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold">{status.title}</h2>
        <p className="text-sm text-muted-foreground">{status.message}</p>
        {feature && (
          <p className="text-xs text-muted-foreground">
            This feature ({feature}) requires an active subscription.
          </p>
        )}
        {orgContext.canManageBilling && (
          <AppLink
            href="/settings/billing"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Manage Billing
          </AppLink>
        )}
      </div>
    </div>
  );
}
