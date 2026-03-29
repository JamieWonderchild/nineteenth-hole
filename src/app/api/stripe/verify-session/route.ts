import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripe } from '@/lib/stripe';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // Retrieve the Stripe session
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    // Check if this was an onboarding session
    if (session.metadata?.onboarding !== 'true') {
      return NextResponse.json({ error: 'Not an onboarding session' }, { status: 400 });
    }

    // Check if user has membership in an org (indicating successful creation)
    const memberships = await convex.query(api.memberships.getByUser, {
      userId,
    });

    // If user has any active memberships, the org was created
    const hasActiveMembership = memberships && memberships.length > 0;

    return NextResponse.json({
      orgCreated: hasActiveMembership,
      paymentStatus: session.payment_status,
    });
  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
