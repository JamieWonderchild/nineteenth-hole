import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { createCheckoutSession, getStripe } from '@/lib/stripe';
import type { PlanTier } from '@/types/billing';
import { PLAN_CONFIGS } from '@/types/billing';
import type { Id } from 'convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// GET: Pre-onboarding checkout (no org yet)
// Used when user chooses Multi-Location during onboarding
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const plan = searchParams.get('plan') as PlanTier;
    const practiceName = searchParams.get('practiceName') || 'My Practice';

    if (!plan || plan !== 'multi-location') {
      return NextResponse.json(
        { error: 'Only Multi-Location plan requires upfront payment' },
        { status: 400 }
      );
    }

    const config = PLAN_CONFIGS[plan];
    const origin = request.headers.get('origin') || request.nextUrl.origin;

    // Get Stripe price ID from environment
    const stripePriceId = process.env.STRIPE_PRICE_MULTI;
    if (!stripePriceId) {
      throw new Error('Stripe price ID not configured for Multi-Location plan');
    }

    // Create Stripe checkout session with metadata for org creation
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14, // 14-day trial even with card required
        metadata: {
          plan,
          userId,
          practiceName,
          onboarding: 'true', // Flag to create org in webhook
        },
      },
      metadata: {
        plan,
        userId,
        practiceName,
        onboarding: 'true',
      },
      success_url: `${origin}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/onboarding`,
      client_reference_id: userId,
    });

    return NextResponse.redirect(session.url!);
  } catch (error) {
    console.error('Onboarding checkout (GET) error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      stripePriceId: process.env.STRIPE_PRICE_MULTI,
    });
    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : String(error),
        debug: {
          hasPriceId: !!process.env.STRIPE_PRICE_MULTI,
          priceIdLength: process.env.STRIPE_PRICE_MULTI?.length,
        }
      },
      { status: 500 }
    );
  }
}

// POST: Existing org checkout
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { clerkOrgId, plan, convexOrgId } = body as {
      clerkOrgId: string;
      plan: PlanTier;
      convexOrgId: string;
    };

    if (!clerkOrgId || !plan || !convexOrgId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!PLAN_CONFIGS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Look up Convex org
    const org = await convex.query(api.organizations.getByClerkOrg, {
      clerkOrgId,
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Verify user is owner
    const membership = await convex.query(api.memberships.getByOrgAndUser, {
      orgId: org._id as Id<"organizations">,
      userId,
    });

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the organization owner can set up billing' },
        { status: 403 }
      );
    }

    const origin = request.headers.get('origin') || '';

    const session = await createCheckoutSession({
      plan,
      orgId: convexOrgId,
      stripeCustomerId: org.stripeCustomerId,
      successUrl: `${origin}/?onboarding=success`,
      cancelUrl: `${origin}/settings/billing?onboarding=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Onboarding checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
