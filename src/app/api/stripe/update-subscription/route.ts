import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripe, getPriceId } from '@/lib/stripe';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import type { PlanTier } from '@/types/billing';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId: clerkOrgId } = await auth();

    if (!userId || !clerkOrgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body as { plan: PlanTier };

    if (!plan || !['solo', 'practice', 'multi-location'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Get organization from Convex
    const org = await convex.query(api.organizations.getByClerkOrg, {
      clerkOrgId,
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Check if this is a downgrade and validate constraints
    const planOrder = { solo: 1, practice: 2, 'multi-location': 3 };
    const isDowngrade = planOrder[plan] < planOrder[org.plan as PlanTier];

    if (isDowngrade) {
      const validation = await convex.query(api.upgrade.validatePlanDowngrade, {
        orgId: org._id,
        targetPlan: plan,
      });

      if (!validation.allowed) {
        return NextResponse.json(
          {
            error: 'Cannot downgrade: constraints not met',
            reasons: validation.reasons,
            impact: validation.impact,
          },
          { status: 400 }
        );
      }
    }

    // Retrieve current subscription
    const subscription = await getStripe().subscriptions.retrieve(
      org.stripeSubscriptionId
    );

    // Find the main plan line item
    const planItem = subscription.items.data[0];
    if (!planItem) {
      return NextResponse.json(
        { error: 'No subscription items found' },
        { status: 500 }
      );
    }

    // Update subscription with new plan price
    const newPriceId = getPriceId(plan);
    await getStripe().subscriptions.update(org.stripeSubscriptionId, {
      items: [
        {
          id: planItem.id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'always_invoice',
      metadata: {
        orgId: org._id,
        plan,
      },
    });

    // Mark plan change in Convex (for upgrade wizard trigger)
    const isUpgrade = planOrder[plan] > planOrder[org.plan as PlanTier];
    if (isUpgrade) {
      await convex.mutation(api.upgrade.markPlanUpgrade, {
        orgId: org._id,
        fromPlan: org.plan,
        toPlan: plan,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription update error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update subscription',
      },
      { status: 500 }
    );
  }
}
