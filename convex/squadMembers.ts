import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

function getSuperAdminEmails() {
  return (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
}

async function assertCanManageSquad(ctx: MutationCtx, teamId: Id<"interclubTeams">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  if (identity.email && getSuperAdminEmails().includes(identity.email)) return identity.subject;

  const team = await ctx.db.get(teamId);
  if (!team) throw new Error("Team not found");

  // Team captain can manage squad
  if (team.captainUserId === identity.subject) return identity.subject;

  // Club admin can also manage squad
  if (team.clubId) {
    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", team.clubId!).eq("userId", identity.subject))
      .unique();
    if (member?.role === "admin") return identity.subject;
  }

  throw new Error("Only the team captain or club admin can manage the squad");
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const listByTeam = query({
  args: { teamId: v.id("interclubTeams") },
  handler: async (ctx, { teamId }) => {
    const entries = await ctx.db
      .query("squadMembers")
      .withIndex("by_team", q => q.eq("teamId", teamId))
      .collect();

    return Promise.all(
      entries.map(async e => {
        const member = await ctx.db.get(e.memberId);
        return { ...e, member };
      })
    );
  },
});

export const listMySquads = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Find all clubMembers records for this user
    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    for (const m of memberships) {
      const squads = await ctx.db
        .query("squadMembers")
        .withIndex("by_member", q => q.eq("memberId", m._id))
        .collect();
      for (const s of squads) {
        const team = await ctx.db.get(s.teamId);
        const league = team ? await ctx.db.get(team.leagueId) : null;
        results.push({ squad: s, team: team ?? null, league: league ?? null, membership: m });
      }
    }
    return results;
  },
});

export const getMySquadEntry = query({
  args: { teamId: v.id("interclubTeams") },
  handler: async (ctx, { teamId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    for (const m of memberships) {
      const entry = await ctx.db
        .query("squadMembers")
        .withIndex("by_team_and_member", q => q.eq("teamId", teamId).eq("memberId", m._id))
        .unique();
      if (entry) return entry;
    }
    return null;
  },
});

export const listPendingInvites = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_user", q => q.eq("userId", identity.subject))
      .collect();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invites: any[] = [];
    for (const m of memberships) {
      const pending = await ctx.db
        .query("squadMembers")
        .withIndex("by_member", q => q.eq("memberId", m._id))
        .filter(q => q.eq(q.field("status"), "invited"))
        .collect();
      for (const inv of pending) {
        const team = await ctx.db.get(inv.teamId);
        const league = team ? await ctx.db.get(team.leagueId) : null;
        invites.push({ invite: inv, team: team ?? null, league: league ?? null });
      }
    }
    return invites;
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const invite = mutation({
  args: {
    teamId: v.id("interclubTeams"),
    memberId: v.id("clubMembers"),
  },
  handler: async (ctx, { teamId, memberId }) => {
    const inviterId = await assertCanManageSquad(ctx, teamId);

    // Idempotent — if already invited/active, just return
    const existing = await ctx.db
      .query("squadMembers")
      .withIndex("by_team_and_member", q => q.eq("teamId", teamId).eq("memberId", memberId))
      .unique();
    if (existing) {
      if (existing.status === "declined" || existing.status === "removed") {
        // Re-invite
        await ctx.db.patch(existing._id, {
          status: "invited",
          invitedBy: inviterId,
          invitedAt: new Date().toISOString(),
          respondedAt: undefined,
        });
        return existing._id;
      }
      return existing._id;
    }

    const team = await ctx.db.get(teamId);
    if (!team) throw new Error("Team not found");
    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");

    return ctx.db.insert("squadMembers", {
      teamId,
      clubId: team.clubId ?? member.clubId,
      memberId,
      status: "invited",
      invitedBy: inviterId,
      invitedAt: new Date().toISOString(),
    });
  },
});

export const respond = mutation({
  args: {
    squadMemberId: v.id("squadMembers"),
    accept: v.boolean(),
  },
  handler: async (ctx, { squadMemberId, accept }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const entry = await ctx.db.get(squadMemberId);
    if (!entry) throw new Error("Squad invite not found");

    // Verify this is the invited member
    const member = await ctx.db.get(entry.memberId);
    if (member?.userId !== identity.subject) throw new Error("Not your invite");

    await ctx.db.patch(squadMemberId, {
      status: accept ? "active" : "declined",
      respondedAt: new Date().toISOString(),
    });
  },
});

export const remove = mutation({
  args: { squadMemberId: v.id("squadMembers") },
  handler: async (ctx, { squadMemberId }) => {
    const entry = await ctx.db.get(squadMemberId);
    if (!entry) throw new Error("Not found");
    await assertCanManageSquad(ctx, entry.teamId);
    await ctx.db.patch(squadMemberId, { status: "removed" });
  },
});
