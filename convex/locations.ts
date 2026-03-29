// convex/locations.ts
// Multi-location support for organizations
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgAccess, canManageTeam } from "./permissions";

export const create = mutation({
  args: {
    userId: v.string(),
    orgId: v.id("organizations"),
    name: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("Unauthorized");

    const membership = await requireOrgAccess(ctx, args.userId, args.orgId);
    if (!canManageTeam(membership)) {
      throw new Error("Forbidden: only admins can create locations");
    }

    const timestamp = new Date().toISOString();

    // If this is set as default, unset any existing default
    if (args.isDefault) {
      const existing = await ctx.db
        .query("locations")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .filter((q) => q.eq(q.field("isDefault"), true))
        .collect();

      for (const loc of existing) {
        await ctx.db.patch(loc._id, { isDefault: false, updatedAt: timestamp });
      }
    }

    return await ctx.db.insert("locations", {
      orgId: args.orgId,
      name: args.name,
      address: args.address,
      phone: args.phone,
      isDefault: args.isDefault ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const getByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("locations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined)) // Exclude archived
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("locations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const update = mutation({
  args: {
    userId: v.string(),
    id: v.id("locations"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("Unauthorized");

    const location = await ctx.db.get(args.id);
    if (!location) throw new Error("Location not found");

    const membership = await requireOrgAccess(ctx, args.userId, location.orgId);
    if (!canManageTeam(membership)) {
      throw new Error("Forbidden: only admins can update locations");
    }

    const timestamp = new Date().toISOString();

    // If setting as default, unset others
    if (args.isDefault) {
      const existing = await ctx.db
        .query("locations")
        .withIndex("by_org", (q) => q.eq("orgId", location.orgId))
        .filter((q) =>
          q.and(
            q.eq(q.field("isDefault"), true),
            q.neq(q.field("_id"), args.id)
          )
        )
        .collect();

      for (const loc of existing) {
        await ctx.db.patch(loc._id, { isDefault: false, updatedAt: timestamp });
      }
    }

    const { id, userId, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    await ctx.db.patch(id, { ...updates, updatedAt: timestamp });
  },
});

export const remove = mutation({
  args: {
    userId: v.string(),
    id: v.id("locations"),
  },
  handler: async (ctx, args) => {
    if (!args.userId) throw new Error("Unauthorized");

    const location = await ctx.db.get(args.id);
    if (!location) throw new Error("Location not found");

    const membership = await requireOrgAccess(ctx, args.userId, location.orgId);
    if (!canManageTeam(membership)) {
      throw new Error("Forbidden: only admins can delete locations");
    }

    if (location.isDefault) {
      throw new Error("Cannot delete the default location");
    }

    // TODO: Check if location has assigned data (patients, encounters)
    // and prevent deletion if so

    await ctx.db.delete(args.id);
  },
});
