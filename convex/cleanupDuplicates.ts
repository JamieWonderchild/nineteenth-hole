// convex/cleanupDuplicates.ts
// One-time cleanup script for duplicate organizations

import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";

function assertSuperadmin(callerEmail: string) {
  const allowed = (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!allowed.includes(callerEmail.toLowerCase())) {
    throw new Error("Forbidden: not a superadmin");
  }
}

/**
 * Find duplicate organizations (same Clerk Org ID, different Convex IDs)
 */
export const findDuplicates = action({
  args: { callerEmail: v.string() },
  handler: async (ctx, args): Promise<any> => {
    assertSuperadmin(args.callerEmail);

    const orgs = await ctx.runQuery(internal.cleanupDuplicates.getAllOrgs);
    const providers = await ctx.runQuery(internal.cleanupDuplicates.getAllVets);

    // Group by Clerk org ID
    const grouped = new Map<string, typeof orgs>();
    for (const org of orgs) {
      if (!org.clerkOrgId) continue; // Skip orgs without Clerk ID
      const key = org.clerkOrgId;
      const existing = grouped.get(key) || [];
      grouped.set(key, [...existing, org]);
    }

    // Find duplicates
    const duplicates = Array.from(grouped.entries())
      .filter(([_, orgs]) => orgs.length > 1)
      .map(([clerkOrgId, orgs]) => {
        // Determine which org is "active" (has provider records pointing to it)
        const activeOrg = orgs.find((org) =>
          providers.some((provider) => provider.orgId === org._id)
        );

        // The orphaned org is the one without provider records
        const orphanedOrg = orgs.find((org) => org._id !== activeOrg?._id);

        return {
          clerkOrgId,
          active: activeOrg
            ? {
                _id: activeOrg._id,
                name: activeOrg.name,
                slug: activeOrg.slug,
                hasVets: true,
              }
            : null,
          orphaned: orphanedOrg
            ? {
                _id: orphanedOrg._id,
                name: orphanedOrg.name,
                slug: orphanedOrg.slug,
                hasVets: false,
              }
            : null,
        };
      });

    return {
      totalDuplicates: duplicates.length,
      duplicates,
    };
  },
});

/**
 * Clean up duplicate organizations by deleting orphaned ones
 * DRY RUN: Set dryRun=true to see what would be deleted without actually deleting
 */
export const cleanupDuplicates = action({
  args: {
    callerEmail: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    assertSuperadmin(args.callerEmail);

    const dryRun = args.dryRun ?? true; // Default to dry run for safety

    // Inline duplicate detection to avoid circular reference
    const orgs = await ctx.runQuery(internal.cleanupDuplicates.getAllOrgs);
    const providers = await ctx.runQuery(internal.cleanupDuplicates.getAllVets);

    // Group by Clerk org ID
    const grouped = new Map<string, typeof orgs>();
    for (const org of orgs) {
      if (!org.clerkOrgId) continue; // Skip orgs without Clerk ID
      const key = org.clerkOrgId;
      const existing = grouped.get(key) || [];
      grouped.set(key, [...existing, org]);
    }

    // Find duplicates
    const duplicates = Array.from(grouped.entries())
      .filter(([_, orgs]) => orgs.length > 1)
      .map(([clerkOrgId, orgs]) => {
        // Determine which org is "active" (has provider records pointing to it)
        const activeOrg = orgs.find((org) =>
          providers.some((provider) => provider.orgId === org._id)
        );

        // The orphaned org is the one without provider records
        const orphanedOrg = orgs.find((org) => org._id !== activeOrg?._id);

        return {
          clerkOrgId,
          active: activeOrg
            ? {
                _id: activeOrg._id,
                name: activeOrg.name,
                slug: activeOrg.slug,
                hasVets: true,
              }
            : null,
          orphaned: orphanedOrg
            ? {
                _id: orphanedOrg._id,
                name: orphanedOrg.name,
                slug: orphanedOrg.slug,
                hasVets: false,
              }
            : null,
        };
      });

    const result = {
      totalDuplicates: duplicates.length,
      duplicates,
    };

    const deleted: Array<{
      orgId: string;
      name: string;
      slug: string;
      membershipsDeleted: number;
    }> = [];

    for (const dup of result.duplicates) {
      if (!dup.orphaned) continue;

      // Get memberships for this org
      const memberships = await ctx.runQuery(
        internal.cleanupDuplicates.getMembershipsByOrg,
        { orgId: dup.orphaned._id }
      );

      if (!dryRun) {
        // Delete memberships first
        for (const membership of memberships) {
          await ctx.runMutation(
            internal.cleanupDuplicates.deleteMembership,
            { membershipId: membership._id }
          );
        }

        // Delete the organization
        await ctx.runMutation(internal.cleanupDuplicates.deleteOrg, {
          orgId: dup.orphaned._id,
        });
      }

      deleted.push({
        orgId: dup.orphaned._id,
        name: dup.orphaned.name,
        slug: dup.orphaned.slug,
        membershipsDeleted: memberships.length,
      });
    }

    return {
      dryRun,
      message: dryRun
        ? "DRY RUN: No changes made. Set dryRun=false to actually delete."
        : "Cleanup complete!",
      orgsToDelete: deleted.length,
      deleted,
    };
  },
});

// Internal queries and mutations
export const getAllOrgs = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});

export const getAllVets = internalQuery({
  handler: async (ctx) => {
    return await ctx.db.query("providers").collect();
  },
});

export const getMembershipsByOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const deleteMembership = internalMutation({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.membershipId);
  },
});

export const deleteOrg = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.orgId);
  },
});
