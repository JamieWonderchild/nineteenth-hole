import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgAccess } from "./permissions";
import { Id } from "./_generated/dataModel";
import Fuse from "fuse.js";

/**
 * Reconciliation result types
 */
export interface ReconciliationSummary {
  matched: Array<{
    prospectiveId: Id<"billingItems">;
    retrospectiveId: Id<"billingItems">;
    description: string;
    quantity: number;
    unitPrice: number;
    matchType: "exact" | "fuzzy";
  }>;
  missed: Array<{
    retrospectiveId: Id<"billingItems">;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  overPlanned: Array<{
    prospectiveId: Id<"billingItems">;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  savedAmount: number;
  totalMatched: number;
  totalMissed: number;
  totalOverPlanned: number;
}

/**
 * Reconcile prospective vs retrospective billing items
 *
 * Algorithm:
 * 1. Exact match by catalogItemId (handles 80% of cases)
 * 2. Fuzzy match by description (fallback for custom items)
 * 3. Identify missed charges (retrospective-only)
 * 4. Identify over-planned items (prospective-only)
 * 5. Calculate savings (sum of missed item prices)
 */
export const reconcile = mutation({
  args: {
    userId: v.string(),
    encounterId: v.id("encounters"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Permission check
    await requireOrgAccess(ctx, args.userId, args.orgId);

    // Fetch all billing items for this encounter
    const allItems = await ctx.db
      .query("billingItems")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    // Split by phase
    const prospective = allItems.filter((item) => item.phase === "prospective");
    const retrospective = allItems.filter((item) => item.phase === "retrospective");

    // Track matched prospective items
    const matchedProspectiveIds = new Set<Id<"billingItems">>();
    const matchedRetrospectiveIds = new Set<Id<"billingItems">>();
    const matches: Array<{
      prospectiveId: Id<"billingItems">;
      retrospectiveId: Id<"billingItems">;
      matchType: "exact" | "fuzzy";
    }> = [];

    // Step 1: Exact match by catalogItemId
    for (const retro of retrospective) {
      if (!retro.catalogItemId) continue;

      const exactMatch = prospective.find(
        (p) =>
          p.catalogItemId === retro.catalogItemId &&
          !matchedProspectiveIds.has(p._id)
      );

      if (exactMatch) {
        matchedProspectiveIds.add(exactMatch._id);
        matchedRetrospectiveIds.add(retro._id);
        matches.push({
          prospectiveId: exactMatch._id,
          retrospectiveId: retro._id,
          matchType: "exact",
        });

        // Update both items with reconciliation status
        await ctx.db.patch(exactMatch._id, {
          reconciliationStatus: "matched",
          linkedItemId: retro._id,
        });
        await ctx.db.patch(retro._id, {
          reconciliationStatus: "matched",
          linkedItemId: exactMatch._id,
        });
      }
    }

    // Step 2: Fuzzy match by description (for items without exact match)
    const unmatchedRetrospective = retrospective.filter(
      (r) => !matchedRetrospectiveIds.has(r._id)
    );
    const unmatchedProspective = prospective.filter(
      (p) => !matchedProspectiveIds.has(p._id)
    );

    if (unmatchedRetrospective.length > 0 && unmatchedProspective.length > 0) {
      // Initialize Fuse.js for fuzzy matching
      const fuse = new Fuse(unmatchedProspective, {
        keys: ["description"],
        threshold: 0.3, // Stricter threshold for billing reconciliation
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 3,
      });

      for (const retro of unmatchedRetrospective) {
        const results = fuse.search(retro.description);
        const topResult = results[0];

        if (topResult && topResult.score !== undefined && topResult.score < 0.3) {
          const fuzzyMatch = topResult.item;

          // Ensure this prospective item hasn't been matched yet
          if (!matchedProspectiveIds.has(fuzzyMatch._id)) {
            matchedProspectiveIds.add(fuzzyMatch._id);
            matchedRetrospectiveIds.add(retro._id);
            matches.push({
              prospectiveId: fuzzyMatch._id,
              retrospectiveId: retro._id,
              matchType: "fuzzy",
            });

            // Update both items with reconciliation status
            await ctx.db.patch(fuzzyMatch._id, {
              reconciliationStatus: "matched",
              linkedItemId: retro._id,
            });
            await ctx.db.patch(retro._id, {
              reconciliationStatus: "matched",
              linkedItemId: fuzzyMatch._id,
            });
          }
        }
      }
    }

    // Step 3: Mark missed charges (unmatched retrospective)
    const missedItems = retrospective.filter(
      (r) => !matchedRetrospectiveIds.has(r._id)
    );

    for (const missed of missedItems) {
      await ctx.db.patch(missed._id, {
        reconciliationStatus: "missed",
        linkedItemId: undefined,
      });
    }

    // Step 4: Mark over-planned items (unmatched prospective)
    const overPlannedItems = prospective.filter(
      (p) => !matchedProspectiveIds.has(p._id)
    );

    for (const overPlanned of overPlannedItems) {
      await ctx.db.patch(overPlanned._id, {
        reconciliationStatus: "over-planned",
        linkedItemId: undefined,
      });
    }

    // Step 5: Calculate savings (sum of missed item prices)
    const savedAmount = missedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    return {
      totalMatched: matches.length,
      totalMissed: missedItems.length,
      totalOverPlanned: overPlannedItems.length,
      savedAmount,
    };
  },
});

/**
 * Get reconciliation summary for a encounter
 */
export const getSummary = query({
  args: {
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args): Promise<ReconciliationSummary> => {
    // Fetch all billing items for this encounter
    const allItems = await ctx.db
      .query("billingItems")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    // Split by phase
    const prospective = allItems.filter((item) => item.phase === "prospective");
    const retrospective = allItems.filter((item) => item.phase === "retrospective");

    // Group by reconciliation status
    const matched: ReconciliationSummary["matched"] = [];
    const missed: ReconciliationSummary["missed"] = [];
    const overPlanned: ReconciliationSummary["overPlanned"] = [];

    // Build matched pairs
    const processedRetroIds = new Set<Id<"billingItems">>();

    for (const pro of prospective) {
      // Invoiced prospective items are perfect matches (planned AND billed)
      if (pro.invoicedAt && pro.reconciliationStatus === "matched") {
        matched.push({
          prospectiveId: pro._id,
          retrospectiveId: pro._id, // Same item (not converted to retrospective)
          description: pro.description,
          quantity: pro.quantity,
          unitPrice: pro.unitPrice,
          matchType: "exact",
        });
      } else if (pro.reconciliationStatus === "matched" && pro.linkedItemId) {
        // Legacy: prospective matched to separate retrospective item
        const retro = retrospective.find((r) => r._id === pro.linkedItemId);
        if (retro) {
          matched.push({
            prospectiveId: pro._id,
            retrospectiveId: retro._id,
            description: pro.description,
            quantity: pro.quantity,
            unitPrice: pro.unitPrice,
            matchType: pro.catalogItemId === retro.catalogItemId ? "exact" : "fuzzy",
          });
          processedRetroIds.add(retro._id);
        }
      } else if (pro.reconciliationStatus === "over-planned") {
        overPlanned.push({
          prospectiveId: pro._id,
          description: pro.description,
          quantity: pro.quantity,
          unitPrice: pro.unitPrice,
        });
      }
    }

    // Build missed items
    for (const retro of retrospective) {
      if (retro.reconciliationStatus === "missed" || !processedRetroIds.has(retro._id)) {
        const totalPrice = retro.unitPrice * retro.quantity;
        missed.push({
          retrospectiveId: retro._id,
          description: retro.description,
          quantity: retro.quantity,
          unitPrice: retro.unitPrice,
          totalPrice,
        });
      }
    }

    // Calculate savings
    const savedAmount = missed.reduce((sum, item) => sum + item.totalPrice, 0);

    return {
      matched,
      missed,
      overPlanned,
      savedAmount,
      totalMatched: matched.length,
      totalMissed: missed.length,
      totalOverPlanned: overPlanned.length,
    };
  },
});

/**
 * Convert a retrospective (missed) item to prospective (add to bill)
 */
export const addMissedItemToBill = mutation({
  args: {
    userId: v.string(),
    retrospectiveItemId: v.id("billingItems"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Permission check
    await requireOrgAccess(ctx, args.userId, args.orgId);

    // Fetch retrospective item
    const retroItem = await ctx.db.get(args.retrospectiveItemId);
    if (!retroItem) {
      throw new Error("Retrospective item not found");
    }

    if (retroItem.phase !== "retrospective") {
      throw new Error("Item is not retrospective");
    }

    if (retroItem.reconciliationStatus !== "missed") {
      throw new Error("Item is not marked as missed");
    }

    // Create prospective item (copy of retrospective)
    const now = new Date().toISOString();
    const prospectiveId = await ctx.db.insert("billingItems", {
      encounterId: retroItem.encounterId,
      orgId: retroItem.orgId,
      recordingId: retroItem.recordingId,
      catalogItemId: retroItem.catalogItemId,
      description: retroItem.description,
      quantity: retroItem.quantity,
      unitPrice: retroItem.unitPrice,
      taxable: retroItem.taxable,
      phase: "prospective",
      manuallyAdded: true, // Mark as manually added (from retrospective)
      extractedFromFact: retroItem.extractedFromFact,
      confidence: retroItem.confidence,
      reconciliationStatus: "matched",
      linkedItemId: retroItem._id,
      createdAt: now,
      updatedAt: now,
    });

    // Update retrospective item status
    await ctx.db.patch(args.retrospectiveItemId, {
      reconciliationStatus: "matched",
      linkedItemId: prospectiveId,
    });

    return prospectiveId;
  },
});
