// convex/auditLogs.ts
// HIPAA-compliant audit logging for PHI access events
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

export type AuditAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'share'
  | 'generate'    // document generation
  | 'login'
  | 'logout'
  | 'print';

export type AuditResourceType =
  | 'encounter'
  | 'patient'
  | 'document'
  | 'companion'
  | 'recording'
  | 'billing'
  | 'auth';

// ============================================================================
// INTERNAL MUTATION — called from within other mutations/actions
// ============================================================================

export const log = internalMutation({
  args: {
    orgId: v.optional(v.id("organizations")),
    userId: v.string(),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    metadata: v.optional(v.string()), // JSON stringified
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      orgId: args.orgId,
      userId: args.userId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      metadata: args.metadata,
      timestamp: new Date().toISOString(),
    });
  },
});

// ============================================================================
// QUERIES — for admin/HIPAA audit review
// ============================================================================

export const getByOrg = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
    resourceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("auditLogs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId));

    const logs = await q.order("desc").take(args.limit ?? 100);

    if (args.resourceType) {
      return logs.filter((l) => l.resourceType === args.resourceType);
    }
    return logs;
  },
});

export const getByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 100);
  },
});

export const getByResource = query({
  args: {
    resourceType: v.string(),
    resourceId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_resource", (q) =>
        q.eq("resourceType", args.resourceType).eq("resourceId", args.resourceId)
      )
      .order("desc")
      .take(200);
  },
});
