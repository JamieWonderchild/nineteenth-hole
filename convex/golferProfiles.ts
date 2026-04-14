import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("golferProfiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();
  },
});

export const upsert = mutation({
  args: {
    displayName: v.string(),
    handicapIndex: v.optional(v.number()),
    homeClub: v.optional(v.string()),
    goals: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("golferProfiles")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .first();

    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("golferProfiles", {
      userId: identity.subject,
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});
