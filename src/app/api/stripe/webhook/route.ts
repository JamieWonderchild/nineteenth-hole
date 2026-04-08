import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import type Stripe from "stripe";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[StripeWebhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency
  const isNew = await convex.mutation(api.webhookEvents.checkAndRecord, {
    eventId: event.id,
    source: "stripe",
  });
  if (!isNew) return NextResponse.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const type = session.metadata?.type;

        if (type === "entry") {
          // Pool entry payment confirmed
          const sessionId = session.id;
          const paymentIntentId = typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

          await convex.mutation(api.entries.markPaid, {
            stripeCheckoutSessionId: sessionId,
            stripePaymentIntentId: paymentIntentId,
          });
          console.log(`[StripeWebhook] Entry paid: session=${sessionId}`);
        } else if (type === "club_subscription" && session.metadata?.clubId) {
          // Club plan subscription started
          const clubId = session.metadata.clubId;
          const customerId = typeof session.customer === "string"
            ? session.customer : session.customer?.id;
          const subscriptionId = typeof session.subscription === "string"
            ? session.subscription : session.subscription?.id;

          if (customerId) {
            await convex.mutation(api.clubs.updateStripeCustomer, {
              clubId: clubId as any,
              stripeCustomerId: customerId,
            });
          }
          await convex.mutation(api.clubs.updateSubscription, {
            clubId: clubId as any,
            plan: "club",
            billingStatus: "active",
            stripeSubscriptionId: subscriptionId,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const clubId = subscription.metadata?.clubId;
        if (clubId) {
          await convex.mutation(api.clubs.updateSubscription, {
            clubId: clubId as any,
            plan: "free",
            billingStatus: "canceled",
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[StripeWebhook] Handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
