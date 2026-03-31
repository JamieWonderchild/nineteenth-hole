// User preferences and feature discovery state
// Manages dismissed banners, completed tours, and wizard progress

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get user preferences for an org
 */
export const getUserPreferences = query({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId)
      )
      .first();

    // Return defaults if none exist
    if (!prefs) {
      return {
        userId: args.userId,
        orgId: args.orgId,
        dismissedBanners: [],
        completedTours: [],
        seenFeatures: {},
        wizardState: undefined,
        language: 'en',
      };
    }

    return prefs;
  },
});

/**
 * Initialize preferences for a user in an org
 */
export const initializePreferences = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId)
      )
      .first();

    if (existing) return existing._id;

    const timestamp = new Date().toISOString();

    return await ctx.db.insert("userPreferences", {
      userId: args.userId,
      orgId: args.orgId,
      dismissedBanners: [],
      completedTours: [],
      seenFeatures: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

/**
 * Dismiss a banner
 */
export const dismissBanner = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    bannerId: v.string(),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId)
      )
      .first();

    const timestamp = new Date().toISOString();

    if (prefs) {
      // Add banner to dismissed list if not already there
      if (!prefs.dismissedBanners.includes(args.bannerId)) {
        await ctx.db.patch(prefs._id, {
          dismissedBanners: [...prefs.dismissedBanners, args.bannerId],
          updatedAt: timestamp,
        });
      }
    } else {
      // Create preferences with dismissed banner
      await ctx.db.insert("userPreferences", {
        userId: args.userId,
        orgId: args.orgId,
        dismissedBanners: [args.bannerId],
        completedTours: [],
        seenFeatures: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  },
});

/**
 * Check if a banner has been dismissed
 */
export const isBannerDismissed = query({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    bannerId: v.string(),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId)
      )
      .first();

    return prefs?.dismissedBanners.includes(args.bannerId) ?? false;
  },
});

/**
 * Save wizard progress (for resumable wizards)
 */
export const saveWizardProgress = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    wizardId: v.string(),
    currentStep: v.number(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId)
      )
      .first();

    const timestamp = new Date().toISOString();
    const wizardState = {
      wizardId: args.wizardId,
      currentStep: args.currentStep,
      data: args.data,
      startedAt: prefs?.wizardState?.startedAt ?? timestamp,
    };

    if (prefs) {
      await ctx.db.patch(prefs._id, {
        wizardState,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("userPreferences", {
        userId: args.userId,
        orgId: args.orgId,
        dismissedBanners: [],
        completedTours: [],
        seenFeatures: {},
        wizardState,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  },
});

/**
 * Get wizard progress (for resuming)
 */
export const getWizardProgress = query({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    wizardId: v.string(),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId)
      )
      .first();

    if (!prefs?.wizardState) return null;
    if (prefs.wizardState.wizardId !== args.wizardId) return null;

    return prefs.wizardState;
  },
});

/**
 * Clear wizard progress (when completed or abandoned)
 */
export const clearWizardProgress = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId)
      )
      .first();

    if (prefs && prefs.wizardState) {
      await ctx.db.patch(prefs._id, {
        wizardState: undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

/**
 * Mark a tour as completed
 */
export const markTourComplete = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    tourId: v.string(),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId)
      )
      .first();

    const timestamp = new Date().toISOString();

    if (prefs) {
      if (!prefs.completedTours.includes(args.tourId)) {
        await ctx.db.patch(prefs._id, {
          completedTours: [...prefs.completedTours, args.tourId],
          updatedAt: timestamp,
        });
      }
    } else {
      await ctx.db.insert("userPreferences", {
        userId: args.userId,
        orgId: args.orgId,
        dismissedBanners: [],
        completedTours: [args.tourId],
        seenFeatures: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  },
});

/**
 * Set language preference for Corti AI (transcription, facts, documents)
 */
export const setLanguage = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    language: v.string(), // 'en' | 'fr'
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId)
      )
      .first();

    const timestamp = new Date().toISOString();

    if (prefs) {
      await ctx.db.patch(prefs._id, {
        language: args.language,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("userPreferences", {
        userId: args.userId,
        orgId: args.orgId,
        dismissedBanners: [],
        completedTours: [],
        seenFeatures: {},
        language: args.language,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  },
});

/**
 * Track that user has viewed settings page
 * Auto-dismisses multi-location setup banner
 */
export const markSettingsViewed = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", args.userId).eq("orgId", args.orgId)
      )
      .first();

    const timestamp = new Date().toISOString();
    const bannerId = 'multi-location-setup';

    if (prefs) {
      // Auto-dismiss the banner if not already dismissed
      if (!prefs.dismissedBanners.includes(bannerId)) {
        await ctx.db.patch(prefs._id, {
          dismissedBanners: [...prefs.dismissedBanners, bannerId],
          updatedAt: timestamp,
        });
      }
    } else {
      // Create preferences with dismissed banner
      await ctx.db.insert("userPreferences", {
        userId: args.userId,
        orgId: args.orgId,
        dismissedBanners: [bannerId],
        completedTours: [],
        seenFeatures: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  },
});
