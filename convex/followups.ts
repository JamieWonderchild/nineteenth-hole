// convex/followups.ts
// Follow-up tracking for continuous care
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a follow-up from encounter
export const createFollowUp = mutation({
  args: {
    encounterId: v.id("encounters"),
    patientId: v.id("patients"),
    providerId: v.string(),
    orgId: v.optional(v.id("organizations")),
    scheduledDate: v.string(),
    type: v.string(),
    reason: v.string(),
    monitoringInstructions: v.optional(v.array(v.string())),
    warningSignsForPatient: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();

    return await ctx.db.insert("followUps", {
      encounterId: args.encounterId,
      patientId: args.patientId,
      providerId: args.providerId,
      orgId: args.orgId,
      scheduledDate: args.scheduledDate,
      type: args.type,
      reason: args.reason,
      status: "pending",
      reminderSent: false,
      monitoringInstructions: args.monitoringInstructions,
      warningSignsForPatient: args.warningSignsForPatient,
      notes: args.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

// Get upcoming follow-ups for a provider
export const getUpcoming = query({
  args: {
    providerId: v.string(),
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const daysAhead = args.daysAhead ?? 14;
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const followUps = await ctx.db
      .query("followUps")
      .withIndex("by_provider_status", (q) =>
        q.eq("providerId", args.providerId).eq("status", "pending")
      )
      .collect();

    return followUps.filter(
      (f) => new Date(f.scheduledDate) <= cutoff
    );
  },
});

// Get follow-ups for a specific patient
export const getByPatient = query({
  args: { patientId: v.id("patients") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("followUps")
      .withIndex("by_patient", (q) => q.eq("patientId", args.patientId))
      .collect();
  },
});

// Update follow-up status
export const updateStatus = mutation({
  args: {
    followUpId: v.id("followUps"),
    status: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();
    const update: Record<string, unknown> = {
      status: args.status,
      updatedAt: timestamp,
    };

    if (args.status === "completed") {
      update.completedDate = timestamp;
    }

    if (args.notes) {
      update.notes = args.notes;
    }

    await ctx.db.patch(args.followUpId, update);
    return { success: true };
  },
});

// Mark reminder as sent
export const markReminderSent = mutation({
  args: { followUpId: v.id("followUps") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.followUpId, {
      reminderSent: true,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Get overdue follow-ups (for dashboard alerts)
export const getOverdue = query({
  args: { providerId: v.string() },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    const pending = await ctx.db
      .query("followUps")
      .withIndex("by_provider_status", (q) =>
        q.eq("providerId", args.providerId).eq("status", "pending")
      )
      .collect();

    return pending.filter((f) => f.scheduledDate < now);
  },
});

// Org-scoped follow-up queries
export const getUpcomingByOrg = query({
  args: {
    orgId: v.id("organizations"),
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = new Date();
    const daysAhead = args.daysAhead ?? 14;
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const followUps = await ctx.db
      .query("followUps")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", args.orgId).eq("status", "pending")
      )
      .collect();

    return followUps.filter((f) => new Date(f.scheduledDate) <= cutoff);
  },
});

export const getOverdueByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    const pending = await ctx.db
      .query("followUps")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", args.orgId).eq("status", "pending")
      )
      .collect();

    return pending.filter((f) => f.scheduledDate < now);
  },
});
