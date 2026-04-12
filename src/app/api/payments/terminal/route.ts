import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { getPaymentProvider } from "@/lib/payments";
import type { Id } from "convex/_generated/dataModel";

function convex() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

// POST /api/payments/terminal
// Body: { clubId, terminalId, amount, currency?, purpose, description, memberId? }
// Returns: { intentId, providerIntentId }
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await request.json() as {
    clubId: string;
    terminalId: string;       // provider's terminal ID
    amount: number;           // pence
    currency?: string;
    purpose: string;          // 'pos_sale' | 'topup' | 'green_fee' | 'tee_time'
    description: string;
    memberId?: string;        // clubMembers ID if charging to a member
  };

  const {
    clubId,
    terminalId,
    amount,
    currency = "GBP",
    purpose,
    description,
    memberId,
  } = body;

  if (!clubId || !terminalId || !amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const provider = getPaymentProvider();

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
        userId,
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

  // 3. Record in Convex
  const db = convex();
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
