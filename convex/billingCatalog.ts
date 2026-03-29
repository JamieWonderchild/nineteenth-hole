import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgAccess, canManageTeam } from "./permissions";

// Valid catalog categories
const VALID_CATEGORIES = [
  'exam',
  'procedure',
  'lab',
  'medication',
  'supply',
  'imaging',
  'hospitalization',
  'other'
] as const;

/**
 * Create a new billing catalog item
 */
export const create = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
    code: v.string(),
    category: v.string(),
    basePrice: v.number(),
    taxable: v.boolean(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Permission check
    const membership = await requireOrgAccess(ctx, args.userId, args.orgId);
    if (!canManageTeam(membership)) {
      throw new Error("Forbidden: only owners and admins can manage billing catalog");
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(args.category as any)) {
      throw new Error(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    // Validate price
    if (args.basePrice < 0) {
      throw new Error("Price must be greater than or equal to 0");
    }

    // Check code uniqueness (only among active items)
    const existing = await ctx.db
      .query("billingCatalog")
      .withIndex("by_org_code", (q) =>
        q.eq("orgId", args.orgId).eq("code", args.code.toUpperCase())
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (existing) {
      throw new Error(`An active item with code "${args.code.toUpperCase()}" already exists`);
    }

    // Create item
    const now = new Date().toISOString();
    const itemId = await ctx.db.insert("billingCatalog", {
      orgId: args.orgId,
      name: args.name,
      code: args.code.toUpperCase(),
      category: args.category,
      basePrice: args.basePrice,
      taxable: args.taxable,
      description: args.description,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return itemId;
  },
});

/**
 * Update an existing billing catalog item
 */
export const update = mutation({
  args: {
    userId: v.string(),
    id: v.id("billingCatalog"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    category: v.optional(v.string()),
    basePrice: v.optional(v.number()),
    taxable: v.optional(v.boolean()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get existing item
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }

    // Permission check
    const membership = await requireOrgAccess(ctx, args.userId, item.orgId);
    if (!canManageTeam(membership)) {
      throw new Error("Forbidden: only owners and admins can manage billing catalog");
    }

    // Validate category if provided
    if (args.category && !VALID_CATEGORIES.includes(args.category as any)) {
      throw new Error(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    // Validate price if provided
    if (args.basePrice !== undefined && args.basePrice < 0) {
      throw new Error("Price must be greater than or equal to 0");
    }

    // Check code uniqueness if changing code
    if (args.code && args.code.toUpperCase() !== item.code) {
      const newCode = args.code.toUpperCase();
      const existing = await ctx.db
        .query("billingCatalog")
        .withIndex("by_org_code", (q) =>
          q.eq("orgId", item.orgId).eq("code", newCode)
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (existing) {
        throw new Error(`An active item with code "${newCode}" already exists`);
      }
    }

    // Update item
    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.code !== undefined && { code: args.code.toUpperCase() }),
      ...(args.category !== undefined && { category: args.category }),
      ...(args.basePrice !== undefined && { basePrice: args.basePrice }),
      ...(args.taxable !== undefined && { taxable: args.taxable }),
      ...(args.description !== undefined && { description: args.description }),
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Archive a billing catalog item (soft delete)
 */
export const archive = mutation({
  args: {
    userId: v.string(),
    id: v.id("billingCatalog"),
  },
  handler: async (ctx, args) => {
    // Get existing item
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }

    // Permission check
    const membership = await requireOrgAccess(ctx, args.userId, item.orgId);
    if (!canManageTeam(membership)) {
      throw new Error("Forbidden: only owners and admins can manage billing catalog");
    }

    // Archive item
    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
  },
});

/**
 * Get active billing catalog items for an organization
 */
export const getByOrg = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("billingCatalog")
      .withIndex("by_org_active", (q) =>
        q.eq("orgId", args.orgId).eq("isActive", true)
      )
      .collect();

    // Sort by most recent first
    return items.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
});

/**
 * Create a catalog item from within the billing/invoice flow.
 * Any org member (not just admins) can call this — providers build the catalog
 * organically by adding items they charge for that aren't there yet.
 */
export const createFromBilling = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
    code: v.string(),
    category: v.string(),
    basePrice: v.number(),
    taxable: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.userId, args.orgId);

    if (!VALID_CATEGORIES.includes(args.category as any)) {
      throw new Error(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
    if (args.basePrice < 0) {
      throw new Error("Price must be 0 or greater");
    }

    const upperCode = args.code.toUpperCase();
    const existing = await ctx.db
      .query("billingCatalog")
      .withIndex("by_org_code", (q) => q.eq("orgId", args.orgId).eq("code", upperCode))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (existing) {
      throw new Error(`CODE_CONFLICT:${upperCode}`);
    }

    const now = new Date().toISOString();
    return await ctx.db.insert("billingCatalog", {
      orgId: args.orgId,
      name: args.name,
      code: upperCode,
      category: args.category,
      basePrice: args.basePrice,
      taxable: args.taxable,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Get all billing catalog items (including archived) for an organization
 */
export const getAllByOrg = query({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("billingCatalog")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Sort by most recent first
    return items.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
});
