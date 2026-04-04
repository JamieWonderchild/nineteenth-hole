import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    providerId: v.string(),
    locationId: v.optional(v.id("locations")),
    patientId: v.optional(v.id("patients")),
    patientName: v.string(),
    scheduledDate: v.string(),       // YYYY-MM-DD
    scheduledTime: v.optional(v.string()), // "09:30"
    duration: v.optional(v.number()), // minutes
    type: v.string(),                // 'new-patient' | 'follow-up' | 'telehealth' | 'procedure' | 'other'
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = new Date().toISOString();
    return ctx.db.insert("appointments", {
      ...args,
      status: "scheduled",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const getByOrgAndDate = query({
  args: {
    orgId: v.id("organizations"),
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_org_date", (q) =>
        q.eq("orgId", args.orgId).eq("scheduledDate", args.date)
      )
      .collect();

    return appointments.sort((a, b) => {
      if (!a.scheduledTime && !b.scheduledTime) return 0;
      if (!a.scheduledTime) return 1;
      if (!b.scheduledTime) return -1;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });
  },
});

export const getUpcomingByOrg = query({
  args: {
    orgId: v.id("organizations"),
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split("T")[0];
    const daysAhead = args.daysAhead ?? 7;
    const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const all = await ctx.db
      .query("appointments")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", args.orgId).eq("status", "scheduled")
      )
      .collect();

    return all
      .filter((a) => a.scheduledDate >= today && a.scheduledDate <= cutoff)
      .sort((a, b) => {
        const dateCompare = a.scheduledDate.localeCompare(b.scheduledDate);
        if (dateCompare !== 0) return dateCompare;
        if (!a.scheduledTime && !b.scheduledTime) return 0;
        if (!a.scheduledTime) return 1;
        if (!b.scheduledTime) return -1;
        return a.scheduledTime.localeCompare(b.scheduledTime);
      });
  },
});

export const updateStatus = mutation({
  args: {
    appointmentId: v.id("appointments"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.appointmentId, {
      status: args.status,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const linkEncounter = mutation({
  args: {
    appointmentId: v.id("appointments"),
    encounterId: v.id("encounters"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.appointmentId, {
      encounterId: args.encounterId,
      status: "in-progress",
      updatedAt: new Date().toISOString(),
    });
  },
});

export const cancel = mutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.appointmentId, {
      status: "cancelled",
      updatedAt: new Date().toISOString(),
    });
  },
});
