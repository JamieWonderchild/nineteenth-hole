import Stripe from 'stripe';
import type { PlanTier } from '@/types/billing';
import { PLAN_CONFIGS } from '@/types/billing';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

// Map plan tiers to Stripe Price IDs
const PRICE_IDS: Record<PlanTier, string> = {
  solo: process.env.STRIPE_PRICE_SOLO || '',
  practice: process.env.STRIPE_PRICE_PRACTICE || '',
  'multi-location': process.env.STRIPE_PRICE_MULTI || '',
};

const EXTRA_SEAT_PRICE_IDS: Partial<Record<PlanTier, string>> = {
  practice: process.env.STRIPE_PRICE_EXTRA_SEAT_PRACTICE || '',
  'multi-location': process.env.STRIPE_PRICE_EXTRA_SEAT_MULTI || '',
};

// Reverse mapping: Price ID → Plan Tier (for validation)
const PRICE_TO_PLAN: Record<string, PlanTier> = {
  [process.env.STRIPE_PRICE_SOLO || '']: 'solo',
  [process.env.STRIPE_PRICE_PRACTICE || '']: 'practice',
  [process.env.STRIPE_PRICE_MULTI || '']: 'multi-location',
};

export function getPriceId(plan: PlanTier): string {
  return PRICE_IDS[plan];
}

export function getExtraSeatPriceId(plan: PlanTier): string | undefined {
  return EXTRA_SEAT_PRICE_IDS[plan];
}

export async function createCheckoutSession({
  plan,
  orgId,
  stripeCustomerId,
  successUrl,
  cancelUrl,
  extraSeats,
}: {
  plan: PlanTier;
  orgId: string;
  stripeCustomerId?: string;
  successUrl: string;
  cancelUrl: string;
  extraSeats?: number;
}): Promise<Stripe.Checkout.Session> {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price: getPriceId(plan),
      quantity: 1,
    },
  ];

  // Add extra seat line item if applicable
  const seatPriceId = getExtraSeatPriceId(plan);
  if (seatPriceId && extraSeats && extraSeats > 0) {
    lineItems.push({
      price: seatPriceId,
      quantity: extraSeats,
    });
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      orgId,
      plan,
    },
    subscription_data: {
      metadata: {
        orgId,
        plan,
      },
      // 14-day free trial for practice tier
      ...(plan === 'practice' ? { trial_period_days: 14 } : {}),
    },
  };

  if (stripeCustomerId) {
    params.customer = stripeCustomerId;
  }

  return getStripe().checkout.sessions.create(params);
}

export async function createPortalSession({
  stripeCustomerId,
  returnUrl,
}: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
}

export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(subscriptionId);
}

export async function updateSubscriptionSeats({
  subscriptionId,
  plan,
  newSeatCount,
}: {
  subscriptionId: string;
  plan: PlanTier;
  newSeatCount: number;
}): Promise<Stripe.Subscription> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const seatPriceId = getExtraSeatPriceId(plan);

  if (!seatPriceId) {
    throw new Error(`No extra seat pricing for plan: ${plan}`);
  }

  // Find existing seat line item
  const seatItem = subscription.items.data.find(
    (item) => item.price.id === seatPriceId
  );

  if (seatItem) {
    // Update existing quantity
    return getStripe().subscriptions.update(subscriptionId, {
      items: [{ id: seatItem.id, quantity: newSeatCount }],
    });
  } else {
    // Add new seat line item
    return getStripe().subscriptions.update(subscriptionId, {
      items: [{ price: seatPriceId, quantity: newSeatCount }],
    });
  }
}

/**
 * Extract plan tier from Stripe subscription by validating Price IDs
 * This is more reliable than reading metadata which can be manually edited
 */
export function getPlanFromSubscription(
  subscription: Stripe.Subscription
): PlanTier | null {
  for (const item of subscription.items.data) {
    const plan = PRICE_TO_PLAN[item.price.id];
    if (plan) return plan;
  }
  return null;
}

/**
 * Calculate total seat count from subscription items
 * Includes base plan seats + any extra seat add-ons
 */
export function calculateMaxSeats(subscription: Stripe.Subscription): number {
  const plan = getPlanFromSubscription(subscription);
  if (!plan) return 1; // Fallback to 1 seat

  const config = PLAN_CONFIGS[plan];
  let totalSeats = config.includedSeats;

  // Check for extra seat line items
  const extraSeatPriceId = getExtraSeatPriceId(plan);
  if (extraSeatPriceId) {
    const extraSeatItem = subscription.items.data.find(
      (item) => item.price.id === extraSeatPriceId
    );
    if (extraSeatItem && extraSeatItem.quantity) {
      totalSeats += extraSeatItem.quantity;
    }
  }

  return totalSeats;
}
