import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { DojoProvider } from "@/lib/payments/dojo";
import type { Id } from "convex/_generated/dataModel";

function convex() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

// POST /api/payments/webhook/dojo?club={clubId}
// POST /api/payments/webhook/square  (future)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const body = await request.text();

  // ── Dojo ──────────────────────────────────────────────────────────────────
  if (provider === "dojo") {
    const signature = request.headers.get("dojo-signature") ?? "";

    // Per-club credentials: look up from DB if ?club= is provided
    // Fall back to env vars for backward compatibility
    let webhookSecret = process.env.DOJO_WEBHOOK_SECRET ?? "";
    let apiKey = process.env.DOJO_API_KEY ?? "";

    const clubId = request.nextUrl.searchParams.get("club");
    if (clubId) {
      try {
        const db = convex();
        const club = await db.query(api.clubs.get, { clubId: clubId as Id<"clubs"> });
        if (club?.dojoWebhookSecret) webhookSecret = club.dojoWebhookSecret;
        if (club?.dojoApiKey) apiKey = club.dojoApiKey;
      } catch (err) {
        console.error("[webhook/dojo] Failed to fetch club credentials:", err);
      }
    }

    const dojo = new DojoProvider(apiKey, webhookSecret);

    let event;
    try {
      event = dojo.verifyWebhook(body, signature);
    } catch (err) {
      console.error("[webhook/dojo] Signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const db = convex();

    // Idempotency — use providerIntentId + type as event ID
    const eventId = `dojo:${event.type}:${event.providerIntentId}`;
    const isNew = await db.mutation(api.webhookEvents.checkAndRecord, {
      eventId,
      source: "dojo",
    });
    if (!isNew) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Resolve the payment intent (credits wallet for topups automatically)
    const statusMap: Record<string, string> = {
      "payment.captured": "captured",
      "payment.failed": "failed",
      "payment.refunded": "refunded",
    };

    await db.mutation(api.wallet.resolvePaymentIntent, {
      provider: "dojo",
      providerIntentId: event.providerIntentId,
      status: statusMap[event.type] ?? "failed",
    });

    console.log(
      `[webhook/dojo] ${event.type} — intent ${event.providerIntentId} (£${(event.amount / 100).toFixed(2)})`
    );

    return NextResponse.json({ received: true });
  }

  // ── Unknown provider ───────────────────────────────────────────────────────
  return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
}
