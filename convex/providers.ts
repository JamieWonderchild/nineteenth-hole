// convex/providers.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// In providers.ts
export const createOrUpdateProvider = mutation({
    args: {
      userId: v.string(),
      name: v.string(),
      email: v.string(),
      orgId: v.optional(v.id("organizations")),
      specialties: v.optional(v.array(v.string())),
      license: v.optional(v.string()),
      practiceHours: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
      const timestamp = new Date().toISOString();
      
      const existingVet = await ctx.db
        .query("providers")
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .first();
  
      if (existingVet) {
        // Define the update data with proper typing
        const updateData: {
          name: string;
          email: string;
          updatedAt: string;
          orgId?: typeof args.orgId;
          specialties?: string[];
          license?: string;
          practiceHours?: string;
        } = {
          name: args.name,
          email: args.email,
          updatedAt: timestamp,
        };

        // Set orgId if provided (backfill orphan providers)
        if (args.orgId !== undefined) updateData.orgId = args.orgId;
        // Add optional fields if they are provided
        if (args.specialties !== undefined) updateData.specialties = args.specialties;
        if (args.license !== undefined) updateData.license = args.license;
        if (args.practiceHours !== undefined) updateData.practiceHours = args.practiceHours;

        await ctx.db.patch(existingVet._id, updateData);
        return existingVet._id;
      }
  
      return await ctx.db.insert("providers", {
        userId: args.userId,
        name: args.name,
        email: args.email,
        orgId: args.orgId,
        specialties: args.specialties ?? [],
        license: args.license,
        practiceHours: args.practiceHours,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    },
  });

export const getProviderByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("providers")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
  },
});

export const updateProviderProfile = mutation({
  args: {
    userId: v.string(),
    specialties: v.optional(v.array(v.string())),
    license: v.optional(v.string()),
    practiceHours: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const provider = await ctx.db
      .query("providers")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (!provider) {
      throw new Error("Provider not found");
    }

    return await ctx.db.patch(provider._id, {
      ...args,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const deactivateProvider = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const provider = await ctx.db
      .query("providers")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (!provider) {
      throw new Error("Provider not found");
    }

    return await ctx.db.patch(provider._id, {
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const getProviderPatients = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("patients")
      .filter((q) => q.eq(q.field("providerId"), args.userId))
      .collect();
  },
});

export const getProvidersByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("providers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// Get all providers for admin (no auth check - called by admin actions)
export const getAllForAdmin = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("providers").collect();
  },
});