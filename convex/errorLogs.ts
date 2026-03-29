// convex/errorLogs.ts
// Error logging for debugging production issues, especially Corti integration failures
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Log an error from any part of the application
export const logError = mutation({
  args: {
    category: v.union(
      v.literal("corti-stream"),
      v.literal("corti-facts"),
      v.literal("corti-document"),
      v.literal("corti-agent"),
      v.literal("corti-auth"),
      v.literal("websocket"),
      v.literal("client-error"),
      v.literal("other")
    ),
    severity: v.union(
      v.literal("error"),
      v.literal("warning"),
      v.literal("info")
    ),
    message: v.string(),
    stack: v.optional(v.string()),
    interactionId: v.optional(v.string()),
    endpoint: v.optional(v.string()),
    requestPayload: v.optional(v.string()), // JSON stringified, sanitized
    userId: v.optional(v.string()),
    orgId: v.optional(v.id("organizations")),
    metadata: v.optional(v.string()), // Additional context as JSON
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    await ctx.db.insert("errorLogs", {
      ...args,
      createdAt: now,
      resolved: false,
    });
  },
});

// Get all error logs (superadmin only)
export const getErrorLogs = query({
  args: {
    limit: v.optional(v.number()),
    category: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("errorLogs").order("desc");

    // Apply filters if provided
    const logs = await query.collect();

    let filtered = logs;

    if (args.category) {
      filtered = filtered.filter(log => log.category === args.category);
    }

    if (args.startDate) {
      filtered = filtered.filter(log => log.createdAt >= args.startDate!);
    }

    if (args.endDate) {
      filtered = filtered.filter(log => log.createdAt <= args.endDate!);
    }

    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

// Mark error as resolved
export const markErrorResolved = mutation({
  args: {
    errorId: v.id("errorLogs"),
    resolved: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.errorId, {
      resolved: args.resolved,
    });
  },
});

// Get error statistics
export const getErrorStats = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let logs = await ctx.db.query("errorLogs").order("desc").collect();

    if (args.startDate) {
      logs = logs.filter(log => log.createdAt >= args.startDate!);
    }

    if (args.endDate) {
      logs = logs.filter(log => log.createdAt <= args.endDate!);
    }

    // Count by category
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    logs.forEach(log => {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
    });

    return {
      total: logs.length,
      unresolved: logs.filter(l => !l.resolved).length,
      byCategory,
      bySeverity,
    };
  },
});
