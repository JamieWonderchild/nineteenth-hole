import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripe, getExtraSeatPriceId, updateSubscriptionSeats } from '@/lib/stripe';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { PLAN_CONFIGS } from '@/types/billing';
import type { PlanTier } from '@/types/billing';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId: clerkOrgId } = await auth();
    if (!userId || !clerkOrgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { totalSeats } = body as { totalSeats: number };

    if (!totalSeats || typeof totalSeats !== 'number' || totalSeats < 1) {
      return NextResponse.json({ error: 'Invalid seat count' }, { status: 400 });
    }

    const org = await convex.query(api.organizations.getByClerkOrg, { clerkOrgId });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }

    const membership = await convex.query(api.memberships.getByOrgAndUser, {
      orgId: org._id,
      userId,
    });
    if (!membership || !['owner', 'admin'].includes(membership.role) || membership.status !== 'active') {
      return NextResponse.json({ error: 'Only owners and admins can manage seats' }, { status: 403 });
    }

    const plan = org.plan as PlanTier;
    const planConfig = PLAN_CONFIGS[plan];

    if (!planConfig.extraSeatPrice) {
      return NextResponse.json({ error: 'This plan does not support extra seats' }, { status: 400 });
    }

    if (totalSeats < planConfig.includedSeats) {
      return NextResponse.json(
        { error: `Minimum ${planConfig.includedSeats} seats for ${planConfig.name} plan` },
        { status: 400 }
      );
    }

    const extraSeats = totalSeats - planConfig.includedSeats;
    const seatPriceId = getExtraSeatPriceId(plan);

    if (extraSeats === 0) {
      // Remove extra seat line item if it exists
      const subscription = await getStripe().subscriptions.retrieve(org.stripeSubscriptionId);
      const seatItem = subscription.items.data.find((item) => item.price.id === seatPriceId);
      if (seatItem) {
        await getStripe().subscriptions.update(org.stripeSubscriptionId, {
          items: [{ id: seatItem.id, deleted: true }],
          proration_behavior: 'always_invoice',
        });
      }
    } else {
      await updateSubscriptionSeats({
        subscriptionId: org.stripeSubscriptionId,
        plan,
        newSeatCount: extraSeats,
      });
    }

    return NextResponse.json({ success: true, totalSeats });
  } catch (error) {
    console.error('Update seats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update seats' },
      { status: 500 }
    );
  }
}
