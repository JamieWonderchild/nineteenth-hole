import { v } from "convex/values";
import { query } from "./_generated/server";

export const getLatest = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("golferProfiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();
    return profile?.handicapIndex ?? null;
  },
});

export const getHistory = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    const q = ctx.db
      .query("handicapHistory")
      .withIndex("by_user_and_date", q => q.eq("userId", userId))
      .order("desc");
    return limit ? q.take(limit) : q.collect();
  },
});

// Returns the last 20 differentials in date order (for display)
export const getDifferentials = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_user_and_date", q => q.eq("userId", userId))
      .order("desc")
      .filter(q => q.eq(q.field("isCountingRound"), true))
      .take(20);
    return rounds
      .filter(r => r.differential !== undefined)
      .map(r => ({
        roundId: r._id,
        date: r.date,
        differential: r.differential!,
        grossScore: r.grossScore,
        courseRating: r.courseRating,
        slopeRating: r.slopeRating,
      }));
  },
});
