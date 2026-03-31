// convex/upgrade.ts
// Plan upgrade tracking and multi-location setup state

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Mark when a plan upgrade occurs
 * Triggers post-upgrade wizard for multi-location upgrades
 */
export const markPlanUpgrade = mutation({
  args: {
    orgId: v.id("organizations"),
    fromPlan: v.string(),
    toPlan: v.string(),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    // Update organization with last plan change
    await ctx.db.patch(args.orgId, {
      lastPlanChange: {
        fromPlan: args.fromPlan,
        toPlan: args.toPlan,
        changedAt: timestamp,
        wizardCompleted: false,
      },
      updatedAt: timestamp,
    });

    // Check if this is an upgrade to multi-location
    const isMultiLocationUpgrade = args.toPlan === "multi-location";

    if (isMultiLocationUpgrade) {
      // Get setup state
      const setup = await ctx.db
        .query("organizationSetup")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .first();

      if (setup) {
        // Mark location setup as incomplete to trigger wizard
        await ctx.db.patch(setup._id, {
          locationSetupCompleted: false,
          updatedAt: timestamp,
        });
      } else {
        // Create setup state if it doesn't exist
        await ctx.db.insert("organizationSetup", {
          orgId: args.orgId,
          onboardingCompleted: true,
          locationSetupCompleted: false, // Trigger wizard
          teamSetupCompleted: false,
          billingSetupCompleted: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    return { success: true, triggersWizard: isMultiLocationUpgrade };
  },
});

/**
 * Get upgrade state for an organization
 * Returns whether wizard should be shown
 */
export const getUpgradeState = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;

    const setup = await ctx.db
      .query("organizationSetup")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    // Show wizard if:
    // - Plan is multi-location
    // - Location setup not completed
    // - Had a recent plan change (within last 7 days)
    // - Wizard not already completed
    const showWizard =
      org.plan === "multi-location" &&
      setup?.locationSetupCompleted === false &&
      org.lastPlanChange &&
      !org.lastPlanChange.wizardCompleted &&
      new Date().getTime() - new Date(org.lastPlanChange.changedAt).getTime() <
        7 * 24 * 60 * 60 * 1000;

    return {
      plan: org.plan,
      showWizard,
      setupState: setup,
      lastPlanChange: org.lastPlanChange,
    };
  },
});

/**
 * Check if user has dismissed the upgrade wizard
 */
export const hasDissmissedUpgradeWizard = query({
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

    return prefs?.dismissedBanners.includes("multi-location-setup") ?? false;
  },
});

/**
 * Dismiss the upgrade wizard (user chose "Remind me later")
 */
export const dismissUpgradeWizard = mutation({
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

    if (prefs) {
      if (!prefs.dismissedBanners.includes("multi-location-setup")) {
        await ctx.db.patch(prefs._id, {
          dismissedBanners: [
            ...prefs.dismissedBanners,
            "multi-location-setup",
          ],
          updatedAt: timestamp,
        });
      }
    } else {
      // Create preferences with dismissed banner
      await ctx.db.insert("userPreferences", {
        userId: args.userId,
        orgId: args.orgId,
        dismissedBanners: ["multi-location-setup"],
        completedTours: [],
        seenFeatures: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  },
});

/**
 * Complete the multi-location setup wizard
 * Marks location setup as complete and clears wizard state
 */
export const completeMultiLocationSetup = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    const setup = await ctx.db
      .query("organizationSetup")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!setup) {
      throw new Error("Setup state not found");
    }

    await ctx.db.patch(setup._id, {
      locationSetupCompleted: true,
      updatedAt: timestamp,
    });

    // Mark wizard as completed in the organization
    const org = await ctx.db.get(args.orgId);
    if (org?.lastPlanChange) {
      await ctx.db.patch(args.orgId, {
        lastPlanChange: {
          ...org.lastPlanChange,
          wizardCompleted: true,
        },
        updatedAt: timestamp,
      });
    }
  },
});

// ============================================================================
// Plan Downgrade Validation & Archiving
// ============================================================================

const PLAN_LIMITS = {
  solo: { maxVets: 1, maxLocations: 1 },
  practice: { maxVets: 2, maxLocations: 1 },
  "multi-location": { maxVets: 5, maxLocations: 999 },
};

/**
 * Get the impact of downgrading to a specific plan
 * Returns counts of what would be affected
 */
