import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPlanFromSubscription, calculateMaxSeats } from '@/lib/stripe';
import { ConvexHttpClient } from 'convex/browser';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { PLAN_CONFIGS } from '@/types/billing';
import type { PlanTier } from '@/types/billing';
import type Stripe from 'stripe';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

    // Idempotency: skip if already processed
    const isNew = await convex.mutation(api.webhookEvents.checkAndRecord, {
      eventId: event.id,
      source: 'stripe',
    });
    if (!isNew) {
      console.log(`[StripeWebhook] Skipping duplicate event: ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true });
    }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        const onboarding = session.metadata?.onboarding === 'true';

        if (onboarding) {
          // Onboarding flow: Create Clerk org + Convex org after payment
          const userId = session.metadata?.userId;
          const practiceName = session.metadata?.practiceName || 'My Practice';
          const plan = session.metadata?.plan as PlanTier || 'multi-location';

          if (!userId || !session.customer || !session.subscription) {
            console.error('[StripeWebhook] Missing required fields for onboarding:', { userId, customer: session.customer, subscription: session.subscription });
            break;
          }

          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          const maxProviderSeats = calculateMaxSeats(subscription);
          const customerId = typeof session.customer === 'string'
            ? session.customer
            : session.customer.id;

          try {
            // 1. Create Clerk organization
            const clerkResponse = await fetch('https://api.clerk.com/v1/organizations', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: practiceName,
                created_by: userId,
              }),
            });

            if (!clerkResponse.ok) {
              const error = await clerkResponse.text();
              console.error('[StripeWebhook] Failed to create Clerk org:', error);
              break;
            }

            const clerkOrg = await clerkResponse.json();
            const clerkOrgId = clerkOrg.id;

            // 2. Generate unique slug
            const baseSlug = practiceName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
            const slug = `${baseSlug}-${Date.now().toString(36)}`;

            // 3. Create Convex organization with billing details
            const convexOrgId = await convex.mutation(api.organizations.create, {
              name: practiceName,
              slug,
              clerkOrgId,
              plan,
              maxProviderSeats,
              billingStatus: subscription.status === 'trialing' ? 'trialing' : 'active',
              trialEndsAt: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : undefined,
            });

            // 4. Update billing with Stripe details
            await convex.mutation(api.organizations.updateBilling, {
              id: convexOrgId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
            });

            // 5. Add user as owner
            await convex.mutation(api.memberships.create, {
              orgId: convexOrgId,
              userId,
              role: 'owner',
              status: 'active',
            });

            // 6. Update Stripe subscription metadata with orgId for future webhooks
            await getStripe().subscriptions.update(subscriptionId, {
              metadata: {
                orgId: convexOrgId,
                plan,
              },
            });

            console.log('[StripeWebhook] Successfully created org via onboarding:', {
              clerkOrgId,
              convexOrgId,
              plan,
              userId,
            });
          } catch (error) {
            console.error('[StripeWebhook] Onboarding org creation failed:', error);
            throw error;
          }
        } else if (orgId && session.customer && session.subscription) {
          // Existing org flow: Update billing
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          const plan = getPlanFromSubscription(subscription);
          const maxProviderSeats = calculateMaxSeats(subscription);

          await convex.mutation(api.organizations.updateBilling, {
            id: orgId as Id<"organizations">,
            stripeCustomerId:
              typeof session.customer === 'string'
                ? session.customer
                : session.customer.id,
            stripeSubscriptionId: subscriptionId,
            billingStatus: 'active',
            plan: plan || undefined,
            maxProviderSeats,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.orgId;

        if (orgId) {
          // Validate plan from Price IDs and calculate seats
          const plan = getPlanFromSubscription(subscription);
          const maxProviderSeats = calculateMaxSeats(subscription);
          const billingStatus = mapSubscriptionStatus(subscription.status);

          await convex.mutation(api.organizations.updateBilling, {
            id: orgId as Id<"organizations">,
            billingStatus,
            plan: plan || undefined,
            maxProviderSeats, // CRITICAL: Update seats on plan changes
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.orgId;

        if (orgId) {
          await convex.mutation(api.organizations.updateBilling, {
            id: orgId as Id<"organizations">,
            billingStatus: 'canceled',
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          const customerId =
            typeof invoice.customer === 'string'
              ? invoice.customer
              : invoice.customer.id;

          // Look up org by Stripe customer
          const org = await convex.query(
            api.organizations.getByStripeCustomer,
            { stripeCustomerId: customerId }
          );

          if (org && org.billingStatus === 'past_due') {
            await convex.mutation(api.organizations.updateBilling, {
              id: org._id,
              billingStatus: 'active',
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          const customerId =
            typeof invoice.customer === 'string'
              ? invoice.customer
              : invoice.customer.id;

          const org = await convex.query(
            api.organizations.getByStripeCustomer,
            { stripeCustomerId: customerId }
          );

          if (org) {
            await convex.mutation(api.organizations.updateBilling, {
              id: org._id,
              billingStatus: 'past_due',
            });
          }
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.orgId;
        if (orgId) {
          // TODO: trigger email notification for trial ending
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

function mapSubscriptionStatus(
  status: Stripe.Subscription.Status
): string {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'unpaid';
    case 'incomplete':
      return 'incomplete';
    default:
      return 'active';
  }
}
