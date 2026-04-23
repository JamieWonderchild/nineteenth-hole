import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("golferProfiles")
      .withIndex("by_user", q => q.eq("userId", userId))
      .first();
  },
});

export const search = query({
  args: { term: v.string(), includeSelf: v.optional(v.boolean()) },
  handler: async (ctx, { term, includeSelf }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    // Collect all profiles and filter by name (Convex doesn't have full-text search on this table yet)
    const all = await ctx.db.query("golferProfiles").collect();
    return all
      .filter(p =>
        (includeSelf || p.userId !== identity.subject) &&
        p.displayName.toLowerCase().includes(q)
      )
      .slice(0, 10);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return ctx.storage.generateUploadUrl();
  },
});

export const saveAvatarUrl = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const url = await ctx.storage.getUrl(storageId as Id<"_storage">);
    if (!url) throw new Error("Storage URL not found");
    const existing = await ctx.db
      .query("golferProfiles")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .first();
    if (!existing) throw new Error("Profile not found");
    await ctx.db.patch(existing._id, { avatarUrl: url, updatedAt: new Date().toISOString() });
    return url;
  },
});

export const upsert = mutation({
  args: {
    displayName: v.string(),
    handicapIndex: v.optional(v.number()),
    homeClub: v.optional(v.string()),
    goals: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
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
