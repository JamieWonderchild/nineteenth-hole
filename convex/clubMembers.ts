import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("clubMembers")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
  },
});

export const getByClubAndUser = query({
  args: { clubId: v.id("clubs"), userId: v.string() },
  handler: async (ctx, { clubId, userId }) => {
    return ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", userId))
      .unique();
  },
});

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("clubMembers")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .collect();
  },
});

// Leaderboard ordered by totalWon descending
export const leaderboard = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const members = await ctx.db
      .query("clubMembers")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .collect();
    return members.sort((a, b) => b.totalWon - a.totalWon);
  },
});

export const ensureMember = mutation({
  args: {
    clubId: v.id("clubs"),
    userId: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", args.clubId).eq("userId", args.userId))
      .unique();
    if (existing) return existing._id;

    const now = new Date().toISOString();
    return ctx.db.insert("clubMembers", {
      clubId: args.clubId,
      userId: args.userId,
      role: "member",
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      totalEntered: 0,
      totalSpent: 0,
      totalWon: 0,
      totalProfit: 0,
      joinedAt: now,
      updatedAt: now,
    });
  },
});

// Called when a competition resolves — update cumulative stats
export const recordCompetitionResult = mutation({
  args: {
    clubId: v.id("clubs"),
    userId: v.string(),
    entryFee: v.number(),
    prizeWon: v.number(),
    leaderboardPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", args.clubId).eq("userId", args.userId))
      .unique();
    if (!member) return;

    const newTotalWon = member.totalWon + args.prizeWon;
    const newTotalSpent = member.totalSpent + args.entryFee;

    await ctx.db.patch(member._id, {
      totalEntered: member.totalEntered + 1,
      totalSpent: newTotalSpent,
      totalWon: newTotalWon,
      totalProfit: newTotalWon - newTotalSpent,
      bestFinish: member.bestFinish === undefined
        ? args.leaderboardPosition
        : Math.min(member.bestFinish, args.leaderboardPosition),
      updatedAt: new Date().toISOString(),
    });
  },
});
