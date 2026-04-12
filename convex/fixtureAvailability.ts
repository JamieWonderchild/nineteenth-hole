import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Queries ───────────────────────────────────────────────────────────────────

export const listByFixture = query({
  args: { fixtureId: v.id("interclubFixtures") },
  handler: async (ctx, { fixtureId }) => {
    const entries = await ctx.db
      .query("fixtureAvailability")
      .withIndex("by_fixture", q => q.eq("fixtureId", fixtureId))
      .collect();

    return Promise.all(
      entries.map(async e => {
        const member = await ctx.db.get(e.memberId);
        return { ...e, member };
      })
    );
  },
});

export const getMyAvailability = query({
  args: { fixtureId: v.id("interclubFixtures") },
  handler: async (ctx, { fixtureId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    for (const m of memberships) {
      const entry = await ctx.db
        .query("fixtureAvailability")
        .withIndex("by_fixture_and_member", q => q.eq("fixtureId", fixtureId).eq("memberId", m._id))
        .unique();
      if (entry) return entry;
    }
    return null;
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const markAvailability = mutation({
  args: {
    fixtureId: v.id("interclubFixtures"),
    teamId: v.id("interclubTeams"),
    memberId: v.id("clubMembers"),
    status: v.union(v.literal("available"), v.literal("unavailable"), v.literal("tentative")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { fixtureId, teamId, memberId, status, note }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Allow the member themselves, captain, or club admin
    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");

    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);

    if (!isSuperAdmin && member.userId !== identity.subject) {
      // Check if caller is captain or admin
      const team = await ctx.db.get(teamId);
      const isCapable = team?.captainUserId === identity.subject;
      if (!isCapable && member.clubId) {
        const caller = await ctx.db
          .query("clubMembers")
          .withIndex("by_club_and_user", q => q.eq("clubId", member.clubId).eq("userId", identity.subject))
          .unique();
        if (!caller || caller.role !== "admin") throw new Error("Not authorised");
      }
    }

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("fixtureAvailability")
      .withIndex("by_fixture_and_member", q => q.eq("fixtureId", fixtureId).eq("memberId", memberId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { status, note, updatedAt: now });
      return existing._id;
    }

    return ctx.db.insert("fixtureAvailability", {
      fixtureId,
      teamId,
      memberId,
      status,
      note,
      updatedAt: now,
    });
  },
});
