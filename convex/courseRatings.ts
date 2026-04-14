import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByClub = query({
  args: { golfClubId: v.id("golfClubs") },
  handler: async (ctx, { golfClubId }) => {
    return ctx.db
      .query("courseRatings")
      .withIndex("by_golf_club", q => q.eq("golfClubId", golfClubId))
      .collect();
  },
});

export const getByClubAndTee = query({
  args: { golfClubId: v.id("golfClubs"), teeName: v.string() },
  handler: async (ctx, { golfClubId, teeName }) => {
    return ctx.db
      .query("courseRatings")
      .withIndex("by_golf_club_and_tee", q =>
        q.eq("golfClubId", golfClubId).eq("teeName", teeName)
      )
      .first();
  },
});

export const submit = mutation({
  args: {
    golfClubId: v.id("golfClubs"),
    teeName: v.string(),
    gender: v.string(),
    courseRating: v.number(),
    slopeRating: v.number(),
    scratchScore: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = new Date().toISOString();
    // Upsert: update if exists for this club+tee combo
    const existing = await ctx.db
      .query("courseRatings")
      .withIndex("by_golf_club_and_tee", q =>
        q.eq("golfClubId", args.golfClubId).eq("teeName", args.teeName)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("courseRatings", {
      ...args,
      submittedBy: identity.subject,
      verified: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});
