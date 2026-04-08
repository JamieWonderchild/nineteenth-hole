import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import type Stripe from "stripe";

function getConvex() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}
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
  const convex = getConvex();
  const isNew = await convex.mutation(api.webhookEvents.checkAndRecord, {
    eventId: event.id,
    source: "stripe",
  });
  if (!isNew) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.type === "entry") {
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

        await convex.mutation(api.entries.markPaid, {
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        });
        console.log(`[StripeWebhook] Entry paid: session=${session.id}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[StripeWebhook] Handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
