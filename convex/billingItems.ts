import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgAccess } from "./permissions";

/**
 * Create a prospective billing item (auto-extracted from facts)
 */
export const createProspective = mutation({
  args: {
    userId: v.string(),
    encounterId: v.id("encounters"),
    orgId: v.id("organizations"),
    recordingId: v.optional(v.id("recordings")),
    catalogItemId: v.optional(v.id("billingCatalog")),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    taxable: v.boolean(),
    extractedFromFact: v.optional(v.string()),
    confidence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Permission check
    await requireOrgAccess(ctx, args.userId, args.orgId);

    // Validation
    if (args.quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }
    if (args.unitPrice < 0) {
      throw new Error("Unit price must be greater than or equal to 0");
    }

    // Create billing item
    const now = new Date().toISOString();
    const id = await ctx.db.insert("billingItems", {
      encounterId: args.encounterId,
      orgId: args.orgId,
      recordingId: args.recordingId,
      catalogItemId: args.catalogItemId,
      description: args.description,
      quantity: args.quantity,
      unitPrice: args.unitPrice,
      taxable: args.taxable,
      phase: "prospective",
      manuallyAdded: false,
      extractedFromFact: args.extractedFromFact,
      confidence: args.confidence,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Create a retrospective billing item (auto-extracted from retrospective recording)
 */
export const createRetrospective = mutation({
  args: {
    userId: v.string(),
    encounterId: v.id("encounters"),
    orgId: v.id("organizations"),
    recordingId: v.optional(v.id("recordings")),
    catalogItemId: v.optional(v.id("billingCatalog")),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    taxable: v.boolean(),
    extractedFromFact: v.optional(v.string()),
    confidence: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Permission check
    await requireOrgAccess(ctx, args.userId, args.orgId);

    // Validation
    if (args.quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }
    if (args.unitPrice < 0) {
      throw new Error("Unit price must be greater than or equal to 0");
    }

    // Create billing item
    const now = new Date().toISOString();
    const id = await ctx.db.insert("billingItems", {
      encounterId: args.encounterId,
      orgId: args.orgId,
      recordingId: args.recordingId,
      catalogItemId: args.catalogItemId,
      description: args.description,
      quantity: args.quantity,
      unitPrice: args.unitPrice,
      taxable: args.taxable,
      phase: "retrospective",
      manuallyAdded: false,
      extractedFromFact: args.extractedFromFact,
      confidence: args.confidence,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Create a manual billing item (selected from catalog by provider)
 */
export const createManual = mutation({
  args: {
    userId: v.string(),
    encounterId: v.id("encounters"),
    orgId: v.id("organizations"),
    recordingId: v.optional(v.id("recordings")),
    catalogItemId: v.id("billingCatalog"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    // Permission check
    await requireOrgAccess(ctx, args.userId, args.orgId);

    // Validation
    if (args.quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    // Fetch catalog item to snapshot price/taxable
    const catalogItem = await ctx.db.get(args.catalogItemId);
    if (!catalogItem) {
      throw new Error("Catalog item not found");
    }

    // Verify catalog item belongs to same org
    if (catalogItem.orgId !== args.orgId) {
      throw new Error("Catalog item does not belong to this organization");
    }

    // Create billing item
    const now = new Date().toISOString();
    const id = await ctx.db.insert("billingItems", {
      encounterId: args.encounterId,
      orgId: args.orgId,
      recordingId: args.recordingId,
      catalogItemId: args.catalogItemId,
      description: catalogItem.name,
      quantity: args.quantity,
      unitPrice: catalogItem.basePrice,
      taxable: catalogItem.taxable,
      phase: "prospective",
      manuallyAdded: true,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Update a billing item
 */
export const update = mutation({
  args: {
    userId: v.string(),
    id: v.id("billingItems"),
    quantity: v.optional(v.number()),
    unitPrice: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Fetch item
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Billing item not found");
    }

    // Permission check
    await requireOrgAccess(ctx, args.userId, item.orgId);

    // Validation
    if (args.quantity !== undefined && args.quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }
    if (args.unitPrice !== undefined && args.unitPrice < 0) {
      throw new Error("Unit price must be greater than or equal to 0");
    }

    // Update
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.unitPrice !== undefined) updates.unitPrice = args.unitPrice;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.id, updates);
  },
});

/**
 * Remove a billing item
 */
export const remove = mutation({
  args: {
    userId: v.string(),
    id: v.id("billingItems"),
  },
  handler: async (ctx, args) => {
    // Fetch item
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Billing item not found");
    }

    // Permission check
    await requireOrgAccess(ctx, args.userId, item.orgId);

    // Delete
    await ctx.db.delete(args.id);
  },
});

/**
 * Get billing items for a encounter
 */
export const getByConsultation = query({
  args: {
    encounterId: v.id("encounters"),
    phase: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let items = await ctx.db
      .query("billingItems")
      .withIndex("by_encounter", (q) => q.eq("encounterId", args.encounterId))
      .collect();

    // Filter by phase if provided
    if (args.phase) {
      items = items.filter((item) => item.phase === args.phase);
    }

    // Sort by creation time
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return items;
  },
});
