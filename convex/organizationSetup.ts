// Organization setup state tracking
// Tracks onboarding completion, feature setup, and multi-location migration status

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get setup state for an organization
 */
export const getSetupState = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const setup = await ctx.db
      .query("organizationSetup")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    // Return default state if none exists
    if (!setup) {
      return {
        orgId: args.orgId,
        onboardingCompleted: false,
        onboardingCompletedAt: undefined,
        locationSetupCompleted: false,
        teamSetupCompleted: false,
        billingSetupCompleted: false,
      };
    }

    return setup;
  },
});

/**
 * Initialize setup state for a new organization
 */
export const initializeSetup = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizationSetup")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (existing) return existing._id;

    const timestamp = new Date().toISOString();

    return await ctx.db.insert("organizationSetup", {
      orgId: args.orgId,
      onboardingCompleted: false,
      locationSetupCompleted: false,
      teamSetupCompleted: false,
      billingSetupCompleted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

/**
 * Mark onboarding as complete
 */
export const markOnboardingComplete = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const setup = await ctx.db
      .query("organizationSetup")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    const timestamp = new Date().toISOString();

    if (setup) {
      await ctx.db.patch(setup._id, {
        onboardingCompleted: true,
        onboardingCompletedAt: timestamp,
        updatedAt: timestamp,
      });
    } else {
      // Create if doesn't exist
      await ctx.db.insert("organizationSetup", {
        orgId: args.orgId,
        onboardingCompleted: true,
        onboardingCompletedAt: timestamp,
        locationSetupCompleted: false,
        teamSetupCompleted: false,
        billingSetupCompleted: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  },
});

/**
 * Mark location setup as complete
 */
export const markLocationSetupComplete = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const setup = await ctx.db
      .query("organizationSetup")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!setup) {
      throw new Error("Setup state not found. Initialize first.");
    }

    await ctx.db.patch(setup._id, {
      locationSetupCompleted: true,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Mark team setup as complete
 */
export const markTeamSetupComplete = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const setup = await ctx.db
      .query("organizationSetup")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!setup) {
      throw new Error("Setup state not found. Initialize first.");
    }

    await ctx.db.patch(setup._id, {
      teamSetupCompleted: true,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Check if organization needs location review (post-migration)
 */
export const needsLocationReview = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    return org?.needsLocationReview === true;
  },
});

/**
 * Clear location review flag
 */
export const clearLocationReview = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, {
      needsLocationReview: false,
      updatedAt: new Date().toISOString(),
    });
  },
});
