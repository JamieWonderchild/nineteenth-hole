import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Get organization-wide reconciliation summary for a time range
 * Aggregates revenue recovery stats across all encounters
 */
export const getOrgReconciliationSummary = query({
  args: {
    orgId: v.id("organizations"),
    timeRange: v.optional(v.string()), // 'week' | 'month' | 'quarter' | 'year'
  },
  handler: async (ctx, args) => {
    console.log('[getOrgReconciliationSummary] Starting - orgId:', args.orgId, 'timeRange:', args.timeRange);

    try {
      // Calculate date range
      const now = new Date();
      let startDate: Date;

      switch (args.timeRange || "month") {
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "quarter":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "year":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case "month":
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      console.log('[getOrgReconciliationSummary] Date range:', startDate.toISOString(), 'to', now.toISOString());

      // Fetch encounters for org in time range
      let encounters;
      try {
        encounters = await ctx.db
          .query("encounters")
          .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
          .filter((q) => q.gte(q.field("createdAt"), startDate.toISOString()))
          .collect();
        console.log('[getOrgReconciliationSummary] Found', encounters.length, 'encounters');
      } catch (queryError) {
        console.error('[getOrgReconciliationSummary] Query error:', queryError);
        throw queryError;
      }

    // Aggregate metrics
    let totalSaved = 0;
    let totalMissedItems = 0;
    let consultationsWithMissedCharges = 0;
    const consultationCount = encounters.length;

    console.log('[getOrgReconciliationSummary] Processing', consultationCount, 'encounters');

    // For each encounter, get billing items and calculate metrics
    for (const encounter of encounters) {
      try {
        const billingItems = await ctx.db
          .query("billingItems")
          .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
          .collect();

        // Handle empty billing items gracefully
        if (!billingItems || billingItems.length === 0) {
          continue;
        }

        // Count retrospective items that are missed or newly added
        const retrospectiveItems = billingItems.filter((item) => item.phase === "retrospective");
        const missedItems = retrospectiveItems.filter(
          (item) => item.reconciliationStatus === "missed" || item.reconciliationStatus === "added" || !item.reconciliationStatus
        );

        if (missedItems.length > 0) {
          consultationsWithMissedCharges++;
          totalMissedItems += missedItems.length;

          // Calculate saved amount (sum of missed item prices)
          const savedAmount = missedItems.reduce(
            (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
            0
          );
          totalSaved += savedAmount;
        }
      } catch (error) {
        // Skip encounters that cause errors
        console.error(`Error processing encounter ${encounter._id}:`, error);
        continue;
      }
    }

      console.log('[getOrgReconciliationSummary] Success - totalSaved:', totalSaved, 'missedItems:', totalMissedItems);

      return {
        totalSaved, // Total revenue recovered (cents)
        totalMissedItems, // Total number of missed items across all encounters
        consultationsWithMissedCharges, // Number of encounters that had missed charges
        consultationCount, // Total encounters in time range
        timeRange: args.timeRange || "month",
      };
    } catch (error) {
      console.error('[getOrgReconciliationSummary] ❌ CAUGHT ERROR:', error);
      console.error('[getOrgReconciliationSummary] Error type:', typeof error);
      console.error('[getOrgReconciliationSummary] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[getOrgReconciliationSummary] Error stack:', error instanceof Error ? error.stack : 'N/A');
      // Return empty state instead of failing
      return {
        totalSaved: 0,
        totalMissedItems: 0,
        consultationsWithMissedCharges: 0,
        consultationCount: 0,
        timeRange: args.timeRange || "month",
      };
    }
  },
});

/**
 * Get list of encounters with pending reconciliations
 * Returns encounters that have retrospective items needing review
 */
export const getPendingReconciliations = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()), // Max number of results
  },
  handler: async (ctx, args) => {
    console.log('[getPendingReconciliations] Starting - orgId:', args.orgId);

    try {
      const limit = args.limit || 50;

    // Get recent encounters for this org
    const encounters = await ctx.db
      .query("encounters")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(200); // Check last 200 encounters for pending reconciliations

    console.log('[getPendingReconciliations] Found', encounters.length, 'encounters');

    const pendingReconciliations: Array<{
      encounterId: Id<"encounters">;
      patientId: Id<"patients">;
      patientName: string;
      date: string;
      missedItemCount: number;
      savedAmount: number;
    }> = [];

    for (const encounter of encounters) {
      try {
        // Get billing items for this encounter
        const billingItems = await ctx.db
          .query("billingItems")
          .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
          .collect();

        // Handle empty billing items
        if (!billingItems || billingItems.length === 0) {
          continue;
        }

        // Check for retrospective items that need reconciliation
        const retrospectiveItems = billingItems.filter((item) => item.phase === "retrospective");
        const missedItems = retrospectiveItems.filter(
          (item) => item.reconciliationStatus === "missed" || item.reconciliationStatus === "added" || !item.reconciliationStatus
        );

        if (missedItems.length > 0) {
          // Get patient info
          const patient = await ctx.db.get(encounter.patientId);
          if (!patient) continue;

          // Calculate saved amount for this encounter
          const savedAmount = missedItems.reduce(
            (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
            0
          );

          pendingReconciliations.push({
            encounterId: encounter._id,
            patientId: patient._id,
            patientName: patient.name,
            date: encounter.date || new Date().toISOString(),
            missedItemCount: missedItems.length,
            savedAmount,
          });

          // Stop if we've reached the limit
          if (pendingReconciliations.length >= limit) {
            break;
          }
        }
      } catch (error) {
        // Skip encounters that cause errors
        console.error(`Error processing encounter ${encounter._id}:`, error);
        continue;
      }
    }

      console.log('[getPendingReconciliations] Success - found', pendingReconciliations.length, 'pending');

      return pendingReconciliations;
    } catch (error) {
      console.error('[getPendingReconciliations] ❌ CAUGHT ERROR:', error);
      console.error('[getPendingReconciliations] Error details:', error instanceof Error ? error.message : String(error));
      return [];
    }
  },
});