async function computeDowngradeImpact(
  ctx: { db: any },
  args: { orgId: any; targetPlan: string }
) {
  const org = await ctx.db.get(args.orgId);
  if (!org) throw new Error("Organization not found");

  const targetPlan = args.targetPlan as "solo" | "practice" | "multi-location";
  const limits = PLAN_LIMITS[targetPlan];

  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
    .filter((q: any) =>
      q.and(
        q.eq(q.field("status"), "active"),
        q.eq(q.field("archivedAt"), undefined)
      )
    )
    .collect();

  const locations = await ctx.db
    .query("locations")
    .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
    .filter((q: any) => q.eq(q.field("archivedAt"), undefined))
    .collect();

  const currentVetCount = memberships.length;
  const currentLocationCount = locations.length;
  const wouldExceedVetLimit = currentVetCount > limits.maxVets;
  const wouldExceedLocationLimit = currentLocationCount > limits.maxLocations;

  return {
    canDowngrade: !wouldExceedVetLimit && !wouldExceedLocationLimit,
    currentPlan: org.plan,
    targetPlan,
    limits,
    current: { providers: currentVetCount, locations: currentLocationCount },
    excess: {
      providers: wouldExceedVetLimit ? currentVetCount - limits.maxVets : 0,
      locations: wouldExceedLocationLimit ? currentLocationCount - limits.maxLocations : 0,
    },
    memberships: memberships.map((m: any) => ({ _id: m._id, userId: m.userId, role: m.role, joinedAt: m.joinedAt })),
    locations: locations.map((l: any) => ({ _id: l._id, name: l.name, isDefault: l.isDefault })),
  };
}

export const getDowngradeImpact = query({
  args: {
    orgId: v.id("organizations"),
    targetPlan: v.string(),
  },
  handler: async (ctx, args) => {
    return computeDowngradeImpact(ctx, args);
  },
});

/**
 * Validate if a plan downgrade is allowed
 * Returns error if would violate constraints
 */
export const validatePlanDowngrade = query({
  args: {
    orgId: v.id("organizations"),
    targetPlan: v.string(),
  },
  handler: async (ctx, args) => {
    const impact = await computeDowngradeImpact(ctx, {
      orgId: args.orgId,
      targetPlan: args.targetPlan,
    });

    if (!impact.canDowngrade) {
      const reasons: string[] = [];
      if (impact.excess.providers > 0) {
        reasons.push(
          `You have ${impact.current.providers} active providers but ${args.targetPlan} plan only allows ${impact.limits.maxVets}. Please archive ${impact.excess.providers} provider(s) first.`
        );
      }
      if (impact.excess.locations > 0) {
        reasons.push(
          `You have ${impact.current.locations} locations but ${args.targetPlan} plan only allows ${impact.limits.maxLocations}. Please archive ${impact.excess.locations} location(s) first.`
        );
      }
      return {
        allowed: false,
        reasons,
        impact,
      };
    }

    return {
      allowed: true,
      reasons: [],
      impact,
    };
  },
});

/**
 * Archive specific memberships (for plan downgrade)
 * Owner can choose which providers to keep when downgrading
 */
export const archiveMemberships = mutation({
  args: {
    orgId: v.id("organizations"),
    membershipIds: v.array(v.id("memberships")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();
    const archived: { membershipId: typeof args.membershipIds[number]; userId: string; role: string }[] = [];

    for (const membershipId of args.membershipIds) {
      const membership = await ctx.db.get(membershipId);
      if (!membership || membership.orgId !== args.orgId) {
        throw new Error("Membership not found or doesn't belong to this org");
      }

      // Can't archive the owner
      if (membership.role === "owner") {
        throw new Error("Cannot archive the owner's membership");
      }

      await ctx.db.patch(membershipId, {
        status: "deactivated",
        archivedAt: timestamp,
        archivedReason: args.reason,
        updatedAt: timestamp,
      });

      archived.push({
        membershipId,
        userId: membership.userId,
        role: membership.role,
      });
    }

    return { archived, count: archived.length };
  },
});

/**
 * Archive specific locations (for plan downgrade)
 * Owner can choose which locations to keep when downgrading
 */
export const archiveLocations = mutation({
  args: {
    orgId: v.id("organizations"),
    locationIds: v.array(v.id("locations")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();
    const archived: { locationId: typeof args.locationIds[number]; name: string }[] = [];

    for (const locationId of args.locationIds) {
      const location = await ctx.db.get(locationId);
      if (!location || location.orgId !== args.orgId) {
        throw new Error("Location not found or doesn't belong to this org");
      }

      // Can't archive the default location
      if (location.isDefault) {
        throw new Error(
          "Cannot archive the default location. Please set another location as default first."
        );
      }

      await ctx.db.patch(locationId, {
        archivedAt: timestamp,
        archivedReason: args.reason,
        updatedAt: timestamp,
      });

      archived.push({
        locationId,
        name: location.name,
      });
    }

    return { archived, count: archived.length };
  },
});
