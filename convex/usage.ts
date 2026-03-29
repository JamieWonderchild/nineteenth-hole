// convex/usage.ts
// Usage tracking for billing - encounters, companion sessions, documents
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Record a usage event
export const record = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.string(),
    type: v.string(), // 'encounter' | 'companion' | 'document'
  },
  handler: async (ctx, args) => {
    // Calculate billing period start (1st of current month)
    const now = new Date();
    const billingPeriodStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();

    return await ctx.db.insert("usageRecords", {
      orgId: args.orgId,
      userId: args.userId,
      type: args.type,
      billingPeriodStart,
      createdAt: new Date().toISOString(),
    });
  },
});

// Get usage counts for current billing period
export const getCurrentUsage = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const now = new Date();
    const billingPeriodStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();

    const records = await ctx.db
      .query("usageRecords")
      .withIndex("by_org_period", (q) =>
        q.eq("orgId", args.orgId).eq("billingPeriodStart", billingPeriodStart)
      )
      .collect();

    const encounters = records.filter((r) => r.type === "encounter").length;
    const companions = records.filter((r) => r.type === "companion").length;
    const documents = records.filter((r) => r.type === "document").length;

    return { encounters, companions, documents };
  },
});

// Get usage for a specific type in the current period
export const getUsageByType = query({
  args: {
    orgId: v.id("organizations"),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const billingPeriodStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();

    const records = await ctx.db
      .query("usageRecords")
      .withIndex("by_org_type_period", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("type", args.type)
          .eq("billingPeriodStart", billingPeriodStart)
      )
      .collect();

    return records.length;
  },
});

// Get usage by user for current period (for per-provider analytics)
export const getUsageByUser = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const now = new Date();
    const billingPeriodStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).toISOString();

    const records = await ctx.db
      .query("usageRecords")
      .withIndex("by_org_period", (q) =>
        q.eq("orgId", args.orgId).eq("billingPeriodStart", billingPeriodStart)
      )
      .collect();

    // Group by userId
    const byUser: Record<
      string,
      { encounters: number; companions: number; documents: number }
    > = {};

    for (const record of records) {
      if (!byUser[record.userId]) {
        byUser[record.userId] = { encounters: 0, companions: 0, documents: 0 };
      }
      if (record.type === "encounter") byUser[record.userId].encounters++;
      else if (record.type === "companion") byUser[record.userId].companions++;
      else if (record.type === "document") byUser[record.userId].documents++;
    }

    return byUser;
  },
});
