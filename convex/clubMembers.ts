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
      .withIndex("by_club_and_status", q => q.eq("clubId", clubId).eq("status", "active"))
      .collect();
  },
});

export const listPending = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_status", q => q.eq("clubId", clubId).eq("status", "pending"))
      .collect();
  },
});

// Leaderboard ordered by totalWon descending (active members only)
export const leaderboard = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const members = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_status", q => q.eq("clubId", clubId).eq("status", "active"))
      .collect();
    return members.sort((a, b) => b.totalWon - a.totalWon);
  },
});

// Creates a pending membership request if none exists
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
      status: "pending",
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

export const approveMember = mutation({
  args: { memberId: v.id("clubMembers") },
  handler: async (ctx, { memberId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");

    // Must be a club admin or super admin
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const caller = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", member.clubId).eq("userId", identity.subject))
        .unique();
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }

    await ctx.db.patch(memberId, { status: "active", updatedAt: new Date().toISOString() });
  },
});

export const rejectMember = mutation({
  args: { memberId: v.id("clubMembers") },
  handler: async (ctx, { memberId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");

    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    if (!isSuperAdmin) {
      const caller = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", q => q.eq("clubId", member.clubId).eq("userId", identity.subject))
        .unique();
      if (!caller || caller.role !== "admin") throw new Error("Not authorised");
    }

    await ctx.db.delete(memberId);
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
