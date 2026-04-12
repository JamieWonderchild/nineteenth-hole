import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
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
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const cats = await ctx.db
      .query("membershipCategories")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .collect();
    return cats.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  },
});

export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    colour: v.string(),
    advanceBookingDays: v.optional(v.number()),
    canBookWeekends: v.optional(v.boolean()),
    bookingStartTime: v.optional(v.string()),
    competitionEligible: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.clubId);
    const now = new Date().toISOString();
    return ctx.db.insert("membershipCategories", { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("membershipCategories"),
    name: v.optional(v.string()),
    colour: v.optional(v.string()),
    advanceBookingDays: v.optional(v.number()),
    canBookWeekends: v.optional(v.boolean()),
    bookingStartTime: v.optional(v.string()),
    competitionEligible: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { categoryId, ...fields }) => {
    const cat = await ctx.db.get(categoryId);
    if (!cat) throw new Error("Category not found");
    await assertAdmin(ctx, cat.clubId);
    await ctx.db.patch(categoryId, { ...fields, updatedAt: new Date().toISOString() });
  },
});

export const remove = mutation({
  args: { categoryId: v.id("membershipCategories") },
  handler: async (ctx, { categoryId }) => {
    const cat = await ctx.db.get(categoryId);
    if (!cat) throw new Error("Category not found");
    await assertAdmin(ctx, cat.clubId);
    await ctx.db.delete(categoryId);
  },
});