/**
 * Get billing catalog statistics for the organization
 */
export const getCatalogStats = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    console.log('[getCatalogStats] Starting - orgId:', args.orgId);

    try {
      // Get all active catalog items for this org
      const catalogItems = await ctx.db
        .query("billingCatalog")
        .withIndex("by_org_active", (q) => q.eq("orgId", args.orgId).eq("isActive", true))
        .collect();

      console.log('[getCatalogStats] Found', catalogItems.length, 'catalog items');

    const totalItems = catalogItems.length;

    // Group by category
    const categoryCounts: Record<string, number> = {};
    for (const item of catalogItems) {
      const category = item.category;
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }

    // Convert to array sorted by count
    const categoryBreakdown = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

      console.log('[getCatalogStats] Success - totalItems:', totalItems);

      return {
        totalItems,
        categoryBreakdown,
      };
    } catch (error) {
      console.error('[getCatalogStats] ❌ CAUGHT ERROR:', error);
      console.error('[getCatalogStats] Error details:', error instanceof Error ? error.message : String(error));
      return {
        totalItems: 0,
        categoryBreakdown: [],
      };
    }
  },
});

/**
 * Get revenue recovery trend data for charts
 * Returns daily aggregates for the last 30 days
 */
export const getRevenueTrend = query({
  args: {
    orgId: v.id("organizations"),
    days: v.optional(v.number()), // Number of days to look back (default 30)
  },
  handler: async (ctx, args) => {
    console.log('[getRevenueTrend] Starting - orgId:', args.orgId, 'days:', args.days);

    try {
      const days = args.days || 30;
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Fetch encounters in time range
      const encounters = await ctx.db
        .query("encounters")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .filter((q) => q.gte(q.field("createdAt"), startDate.toISOString()))
        .collect();

      console.log('[getRevenueTrend] Found', encounters.length, 'encounters');

    // Group by date
    const dailyData: Record<string, { date: string; savedAmount: number; missedItemCount: number }> = {};

    for (const encounter of encounters) {
      try {
        // Handle missing or malformed dates
        if (!encounter.date) continue;
        const date = encounter.date.includes("T")
          ? encounter.date.split("T")[0]
          : encounter.date.split(" ")[0]; // Handle space-separated format

        if (!dailyData[date]) {
          dailyData[date] = { date, savedAmount: 0, missedItemCount: 0 };
        }

        // Get billing items
        const billingItems = await ctx.db
          .query("billingItems")
          .withIndex("by_encounter", (q) => q.eq("encounterId", encounter._id))
          .collect();

        // Handle empty billing items
        if (!billingItems || billingItems.length === 0) {
          continue;
        }

        const retrospectiveItems = billingItems.filter((item) => item.phase === "retrospective");
        const missedItems = retrospectiveItems.filter(
          (item) => item.reconciliationStatus === "missed" || item.reconciliationStatus === "added" || !item.reconciliationStatus
        );

        if (missedItems.length > 0) {
          const savedAmount = missedItems.reduce(
            (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
            0
          );
          dailyData[date].savedAmount += savedAmount;
          dailyData[date].missedItemCount += missedItems.length;
        }
      } catch (error) {
        // Skip encounters that cause errors
        console.error(`Error processing encounter ${encounter._id}:`, error);
        continue;
      }
    }

    // Convert to array and sort by date
      const trendData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

      console.log('[getRevenueTrend] Success - data points:', trendData.length);

      return trendData;
    } catch (error) {
      console.error('[getRevenueTrend] ❌ CAUGHT ERROR:', error);
      console.error('[getRevenueTrend] Error details:', error instanceof Error ? error.message : String(error));
      return [];
    }
  },
});
