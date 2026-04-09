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
    const results = await ctx.db
      .query("entries")
      .withIndex("by_competition_and_user", q => q.eq("competitionId", competitionId).eq("userId", userId))
      .collect();
    return results[0] ?? null;
  },
});

export const listByCompetitionAndUser = query({
  args: { competitionId: v.id("competitions"), userId: v.string() },
  handler: async (ctx, { competitionId, userId }) => {
    return ctx.db
      .query("entries")
      .withIndex("by_competition_and_user", q => q.eq("competitionId", competitionId).eq("userId", userId))
      .collect();
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
    // Pick-format — store chosen players at entry creation time
    drawnPlayerIds: v.optional(v.array(v.id("players"))),
    reservePlayerIds: v.optional(v.array(v.id("players"))),
    // Set true for pick-format to allow multiple entries per user
    allowMultiple: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { allowMultiple, ...entryData } = args;

    if (!allowMultiple) {
      const existing = await ctx.db
        .query("entries")
        .withIndex("by_competition_and_user", q =>
          q.eq("competitionId", args.competitionId).eq("userId", args.userId)
        )
        .collect();
      if (existing.length > 0) return existing[0]._id;
    }

    const now = new Date().toISOString();
    return ctx.db.insert("entries", {
      competitionId: entryData.competitionId,
      clubId: entryData.clubId,
      userId: entryData.userId,
      displayName: entryData.displayName,
      stripeCheckoutSessionId: entryData.stripeCheckoutSessionId,
      drawnPlayerIds: entryData.drawnPlayerIds,
      reservePlayerIds: entryData.reservePlayerIds,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Register interest without payment — for cash-collection competitions
export const enterFree = mutation({
  args: {
    competitionId: v.id("competitions"),
    clubId: v.optional(v.id("clubs")),
    userId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("entries")
      .withIndex("by_competition_and_user", q =>
        q.eq("competitionId", args.competitionId).eq("userId", args.userId)
      )
      .collect();
    if (existing.length > 0) return existing[0]._id;

    const now = new Date().toISOString();
    return ctx.db.insert("entries", {
      competitionId: args.competitionId,
      clubId: args.clubId,
      userId: args.userId,
      displayName: args.displayName,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Club admin marks a cash entry as paid
export const markEntryPaidByAdmin = mutation({
  args: { entryId: v.id("entries") },
  handler: async (ctx, { entryId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const entry = await ctx.db.get(entryId);
    if (!entry) throw new Error("Entry not found");

    if (entry.clubId) {
      const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
      const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
      if (!isSuperAdmin) {
        const member = await ctx.db
          .query("clubMembers")
          .withIndex("by_club_and_user", q => q.eq("clubId", entry.clubId!).eq("userId", identity.subject))
          .unique();
        if (!member || member.role !== "admin") throw new Error("Not authorised");
      }
    }

    const now = new Date().toISOString();
    await ctx.db.patch(entryId, { paidAt: now, updatedAt: now });
    return entryId;
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

// Recompute leaderboard positions based on current player scores (or prize money for pick format)
export const refreshLeaderboard = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const competition = await ctx.db.get(competitionId);
    if (!competition) throw new Error("Competition not found");

    const entries = await ctx.db
      .query("entries")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .filter(q => q.neq(q.field("drawnPlayerIds"), undefined))
      .collect();

    const now = new Date().toISOString();

    // ── Prize money mode (pick format) ──────────────────────────────────────
    if (competition.drawType === "pick") {
      type Scored = {
        entryId: typeof entries[0]["_id"];
        teamTotal: number;      // sum of 5 picks' prize money
        effectiveTotal: number; // + reserve if duplicate team detected
        pickKey: string;        // sorted player IDs for duplicate detection
      };
      const scored: Scored[] = [];

      for (const entry of entries) {
        if (!entry.drawnPlayerIds || entry.drawnPlayerIds.length === 0) continue;
        let teamTotal = 0;
        for (const pid of entry.drawnPlayerIds) {
          const player = await ctx.db.get(pid);
          teamTotal += player?.prizeMoney ?? 0;
        }
        const pickKey = [...entry.drawnPlayerIds].sort().join(",");
        scored.push({ entryId: entry._id, teamTotal, effectiveTotal: teamTotal, pickKey });
      }

      // Detect duplicate pick sets and activate reserve tiebreaker
      const keyCount = new Map<string, number>();
      for (const s of scored) keyCount.set(s.pickKey, (keyCount.get(s.pickKey) ?? 0) + 1);

      for (const s of scored) {
        if ((keyCount.get(s.pickKey) ?? 0) > 1) {
          const entry = entries.find(e => e._id === s.entryId);
          if (entry?.reservePlayerIds?.length) {
            const reserve = await ctx.db.get(entry.reservePlayerIds[0]);
            s.effectiveTotal = s.teamTotal + (reserve?.prizeMoney ?? 0);
          }
        }
      }

      // Sort: higher prize money = better rank
      scored.sort((a, b) => b.effectiveTotal - a.effectiveTotal);

      for (let i = 0; i < scored.length; i++) {
        await ctx.db.patch(scored[i].entryId, {
          totalPrizeMoney: scored[i].teamTotal,
          leaderboardPosition: i + 1,
          updatedAt: now,
        });
      }
      return;
    }

    // ── Score-to-par mode (sweep / draw format) ──────────────────────────────
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

    scored.sort((a, b) => a.score - b.score);

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
