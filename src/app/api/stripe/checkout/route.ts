import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { createCheckoutSession } from '@/lib/stripe';
import { validateStripeConfig } from '@/lib/stripe-config';
import type { PlanTier } from '@/types/billing';
import { PLAN_CONFIGS } from '@/types/billing';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    // Validate Stripe configuration
    const stripeConfig = validateStripeConfig();
    if (!stripeConfig.isConfigured) {
      console.error('[Stripe] Missing configuration:', stripeConfig.missing);
      return NextResponse.json(
        { error: 'Payment system is not configured. Please contact support.' },
        { status: 503 }
      );
    }

    const { userId, orgId: clerkOrgId } = await auth();
    if (!userId || !clerkOrgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { plan, extraSeats } = body as {
      plan: PlanTier;
      extraSeats?: number;
    };

    if (!plan || !PLAN_CONFIGS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Get org from Convex
    const org = await convex.query(api.organizations.getByClerkOrg, {
      clerkOrgId,
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Verify user is owner or admin
    const membership = await convex.query(api.memberships.getByOrgAndUser, {
      orgId: org._id,
      userId,
    });

    if (
      !membership ||
      !['owner', 'admin'].includes(membership.role) ||
      membership.status !== 'active'
    ) {
      return NextResponse.json(
        { error: 'Only owners and admins can manage billing' },
        { status: 403 }
      );
    }

    const origin = request.headers.get('origin') || '';

    const session = await createCheckoutSession({
      plan,
      orgId: org._id,
      stripeCustomerId: org.stripeCustomerId,
      successUrl: `${origin}/settings/billing?success=true`,
      cancelUrl: `${origin}/settings/billing?canceled=true`,
      extraSeats,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  const config = validateStripeConfig();
  return NextResponse.json({
    status: config.isConfigured ? 'ok' : 'unconfigured',
    mode: config.mode,
    warnings: config.warnings,
    // Don't expose missing var names in production
    ...(config.mode === 'test' ? { missing: config.missing } : {}),
  });
}
