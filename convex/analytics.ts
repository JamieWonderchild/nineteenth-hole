// Analytics queries for multi-location dashboard
import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Get encounter counts grouped by location
 */
export const getConsultationCountsByLocation = query({
  args: {
    orgId: v.id("organizations"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all locations for this org
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Get encounters for each location
    const results = await Promise.all(
      locations.map(async (location) => {
        let encounters = await ctx.db
          .query("encounters")
          .withIndex("by_org_location", (q) =>
            q.eq("orgId", args.orgId).eq("locationId", location._id)
          )
          .collect();

        // Apply date filter if provided
        if (args.startDate) {
          encounters = encounters.filter(
            (c) => c.createdAt >= args.startDate!
          );
        }
        if (args.endDate) {
          encounters = encounters.filter(
            (c) => c.createdAt <= args.endDate!
          );
        }

        return {
          locationId: location._id,
          locationName: location.name,
          count: encounters.length,
        };
      })
    );

    // Also get encounters without location assignment (legacy data)
    let unassignedConsultations = await ctx.db
      .query("encounters")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("locationId"), undefined))
      .collect();

    if (args.startDate) {
      unassignedConsultations = unassignedConsultations.filter(
        (c) => c.createdAt >= args.startDate!
      );
    }
    if (args.endDate) {
      unassignedConsultations = unassignedConsultations.filter(
        (c) => c.createdAt <= args.endDate!
      );
    }

    if (unassignedConsultations.length > 0) {
      results.push({
        locationId: null as any,
        locationName: "Unassigned",
        count: unassignedConsultations.length,
      });
    }

    return results;
  },
});

/**
 * Get patient counts grouped by location
 */
export const getPatientCountsByLocation = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Get all locations for this org
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Get patients for each location
    const results = await Promise.all(
      locations.map(async (location) => {
        const patients = await ctx.db
          .query("patients")
          .withIndex("by_org_location", (q) =>
            q.eq("orgId", args.orgId).eq("locationId", location._id)
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        return {
          locationId: location._id,
          locationName: location.name,
          count: patients.length,
        };
      })
    );

    // Get unassigned patients
    const unassignedPatients = await ctx.db
      .query("patients")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) =>
        q.and(
          q.eq(q.field("locationId"), undefined),
          q.eq(q.field("isActive"), true)
        )
      )
      .collect();

    if (unassignedPatients.length > 0) {
      results.push({
        locationId: null as any,
        locationName: "Unassigned",
        count: unassignedPatients.length,
      });
    }

    return results;
  },
});

/**
 * Get detailed stats for a single location (for drill-down page)
 */
export const getLocationStats = query({
  args: {
    locationId: v.id("locations"),
    timeRange: v.optional(v.string()), // 'week' | 'month' | 'year'
  },
  handler: async (ctx, args) => {
    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");

    const now = new Date();
    let startDate: Date;

    switch (args.timeRange) {
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "year":
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        // All time
        startDate = new Date(0);
    }

    const startDateISO = startDate.toISOString();

    // Get encounters for this location
    const allConsultations = await ctx.db
      .query("encounters")
      .withIndex("by_org_location", (q) =>
        q.eq("orgId", location.orgId).eq("locationId", args.locationId)
      )
      .collect();

    const consultationsInRange = allConsultations.filter(
      (c) => c.createdAt >= startDateISO
    );

    // Get patients for this location
    const patients = await ctx.db
      .query("patients")
      .withIndex("by_org_location", (q) =>
        q.eq("orgId", location.orgId).eq("locationId", args.locationId)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return {
      location,
      totalPatients: patients.length,
      totalConsultations: allConsultations.length,
      consultationsInRange: consultationsInRange.length,
      timeRange: args.timeRange || "all",
      recentConsultations: consultationsInRange
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10),
    };
  },
});
