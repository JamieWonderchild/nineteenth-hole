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

// Platform takes 10% on top of every entry fee.
// e.g. organizer sets £20 entry → member pays £22 → pot gets £20 → we keep £2.
export const PLATFORM_FEE_PERCENT = 10;

export function platformFeeAmount(entryFeeInPence: number): number {
  return Math.round(entryFeeInPence * PLATFORM_FEE_PERCENT / 100);
}

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
  entryFee: number; // in pence/cents — this is the pot contribution
  currency: string;
  competitionName: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const platformFee = platformFeeAmount(entryFee);

  return getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: entryFee,
          product_data: {
            name: `${competitionName} — Pool Entry`,
            description: 'Tiered draw. One player per tier. Best player wins the pot.',
          },
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: platformFee,
          product_data: {
            name: 'Platform fee',
            description: 'Play The Pool service fee',
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
