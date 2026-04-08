import Stripe from 'stripe';

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

// Club subscription price IDs
export const CLUB_PLAN_PRICE_ID = process.env.STRIPE_PRICE_CLUB_PLAN || '';

export async function createEntryCheckoutSession({
  entryId,
  competitionId,
  entryFee,
  currency,
  competitionName,
  userId,
  successUrl,
  cancelUrl,
}: {
  entryId: string;
  competitionId: string;
  entryFee: number; // in pence/cents
  currency: string;
  competitionName: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: entryFee,
          product_data: {
            name: `${competitionName} — Pool Entry`,
            description: 'Tiered draw. One player per tier. Best player wins.',
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: 'entry',
      entryId,
      competitionId,
      userId,
    },
  });
}

export async function createClubSubscriptionSession({
  clubId,
  stripeCustomerId,
  successUrl,
  cancelUrl,
}: {
  clubId: string;
  stripeCustomerId?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: CLUB_PLAN_PRICE_ID, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { type: 'club_subscription', clubId },
    subscription_data: { metadata: { clubId }, trial_period_days: 14 },
  };
  if (stripeCustomerId) params.customer = stripeCustomerId;
  return getStripe().checkout.sessions.create(params);
}
