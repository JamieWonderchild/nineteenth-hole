// convex/adminDiagnostics.ts
// Diagnostic queries for investigating duplicate organizations

import { query } from "./_generated/server";
import { v } from "convex/values";

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
 * Find potential duplicate organizations by comparing names and Clerk IDs
 * This helps identify if orgs were created multiple times
 */
export const findDuplicateOrgs = query({
  args: { callerEmail: v.string() },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const orgs = await ctx.db.query("organizations").collect();

    // Group by name (case-insensitive)
    const nameGroups = new Map<string, typeof orgs>();
    for (const org of orgs) {
      const key = org.name.toLowerCase();
      const existing = nameGroups.get(key) || [];
      nameGroups.set(key, [...existing, org]);
    }

    // Find groups with more than one org
    const duplicatesByName = Array.from(nameGroups.entries())
      .filter(([_, orgs]) => orgs.length > 1)
      .map(([name, orgs]) => ({
        name,
        count: orgs.length,
        orgs: orgs.map((org) => ({
          _id: org._id,
          name: org.name,
          slug: org.slug,
          clerkOrgId: org.clerkOrgId,
          createdAt: org.createdAt,
          billingStatus: org.billingStatus,
          plan: org.plan,
        })),
      }));

    // Group by Clerk org ID
    const clerkIdGroups = new Map<string, typeof orgs>();
    for (const org of orgs) {
      if (!org.clerkOrgId) continue; // Skip orgs without Clerk ID
      const key = org.clerkOrgId;
      const existing = clerkIdGroups.get(key) || [];
      clerkIdGroups.set(key, [...existing, org]);
    }

    // Find Clerk IDs with more than one Convex org
    const duplicatesByClerkId = Array.from(clerkIdGroups.entries())
      .filter(([_, orgs]) => orgs.length > 1)
      .map(([clerkOrgId, orgs]) => ({
        clerkOrgId,
        count: orgs.length,
        orgs: orgs.map((org) => ({
          _id: org._id,
          name: org.name,
          slug: org.slug,
          clerkOrgId: org.clerkOrgId,
          createdAt: org.createdAt,
          billingStatus: org.billingStatus,
          plan: org.plan,
        })),
      }));

    return {
      totalOrgs: orgs.length,
      duplicatesByName,
      duplicatesByClerkId,
      summary: {
        orgsWithSameName: duplicatesByName.length,
        orgsWithSameClerkId: duplicatesByClerkId.length,
        totalDuplicateOrgs: duplicatesByName.reduce(
          (sum, group) => sum + (group.count - 1),
          0
        ),
      },
    };
  },
});

/**
 * Get detailed information about a specific organization
 */
export const getOrgDetails = query({
  args: {
    orgId: v.id("organizations"),
    callerEmail: v.string(),
  },
  handler: async (ctx, args) => {
    assertSuperadmin(args.callerEmail);

    const org = await ctx.db.get(args.orgId);
    if (!org) {
      throw new Error("Organization not found");
    }

    // Get all memberships
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Get all patients
    const patients = await ctx.db
      .query("patients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Get all encounters
    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Get all locations
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    return {
      org,
      stats: {
        memberships: memberships.length,
        patients: patients.length,
        encounters: encounters.length,
        locations: locations.length,
      },
      hasData: patients.length > 0 || encounters.length > 0,
    };
  },
});
