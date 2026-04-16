import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Queries ───────────────────────────────────────────────────────────────────

export const get = query({
  args: { tripId: v.id("golfTrips") },
  handler: async (ctx, { tripId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const trip = await ctx.db.get(tripId);
    if (!trip) return null;

    const [days, members] = await Promise.all([
      ctx.db.query("golfTripDays").withIndex("by_trip", q => q.eq("tripId", tripId)).collect(),
      ctx.db.query("golfTripMembers").withIndex("by_trip", q => q.eq("tripId", tripId)).collect(),
    ]);

    // Only members (any status) or the creator can see the trip
    const isMember = members.some(m => m.userId === identity.subject);
    if (!isMember) return null;

    const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
    return { ...trip, days: sortedDays, members };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const memberships = await ctx.db
      .query("golfTripMembers")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    const trips = await Promise.all(
      memberships.map(async (m) => {
        const trip = await ctx.db.get(m.tripId);
        if (!trip) return null;
        const members = await ctx.db
          .query("golfTripMembers")
          .withIndex("by_trip", q => q.eq("tripId", m.tripId))
          .collect();
        return { ...trip, myStatus: m.status, memberCount: members.length };
      })
    );

    return trips
      .filter(Boolean)
      .sort((a: any, b: any) => a!.startDate.localeCompare(b!.startDate));
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = new Date().toISOString();
    const tripId = await ctx.db.insert("golfTrips", {
      ...args,
      createdBy: identity.subject,
      status: "planning",
      createdAt: now,
      updatedAt: now,
    });

    // Auto-add creator as organiser
    const displayName = identity.name ?? identity.email ?? "Organiser";
    await ctx.db.insert("golfTripMembers", {
      tripId,
      userId: identity.subject,
      displayName,
      status: "organiser",
      invitedBy: identity.subject,
      invitedAt: now,
      respondedAt: now,
    });

    return tripId;
  },
});

export const update = mutation({
  args: {
    tripId: v.id("golfTrips"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { tripId, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await assertOrganiser(ctx, tripId, identity.subject);
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    await ctx.db.patch(tripId, { ...patch, updatedAt: new Date().toISOString() });
  },
});

export const setDay = mutation({
  args: {
    tripId: v.id("golfTrips"),
    date: v.string(),
    format: v.string(),
    golfCourseId: v.optional(v.id("golfCourses")),
    courseNameFreetext: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { tripId, date, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await assertOrganiser(ctx, tripId, identity.subject);

    const existing = await ctx.db
      .query("golfTripDays")
      .withIndex("by_trip_and_date", q => q.eq("tripId", tripId).eq("date", date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("golfTripDays", { tripId, date, ...fields });
    }
  },
});

export const removeDay = mutation({
  args: { tripId: v.id("golfTrips"), date: v.string() },
  handler: async (ctx, { tripId, date }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await assertOrganiser(ctx, tripId, identity.subject);

    const day = await ctx.db
      .query("golfTripDays")
      .withIndex("by_trip_and_date", q => q.eq("tripId", tripId).eq("date", date))
      .first();
    if (day) await ctx.db.delete(day._id);
  },
});

export const invite = mutation({
  args: {
    tripId: v.id("golfTrips"),
    userId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, { tripId, userId, displayName }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await assertOrganiser(ctx, tripId, identity.subject);

    const existing = await ctx.db
      .query("golfTripMembers")
      .withIndex("by_trip_and_user", q => q.eq("tripId", tripId).eq("userId", userId))
      .first();
    if (existing) throw new Error("Already invited");

    const now = new Date().toISOString();
    await ctx.db.insert("golfTripMembers", {
      tripId,
      userId,
      displayName,
      status: "invited",
      invitedBy: identity.subject,
      invitedAt: now,
    });
  },
});

export const respond = mutation({
  args: { tripId: v.id("golfTrips"), accept: v.boolean() },
  handler: async (ctx, { tripId, accept }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const membership = await ctx.db
      .query("golfTripMembers")
      .withIndex("by_trip_and_user", q => q.eq("tripId", tripId).eq("userId", identity.subject))
      .first();
    if (!membership) throw new Error("Not invited");
    if (membership.status !== "invited") throw new Error("Already responded");

    await ctx.db.patch(membership._id, {
      status: accept ? "accepted" : "declined",
      respondedAt: new Date().toISOString(),
    });
  },
});

export const removeMember = mutation({
  args: { tripId: v.id("golfTrips"), userId: v.string() },
  handler: async (ctx, { tripId, userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Must be organiser, or removing yourself
    if (identity.subject !== userId) {
      await assertOrganiser(ctx, tripId, identity.subject);
    }

    const membership = await ctx.db
      .query("golfTripMembers")
      .withIndex("by_trip_and_user", q => q.eq("tripId", tripId).eq("userId", userId))
      .first();
    if (membership && membership.status !== "organiser") {
      await ctx.db.delete(membership._id);
    }
  },
});

export const deleteTrip = mutation({
  args: { tripId: v.id("golfTrips") },
  handler: async (ctx, { tripId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await assertOrganiser(ctx, tripId, identity.subject);

    const [days, members] = await Promise.all([
      ctx.db.query("golfTripDays").withIndex("by_trip", q => q.eq("tripId", tripId)).collect(),
      ctx.db.query("golfTripMembers").withIndex("by_trip", q => q.eq("tripId", tripId)).collect(),
    ]);
    await Promise.all([
      ...days.map(d => ctx.db.delete(d._id)),
      ...members.map(m => ctx.db.delete(m._id)),
    ]);
    await ctx.db.delete(tripId);
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertOrganiser(ctx: any, tripId: any, userId: string) {
  const membership = await ctx.db
    .query("golfTripMembers")
    .withIndex("by_trip_and_user", (q: any) => q.eq("tripId", tripId).eq("userId", userId))
    .first();
  if (!membership || membership.status !== "organiser") {
    throw new Error("Not the trip organiser");
  }
}
