// convex/onboarding.ts
// Onboarding flow - org creation with locations and demo data

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Create organization with complete setup
 * - Creates org record
 * - Creates locations
 * - Creates membership for owner
 * - Initializes setup tracking
 * - Optionally creates demo data
 */
export const createOrgWithSetup = mutation({
  args: {
    clerkOrgId: v.string(), // REQUIRED: Clerk organization ID (created client-side first)
    practiceName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    locations: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        address: v.optional(v.string()),
        phone: v.optional(v.string()),
      })
    ),
    plan: v.string(), // 'solo' | 'practice' | 'multi-location'
    userId: v.string(), // Clerk user ID
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();
    const planTier = args.plan as "solo" | "practice" | "multi-location";

    // Plan-based seat limits
    const PLAN_SEATS = {
      solo: 1,
      practice: 2,
      "multi-location": 5,
    };

    // 1. Create (or adopt) organization with Clerk org ID
    // The Clerk webhook may have already created an org for this clerkOrgId if it
    // fired before this mutation ran (webhook retry window < onboarding 2s delay).
    // In that case, update the webhook-created org with proper onboarding data
    // rather than inserting a duplicate.
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();

    let orgId: Id<"organizations">;

    if (existingOrg) {
      // Adopt the webhook-created org — overwrite with proper onboarding data
      const cleanSlug = generateSlug(args.practiceName);
      // Only update slug if the clean version isn't already taken by a different org
      const slugConflict = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", cleanSlug))
        .first();
      await ctx.db.patch(existingOrg._id, {
        name: args.practiceName,
        slug: slugConflict && slugConflict._id !== existingOrg._id
          ? existingOrg.slug  // keep existing slug if clean one is taken
          : cleanSlug,
        plan: planTier,
        maxProviderSeats: PLAN_SEATS[planTier],
        clinicName: args.practiceName,
        clinicEmail: args.email,
        clinicPhone: args.phone,
        clinicAddress: args.address,
        updatedAt: timestamp,
      });
      orgId = existingOrg._id;
    } else {
      orgId = await ctx.db.insert("organizations", {
        name: args.practiceName,
        slug: generateSlug(args.practiceName),
        clerkOrgId: args.clerkOrgId,
        plan: planTier,
        billingStatus: "trialing",
        maxProviderSeats: PLAN_SEATS[planTier],
        clinicName: args.practiceName,
        clinicEmail: args.email,
        clinicPhone: args.phone,
        clinicAddress: args.address,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    // 2. Create locations
    const locationIds: Id<"locations">[] = [];
    for (const [index, location] of args.locations.entries()) {
      const locationId = await ctx.db.insert("locations", {
        orgId,
        name: location.name,
        address: location.address,
        phone: location.phone,
        isDefault: index === 0, // First location is default
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      locationIds.push(locationId);
    }

    // 3. Create owner membership (idempotent — webhook may have created it)
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", args.userId))
      .first();
    if (!existingMembership) {
      await ctx.db.insert("memberships", {
        orgId,
        userId: args.userId,
        role: "owner",
        status: "active",
        joinedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    // 4. Initialize setup tracking (idempotent — skip if already exists)
    const existingSetup = await ctx.db
      .query("organizationSetup")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    if (!existingSetup) {
      await ctx.db.insert("organizationSetup", {
        orgId,
        onboardingCompleted: true,
        onboardingCompletedAt: timestamp,
        locationSetupCompleted: true,
        teamSetupCompleted: false,
        billingSetupCompleted: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return orgId;
  },
});

/**
 * Helper: Generate URL-safe slug from practice name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}
