import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const get = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db.get(clubId);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return ctx.db.query("clubs").withIndex("by_slug", q => q.eq("slug", slug)).unique();
  },
});

export const getByClerkOrg = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    return ctx.db.query("clubs").withIndex("by_clerk_org", q => q.eq("clerkOrgId", clerkOrgId)).unique();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    clerkOrgId: v.optional(v.string()),
    currency: v.string(),
    userId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("clubs").withIndex("by_slug", q => q.eq("slug", args.slug)).unique();
    if (existing) throw new Error(`Slug "${args.slug}" is already taken`);

    const now = new Date().toISOString();
    const clubId = await ctx.db.insert("clubs", {
      name: args.name,
      slug: args.slug,
      clerkOrgId: args.clerkOrgId,
      currency: args.currency,
      plan: "free",
      billingStatus: "trialing",
      createdAt: now,
      updatedAt: now,
    });

    // Create the founding admin member
    await ctx.db.insert("clubMembers", {
      clubId,
      userId: args.userId,
      role: "admin",
      displayName: args.displayName,
      totalEntered: 0,
      totalSpent: 0,
      totalWon: 0,
      totalProfit: 0,
      joinedAt: now,
      updatedAt: now,
    });

    return clubId;
  },
});

export const updateStripeCustomer = mutation({
  args: {
    clubId: v.id("clubs"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { clubId, stripeCustomerId }) => {
    await ctx.db.patch(clubId, {
      stripeCustomerId,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateSubscription = mutation({
  args: {
    clubId: v.id("clubs"),
    plan: v.string(),
    billingStatus: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.clubId, {
      plan: args.plan,
      billingStatus: args.billingStatus,
      stripeSubscriptionId: args.stripeSubscriptionId,
      updatedAt: new Date().toISOString(),
    });
  },
});
