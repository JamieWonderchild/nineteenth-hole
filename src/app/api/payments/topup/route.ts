import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { getPaymentProvider } from "@/lib/payments";
import type { Id } from "convex/_generated/dataModel";

function convex() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

// POST /api/payments/topup
// Body: { clubId, memberId, amount, currency? }
// Returns: { checkoutUrl, intentId }
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await request.json() as {
    clubId: string;
    memberId: string;
    amount: number;    // pence
    currency?: string;
  };

  const { clubId, memberId, amount, currency = "GBP" } = body;

  if (!clubId || !memberId || !amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const provider = getPaymentProvider();

  let result;
  try {
    result = await provider.createIntent({
      amount,
      currency,
      description: "Account top-up",
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/manage/wallet/confirm`,
      metadata: {
        memberId,
        clubId,
        purpose: "topup",
        userId,
      },
    });
  } catch (err) {
    console.error("[payments/topup] createIntent failed:", err);
    return NextResponse.json({ error: "Payment provider error" }, { status: 502 });
  }

  // Record the pending intent in Convex
  const db = convex();
  const intentDbId = await db.mutation(api.wallet.createPaymentIntent, {
    clubId: clubId as Id<"clubs">,
    clubMemberId: memberId as Id<"clubMembers">,
    provider: provider.name,
    providerIntentId: result.providerIntentId,
    amount,
    currency,
    purpose: "topup",
    checkoutUrl: result.checkoutUrl,
    description: "Account top-up",
  });

  return NextResponse.json({
    intentId: intentDbId,
    providerIntentId: result.providerIntentId,
    checkoutUrl: result.checkoutUrl,
  });
}
