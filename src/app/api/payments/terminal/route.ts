import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { DojoProvider } from "@/lib/payments/dojo";
import { SquareProvider } from "@/lib/payments/square";
import type { PaymentProvider } from "@/lib/payments/types";
import type { Id } from "convex/_generated/dataModel";

function convex() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

// POST /api/payments/terminal
// Body: { clubId, terminalId, amount, currency?, purpose, description, memberId?, kioskId? }
// Returns: { intentId, providerIntentId }
export async function POST(request: NextRequest) {
  const body = await request.json() as {
    clubId: string;
    terminalId: string;       // provider's terminal ID
    amount: number;           // pence
    currency?: string;
    purpose: string;
    description: string;
    memberId?: string;
    kioskId?: string;         // kiosk device ID (alternative to Clerk session)
  };

  // Auth: logged-in staff (Clerk) OR kiosk device
  const { userId } = await auth();
  if (!userId && !body.kioskId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const servedBy = userId ?? `kiosk:${body.kioskId}`;

  const { clubId, terminalId, amount, currency = "GBP", purpose, description, memberId } = body;

  if (!clubId || !terminalId || !amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Look up the club and build the correct per-club provider
  const db = convex();
  const club = await db.query(api.clubs.get, { clubId: clubId as Id<"clubs"> });
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });

  let provider: PaymentProvider;
  const providerName = club.paymentProvider ?? "dojo";

  if (providerName === "square") {
    provider = new SquareProvider();
  } else {
    if (!club.dojoApiKey) {
      return NextResponse.json({ error: "Payment terminal not configured — add Dojo API credentials in Settings → Locations" }, { status: 400 });
    }
    provider = new DojoProvider(club.dojoApiKey, "");
  }

  // 1. Create payment intent
  let result;
  try {
    result = await provider.createIntent({
      amount,
      currency,
      description,
      metadata: {
        clubId,
        purpose,
        servedBy,
        ...(memberId ? { memberId } : {}),
      },
    });
  } catch (err) {
    console.error("[payments/terminal] createIntent failed:", err);
    return NextResponse.json({ error: "Payment provider error" }, { status: 502 });
  }

  // 2. Send to terminal
  try {
    await provider.sendToTerminal({
      providerIntentId: result.providerIntentId,
      terminalId,
    });
  } catch (err) {
    console.error("[payments/terminal] sendToTerminal failed:", err);
    return NextResponse.json({ error: "Failed to reach terminal" }, { status: 502 });
  }

  // 3. Record pending intent in Convex
  const intentDbId = await db.mutation(api.wallet.createPaymentIntent, {
    clubId: clubId as Id<"clubs">,
    ...(memberId ? { clubMemberId: memberId as Id<"clubMembers"> } : {}),
    provider: provider.name,
    providerIntentId: result.providerIntentId,
    amount,
    currency,
    purpose,
    terminalId,
    description,
  });

  return NextResponse.json({
    intentId: intentDbId,
    providerIntentId: result.providerIntentId,
  });
}

// DELETE /api/payments/terminal
// Body: { intentId, providerIntentId }
// Cancels the Dojo intent and marks it cancelled in Convex
export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  const body = await request.json() as {
    intentId: string;
    providerIntentId: string;
    kioskId?: string;
  };

  if (!userId && !body.kioskId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { intentId, providerIntentId } = body;
  if (!intentId || !providerIntentId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = convex();

  // Look up the club via the intent to get their provider credentials
  let provider: PaymentProvider | null = null;
  try {
    const intent = await db.query(api.wallet.getPaymentIntent, { intentId: intentId as Id<"paymentIntents"> });
    if (intent?.clubId) {
      const club = await db.query(api.clubs.get, { clubId: intent.clubId });
      if (club) {
        const providerName = club.paymentProvider ?? "dojo";
        if (providerName === "square") {
          provider = new SquareProvider();
        } else if (club.dojoApiKey) {
          provider = new DojoProvider(club.dojoApiKey, "");
        }
      }
    }
  } catch {
    // Non-fatal — we still mark the intent cancelled in Convex
  }

  // Best-effort cancel at provider — may fail if card already captured
  try {
    if (provider) await provider.cancelIntent(providerIntentId);
  } catch (err) {
    console.warn("[payments/terminal] cancelIntent failed (may already be captured):", err);
    // Mark failed in Convex so the UI unblocks even if Dojo cancel failed
  }

  // Mark cancelled in Convex
  try {
    await db.mutation(api.wallet.cancelPaymentIntent, {
      intentId: intentId as Id<"paymentIntents">,
    });
  } catch (err) {
    console.error("[payments/terminal] Failed to cancel intent in Convex:", err);
    return NextResponse.json({ error: "Failed to cancel intent" }, { status: 500 });
  }

  return NextResponse.json({ cancelled: true });
}
