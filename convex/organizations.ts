// convex/organizations.ts
// Organization CRUD and billing operations
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { requireOrgAccess, canManageBilling } from "./permissions";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    clerkOrgId: v.optional(v.string()),
    plan: v.string(),
    maxProviderSeats: v.number(),
    billingStatus: v.optional(v.string()),
    trialEndsAt: v.optional(v.string()),
    clinicName: v.optional(v.string()),
    clinicPhone: v.optional(v.string()),
    clinicEmail: v.optional(v.string()),
    clinicAddress: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    // Check slug uniqueness
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      throw new Error("Organization slug already taken");
    }

    // All plans get 14-day free trial by default
    // Multi-location will require payment in onboarding flow
    const defaultTrialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    return await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      clerkOrgId: args.clerkOrgId,
      plan: args.plan,
      billingStatus: args.billingStatus || "trialing",
      trialEndsAt: args.trialEndsAt !== undefined ? args.trialEndsAt : defaultTrialEndsAt,
      maxProviderSeats: args.maxProviderSeats,
      clinicName: args.clinicName,
      clinicPhone: args.clinicPhone,
      clinicEmail: args.clinicEmail,
      clinicAddress: args.clinicAddress,
      emergencyPhone: args.emergencyPhone,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const getByClerkOrg = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();
  },
});

export const getById = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

export const getByStripeCustomer = query({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();
  },
});

// Get all organizations (for admin use)
export const getAllForAdmin = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});

export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    clinicName: v.optional(v.string()),
    clinicPhone: v.optional(v.string()),
    clinicEmail: v.optional(v.string()),
    clinicAddress: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.id);
    if (!org) throw new Error("Organization not found");

    const { id, ...fields } = args;
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Called by Stripe webhook to update billing state
export const updateBilling = mutation({
  args: {
    id: v.id("organizations"),
    billingStatus: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.optional(v.string()),
    maxProviderSeats: v.optional(v.number()),
    trialEndsAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.id);
    if (!org) throw new Error("Organization not found");

    // Detect plan change for upgrade tracking
    const planChanged = args.plan && args.plan !== org.plan;
    const oldPlan = org.plan;
    const newPlan = args.plan;

    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    // Trigger upgrade tracking if plan changed
    if (planChanged && newPlan) {
      await ctx.runMutation(api.upgrade.markPlanUpgrade, {
        orgId: id,
        fromPlan: oldPlan,
        toPlan: newPlan,
      });
    }
  },
});

// Update billing by Stripe customer ID (used in webhooks where we only have the Stripe ID)
export const updateBillingByStripeCustomer = mutation({
  args: {
    stripeCustomerId: v.string(),
    billingStatus: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.optional(v.string()),
    maxProviderSeats: v.optional(v.number()),
    trialEndsAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();

    if (!org) throw new Error("Organization not found for Stripe customer");

    const { stripeCustomerId, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    await ctx.db.patch(org._id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Update tax settings for an organization
 * Only owners can change tax settings (billing-critical)
 *
 * @param includedInPrices - Controls tax calculation mode:
 *   - false (Tax-Exclusive): Tax is ADDED to catalog prices
 *     Example: $100 item + 20% tax = $120 charged to client
 *   - true (Tax-Inclusive): Tax is ALREADY in catalog prices
 *     Example: $100 item includes $16.67 tax (20%) = $100 charged to client
 *
 * See convex/lib/taxCalculations.ts for implementation details
 */
export const updateTaxSettings = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    enabled: v.boolean(),
    rate: v.number(),
    name: v.string(),
    currency: v.string(),
    includedInPrices: v.boolean(),
  },
  handler: async (ctx, args) => {
    const membership = await requireOrgAccess(ctx, args.userId, args.orgId);

    // Only owners can change tax settings (billing-critical)
    if (!canManageBilling(membership)) {
      throw new Error("Forbidden: only owners can update tax settings");
    }

    // Validate rate
    if (args.rate < 0 || args.rate > 100) {
      throw new Error("Tax rate must be between 0 and 100");
    }

    // Validate currency format (basic check for 3-letter code)
    if (!/^[A-Z]{3}$/.test(args.currency)) {
      throw new Error("Currency must be a 3-letter ISO code (e.g., USD, EUR, GBP)");
    }

    await ctx.db.patch(args.orgId, {
      taxSettings: {
        enabled: args.enabled,
        rate: args.rate,
        name: args.name,
        currency: args.currency,
        includedInPrices: args.includedInPrices,
      },
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Update billing currency for an organization
 * This affects how all catalog items are displayed and billed
 * Only owners can change billing currency (billing-critical)
 */
export const updateBillingCurrency = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const membership = await requireOrgAccess(ctx, args.userId, args.orgId);

    // Only owners can change billing currency (billing-critical)
    if (!canManageBilling(membership)) {
      throw new Error("Forbidden: only owners can update billing currency");
    }

    // Validate currency format (basic check for 3-letter code)
    if (!/^[A-Z]{3}$/.test(args.currency)) {
      throw new Error("Currency must be a 3-letter ISO code (e.g., USD, EUR, GBP, ZAR)");
    }

    await ctx.db.patch(args.orgId, {
      billingCurrency: args.currency,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const expireTrials = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const trialingOrgs = await ctx.db
      .query("organizations")
      .withIndex("by_billing_status", (q) => q.eq("billingStatus", "trialing"))
      .collect();

    let expiredCount = 0;
    for (const org of trialingOrgs) {
      if (org.trialEndsAt && org.trialEndsAt < now) {
        await ctx.db.patch(org._id, {
          billingStatus: "trial_expired",
          updatedAt: now,
        });
        expiredCount++;
        console.log(`Trial expired for org ${org._id} (${org.name})`);
      }
    }

    if (expiredCount > 0) {
      console.log(`Expired ${expiredCount} trial(s)`);
    }
  },
});

// Migration: Fix stuck 'incomplete' accounts - give them 14-day trial
export const fixIncompleteAccounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const incompleteOrgs = await ctx.db
      .query("organizations")
      .withIndex("by_billing_status", (q) => q.eq("billingStatus", "incomplete"))
      .collect();

    let fixedCount = 0;
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    for (const org of incompleteOrgs) {
      await ctx.db.patch(org._id, {
        billingStatus: "trialing",
        trialEndsAt,
        updatedAt: new Date().toISOString(),
      });
      fixedCount++;
      console.log(`Fixed org ${org._id} (${org.name}) - set to trialing`);
    }

    console.log(`Fixed ${fixedCount} incomplete account(s)`);
    return { fixed: fixedCount };
  },
});
