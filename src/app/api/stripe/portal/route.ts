import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import { createPortalSession } from '@/lib/stripe';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId: clerkOrgId } = await auth();
    if (!userId || !clerkOrgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (!org.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe first.' },
        { status: 400 }
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

    const session = await createPortalSession({
      stripeCustomerId: org.stripeCustomerId,
      returnUrl: `${origin}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
