import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    const q = ctx.db
      .query("rounds")
      .withIndex("by_user_and_date", q => q.eq("userId", userId))
      .order("desc");
    return limit ? q.take(limit) : q.collect();
  },
});

export const get = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => ctx.db.get(roundId),
});

export const getStats = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    if (rounds.length === 0) return null;

    const counting = rounds.filter(r => r.isCountingRound);
    const grossScores = rounds.map(r => r.grossScore);
    const avgGross = grossScores.reduce((a, b) => a + b, 0) / grossScores.length;
    const bestGross = Math.min(...grossScores);

    const diffs = counting
      .filter(r => r.differential !== undefined)
      .map(r => r.differential!);
    const avgDiff = diffs.length > 0
      ? diffs.reduce((a, b) => a + b, 0) / diffs.length
      : null;

    // GIR / fairway / putts (hole-by-hole only)
    const holedRounds = rounds.filter(r => r.holeScores && r.holeScores.length > 0);
    let girPct: number | null = null;
    let fairwayPct: number | null = null;
    let avgPutts: number | null = null;
    if (holedRounds.length > 0) {
      let totalHoles = 0, girCount = 0, fairwayCount = 0, fairwayTotal = 0, puttTotal = 0, puttHoles = 0;
      for (const r of holedRounds) {
        for (const h of r.holeScores!) {
          totalHoles++;
          if (h.gir) girCount++;
          if (h.par !== 3) { fairwayTotal++; if (h.fairwayHit) fairwayCount++; }
          if (h.putts !== undefined) { puttTotal += h.putts; puttHoles++; }
        }
      }
      girPct = totalHoles > 0 ? Math.round((girCount / totalHoles) * 100) : null;
      fairwayPct = fairwayTotal > 0 ? Math.round((fairwayCount / fairwayTotal) * 100) : null;
      avgPutts = puttHoles > 0 ? Math.round((puttTotal / (puttHoles / 18)) * 10) / 10 : null;
    }

    return {
      totalRounds: rounds.length,
      countingRounds: counting.length,
      avgGross: Math.round(avgGross * 10) / 10,
      bestGross,
      avgDifferential: avgDiff !== null ? Math.round(avgDiff * 10) / 10 : null,
      girPct,
      fairwayPct,
      avgPutts,
    };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    golfClubId: v.optional(v.id("golfClubs")),
    courseNameFreetext: v.optional(v.string()),
    golfCourseId: v.optional(v.id("golfCourses")),
    teeId: v.optional(v.id("courseTees")),
    tees: v.string(),
    courseRating: v.optional(v.number()),
    slopeRating: v.optional(v.number()),
    scratchScore: v.optional(v.number()),
    grossScore: v.number(),
    netScore: v.optional(v.number()),
    stablefordPoints: v.optional(v.number()),
    holeScores: v.optional(v.array(v.object({
      hole: v.number(),
      par: v.number(),
      strokeIndex: v.number(),
      score: v.number(),
      fairwayHit: v.optional(v.boolean()),
      gir: v.optional(v.boolean()),
      putts: v.optional(v.number()),
    }))),
    date: v.string(),
    playedWith: v.optional(v.array(v.string())),
    isCountingRound: v.boolean(),
    conditions: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Auto-fill course rating / slope from courseTees when teeId is provided
    let courseRating = args.courseRating;
    let slopeRating = args.slopeRating;
    let scratchScore = args.scratchScore;
    if (args.teeId) {
      const tee = await ctx.db.get(args.teeId);
      if (tee) {
        courseRating = tee.courseRating ?? courseRating;
        slopeRating = tee.slopeRating ?? slopeRating;
        scratchScore = tee.par ?? scratchScore;
      }
    }

    // Get current handicap for this user
    const profile = await ctx.db
      .query("golferProfiles")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .first();
    const handicapAtTime = profile?.handicapIndex ?? undefined;

    // Compute WHS differential if we have CR and slope
    let differential: number | undefined;
    if (courseRating !== undefined && slopeRating !== undefined) {
      differential = computeDifferential(args.grossScore, courseRating, slopeRating);
    }

    const now = new Date().toISOString();
    const roundId = await ctx.db.insert("rounds", {
      userId: identity.subject,
      ...args,
      courseRating,
      slopeRating,
      scratchScore,
      handicapAtTime,
      differential,
      createdAt: now,
      updatedAt: now,
    });

    // Recompute handicap index if this is a counting round with a differential
    if (args.isCountingRound && differential !== undefined) {
      await recomputeHandicap(ctx, identity.subject, roundId);
    }

    return roundId;
  },
});

export const deleteRound = mutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const round = await ctx.db.get(roundId);
    if (!round) throw new Error("Round not found");
    if (round.userId !== identity.subject) throw new Error("Not authorised");
    await ctx.db.delete(roundId);
    // Recompute handicap after deletion
    await recomputeHandicap(ctx, identity.subject, undefined);
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeDifferential(grossScore: number, courseRating: number, slopeRating: number): number {
  const raw = (grossScore - courseRating) * (113 / slopeRating);
  return Math.round(raw * 10) / 10;
}

async function recomputeHandicap(
  ctx: MutationCtx,
  userId: string,
  triggerRoundId: Id<"rounds"> | undefined
) {
  // Get last 20 counting rounds with differentials, ordered by date desc
  const rounds = await ctx.db
    .query("rounds")
    .withIndex("by_user_and_date", q => q.eq("userId", userId))
    .order("desc")
    .filter(q => q.eq(q.field("isCountingRound"), true))
    .take(20);

  const diffs = rounds
    .filter(r => r.differential !== undefined)
    .map(r => r.differential!);

  if (diffs.length < 3) return; // need at least 3 rounds

  const newIndex = computeWHSIndex(diffs);

  const profile = await ctx.db
    .query("golferProfiles")
    .withIndex("by_user", q => q.eq("userId", userId))
    .first();

  const previousIndex = profile?.handicapIndex;
  const change = previousIndex !== undefined
    ? Math.round((newIndex - previousIndex) * 10) / 10
    : 0;

  // Update golferProfile
  const now = new Date().toISOString();
  if (profile) {
    await ctx.db.patch(profile._id, { handicapIndex: newIndex, updatedAt: now });
  }

  // Record history
  await ctx.db.insert("handicapHistory", {
    userId,
    date: now.split("T")[0],
    handicapIndex: newIndex,
    previousIndex,
    change,
    direction: change < 0 ? "down" : change > 0 ? "up" : "same",
    triggerRoundId,
    reason: "round",
    createdAt: now,
  });
}

export function computeWHSIndex(differentials: number[]): number {
  // Sort ascending, take lowest N based on count
  const sorted = [...differentials].sort((a, b) => a - b);
  const count = sorted.length;
  let take: number;
  if (count < 3) return 54; // not enough rounds
  if (count <= 5) take = 1;
  else if (count <= 6) take = 2;
  else if (count <= 8) take = 2;
  else if (count <= 11) take = 3;
  else if (count <= 14) take = 4;
  else if (count <= 16) take = 5;
  else if (count <= 18) take = 6;
  else if (count === 19) take = 7;
  else take = 8; // 20 rounds: take lowest 8

  const best = sorted.slice(0, take);
  const avg = best.reduce((a, b) => a + b, 0) / best.length;
  const index = Math.min(54, Math.round(avg * 0.96 * 10) / 10);
  return index;
}
