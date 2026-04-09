import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByCompetition = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    return ctx.db
      .query("players")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .collect();
  },
});

export const listByTier = query({
  args: { competitionId: v.id("competitions"), tier: v.number() },
  handler: async (ctx, { competitionId, tier }) => {
    return ctx.db
      .query("players")
      .withIndex("by_competition_and_tier", q => q.eq("competitionId", competitionId).eq("tier", tier))
      .collect();
  },
});

export const bulkCreate = mutation({
  args: {
    competitionId: v.id("competitions"),
    players: v.array(v.object({
      name: v.string(),
      tier: v.number(),
      worldRanking: v.optional(v.number()),
      country: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      espnPlayerId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { competitionId, players }) => {
    const ids: string[] = [];
    for (const player of players) {
      const id = await ctx.db.insert("players", {
        competitionId,
        name: player.name,
        tier: player.tier,
        worldRanking: player.worldRanking,
        country: player.country,
        imageUrl: player.imageUrl,
        espnPlayerId: player.espnPlayerId,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const upsertScore = mutation({
  args: {
    playerId: v.id("players"),
    r1: v.optional(v.number()),
    r2: v.optional(v.number()),
    r3: v.optional(v.number()),
    r4: v.optional(v.number()),
    totalScore: v.optional(v.number()),
    scoreToPar: v.optional(v.number()),
    position: v.optional(v.number()),
    madeCut: v.optional(v.boolean()),
    withdrawn: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { playerId, ...scores } = args;
    await ctx.db.patch(playerId, scores);
  },
});

// Bulk update scores — used by score sync cron
export const bulkUpdateScores = mutation({
  args: {
    updates: v.array(v.object({
      playerId: v.id("players"),
      r1: v.optional(v.number()),
      r2: v.optional(v.number()),
      r3: v.optional(v.number()),
      r4: v.optional(v.number()),
      totalScore: v.optional(v.number()),
      scoreToPar: v.optional(v.number()),
      position: v.optional(v.number()),
      madeCut: v.optional(v.boolean()),
      withdrawn: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, { updates }) => {
    for (const update of updates) {
      const { playerId, ...scores } = update;
      await ctx.db.patch(playerId, scores);
    }
  },
});

// Update prize money for a single player (used in pick-format competitions)
export const updatePrizeMoney = mutation({
  args: {
    playerId: v.id("players"),
    prizeMoney: v.number(), // in pence/cents
  },
  handler: async (ctx, { playerId, prizeMoney }) => {
    await ctx.db.patch(playerId, { prizeMoney });
  },
});

// Bulk update prize money
export const bulkUpdatePrizeMoney = mutation({
  args: {
    updates: v.array(v.object({
      playerId: v.id("players"),
      prizeMoney: v.number(),
    })),
  },
  handler: async (ctx, { updates }) => {
    for (const { playerId, prizeMoney } of updates) {
      await ctx.db.patch(playerId, { prizeMoney });
    }
  },
});

export const deleteByCompetition = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .collect();
    for (const p of players) {
      await ctx.db.delete(p._id);
    }
  },
});
