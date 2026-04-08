import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

export const listByCompetition = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    return ctx.db
      .query("entries")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .collect();
  },
});

export const getByCompetitionAndUser = query({
  args: { competitionId: v.id("competitions"), userId: v.string() },
  handler: async (ctx, { competitionId, userId }) => {
    return ctx.db
      .query("entries")
      .withIndex("by_competition_and_user", q => q.eq("competitionId", competitionId).eq("userId", userId))
      .unique();
  },
});

export const getByStripeSession = query({
  args: { stripeCheckoutSessionId: v.string() },
  handler: async (ctx, { stripeCheckoutSessionId }) => {
    return ctx.db
      .query("entries")
      .withIndex("by_stripe_session", q => q.eq("stripeCheckoutSessionId", stripeCheckoutSessionId))
      .unique();
  },
});

export const create = mutation({
  args: {
    competitionId: v.id("competitions"),
    clubId: v.optional(v.id("clubs")),
    userId: v.string(),
    displayName: v.string(),
    stripeCheckoutSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("entries")
      .withIndex("by_competition_and_user", q =>
        q.eq("competitionId", args.competitionId).eq("userId", args.userId)
      )
      .unique();
    if (existing) return existing._id;

    const now = new Date().toISOString();
    return ctx.db.insert("entries", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const markPaid = mutation({
  args: {
    stripeCheckoutSessionId: v.string(),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, { stripeCheckoutSessionId, stripePaymentIntentId }) => {
    const entry = await ctx.db
      .query("entries")
      .withIndex("by_stripe_session", q => q.eq("stripeCheckoutSessionId", stripeCheckoutSessionId))
      .unique();
    if (!entry) throw new Error(`No entry for session ${stripeCheckoutSessionId}`);

    await ctx.db.patch(entry._id, {
      paidAt: new Date().toISOString(),
      stripePaymentIntentId,
      updatedAt: new Date().toISOString(),
    });
    return entry._id;
  },
});

export const linkStripeSession = mutation({
  args: {
    entryId: v.id("entries"),
    stripeCheckoutSessionId: v.string(),
  },
  handler: async (ctx, { entryId, stripeCheckoutSessionId }) => {
    await ctx.db.patch(entryId, {
      stripeCheckoutSessionId,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Assign drawn players after draw ceremony
export const assignDrawnPlayers = mutation({
  args: {
    entryId: v.id("entries"),
    drawnPlayerIds: v.array(v.id("players")),
  },
  handler: async (ctx, { entryId, drawnPlayerIds }) => {
    await ctx.db.patch(entryId, {
      drawnPlayerIds,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Run the draw for all paid entries in a competition
// Assigns one player per tier randomly to each entrant
export const runDraw = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const competition = await ctx.db.get(competitionId);
    if (!competition) throw new Error("Competition not found");
    if (competition.drawCompletedAt) throw new Error("Draw already completed");

    const entries = await ctx.db
      .query("entries")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .filter(q => q.neq(q.field("paidAt"), undefined))
      .collect();

    if (entries.length === 0) throw new Error("No paid entries to draw");

    const allPlayers = await ctx.db
      .query("players")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .collect();

    // Group players by tier
    const tierMap = new Map<number, typeof allPlayers>();
    for (const player of allPlayers) {
      if (!tierMap.has(player.tier)) tierMap.set(player.tier, []);
      tierMap.get(player.tier)!.push(player);
    }

    // Shuffle each tier
    for (const [tier, players] of tierMap) {
      tierMap.set(tier, shuffle(players));
    }

    // Assign players round-robin across entries, one per tier
    const tierAssignmentIndex = new Map<number, number>();
    for (const [tier] of tierMap) tierAssignmentIndex.set(tier, 0);

    const now = new Date().toISOString();
    for (const entry of entries) {
      const drawnPlayerIds: (typeof allPlayers[0]["_id"])[] = [];
      for (let tier = 1; tier <= competition.tierCount; tier++) {
        const tierPlayers = tierMap.get(tier) || [];
        const idx = tierAssignmentIndex.get(tier)! % tierPlayers.length;
        tierAssignmentIndex.set(tier, idx + 1);
        if (tierPlayers[idx]) drawnPlayerIds.push(tierPlayers[idx]._id);
      }
      await ctx.db.patch(entry._id, { drawnPlayerIds, updatedAt: now });
    }

    await ctx.db.patch(competitionId, {
      drawCompletedAt: now,
      status: "live",
      updatedAt: now,
    });

    return entries.length;
  },
});

// Recompute leaderboard positions based on current player scores
export const refreshLeaderboard = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const entries = await ctx.db
      .query("entries")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .filter(q => q.neq(q.field("drawnPlayerIds"), undefined))
      .collect();

    const scored: { entryId: typeof entries[0]["_id"]; score: number; position: number }[] = [];

    for (const entry of entries) {
      if (!entry.drawnPlayerIds || entry.drawnPlayerIds.length === 0) continue;
      let bestScore = Infinity;
      let bestPosition = 999;
      for (const pid of entry.drawnPlayerIds) {
        const player = await ctx.db.get(pid);
        if (!player) continue;
        if (player.scoreToPar !== undefined && player.scoreToPar < bestScore) {
          bestScore = player.scoreToPar;
          bestPosition = player.position ?? 999;
        }
      }
      scored.push({ entryId: entry._id, score: bestScore, position: bestPosition });
    }

    // Sort: lower (more negative) score = better
    scored.sort((a, b) => a.score - b.score);

    const now = new Date().toISOString();
    for (let i = 0; i < scored.length; i++) {
      await ctx.db.patch(scored[i].entryId, {
        bestPlayerScore: scored[i].score === Infinity ? undefined : scored[i].score,
        bestPlayerPosition: scored[i].position === 999 ? undefined : scored[i].position,
        leaderboardPosition: i + 1,
        updatedAt: now,
      });
    }
  },
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
