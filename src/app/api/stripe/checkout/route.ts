import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import { createEntryCheckoutSession } from "@/lib/stripe";
import type { Id } from "convex/_generated/dataModel";

function getConvex() {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { competitionId, entryId, isPlatformPool, poolSlug, clubSlug, competitionSlug } = body;

  if (!competitionId || !entryId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const convex = getConvex();
  const competition = await convex.query(api.competitions.get, {
    competitionId: competitionId as Id<"competitions">,
  });
  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let successUrl: string;
  let cancelUrl: string;

  if (isPlatformPool && poolSlug) {
    // Platform pool — redirect to /pools/[slug]
    successUrl = `${origin}/pools/${poolSlug}?success=1&session_id={CHECKOUT_SESSION_ID}`;
    cancelUrl = `${origin}/pools/${poolSlug}/enter`;
  } else if (clubSlug && competitionSlug) {
    // Club competition
    successUrl = `${origin}/${clubSlug}/${competitionSlug}?success=1&session_id={CHECKOUT_SESSION_ID}`;
    cancelUrl = `${origin}/${clubSlug}/${competitionSlug}/enter`;
  } else {
    return NextResponse.json({ error: "Missing URL routing info" }, { status: 400 });
  }

  const session = await createEntryCheckoutSession({
    entryId,
    competitionId,
    entryFee: competition.entryFee,
    currency: competition.currency,
    competitionName: competition.name,
    userId,
    successUrl,
    cancelUrl,
  });

  await convex.mutation(api.entries.linkStripeSession, {
    entryId: entryId as Id<"entries">,
    stripeCheckoutSessionId: session.id,
  });

  return NextResponse.json({ url: session.url });
}
