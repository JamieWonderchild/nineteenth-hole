import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

async function assertAdmin(ctx: MutationCtx, clubId: Id<"clubs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return;
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", identity.subject))
    .unique();
  if (!member || member.role !== "admin") throw new Error("Not authorised");
}

export const listByClub = query({
  args: { clubId: v.id("clubs"), limit: v.optional(v.number()) },
  handler: async (ctx, { clubId, limit }) => {
    const results = await ctx.db
      .query("visitors")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .order("desc")
      .take(limit ?? 100);
    return results;
  },
});

export const listByDate = query({
  args: { clubId: v.id("clubs"), date: v.string() },
  handler: async (ctx, { clubId, date }) => {
    return ctx.db
      .query("visitors")
      .withIndex("by_club_and_date", q => q.eq("clubId", clubId).eq("date", date))
      .collect();
  },
});

export const log = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    homeClub: v.optional(v.string()),
    date: v.string(),
    greenFee: v.optional(v.number()),
    currency: v.string(),
    paidAt: v.optional(v.string()),
    slotId: v.optional(v.id("teeTimeSlots")),
    notes: v.optional(v.string()),
    loggedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.clubId);
    return ctx.db.insert("visitors", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});

export const markPaid = mutation({
  args: { visitorId: v.id("visitors") },
  handler: async (ctx, { visitorId }) => {
    const visitor = await ctx.db.get(visitorId);
    if (!visitor) throw new Error("Not found");
    await assertAdmin(ctx, visitor.clubId);
    await ctx.db.patch(visitorId, { paidAt: new Date().toISOString() });
  },
});

export const remove = mutation({
  args: { visitorId: v.id("visitors") },
  handler: async (ctx, { visitorId }) => {
    const visitor = await ctx.db.get(visitorId);
    if (!visitor) throw new Error("Not found");
    await assertAdmin(ctx, visitor.clubId);
    await ctx.db.delete(visitorId);
  },
});
