import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

function isSuperAdmin(email?: string | null): boolean {
  const emails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  return !!email && emails.includes(email);
}

async function assertAdmin(ctx: any, clubId: Id<"clubs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  if (isSuperAdmin(identity.email)) return identity;
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", (q: any) => q.eq("clubId", clubId).eq("userId", identity.subject))
    .unique();
  if (member?.role !== "admin") throw new Error("Admin only");
  return identity;
}

// ── Member-facing mutations ───────────────────────────────────────────────────

export const submit = mutation({
  args: {
    competitionId: v.id("competitions"),
    type: v.union(v.literal("time"), v.literal("pairing"), v.literal("general")),
    severity: v.number(),
    body: v.string(),
  },
  handler: async (ctx, { competitionId, type, severity, body }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const competition = await ctx.db.get(competitionId);
    if (!competition?.clubId) throw new Error("Not a club competition");
    if (!competition.grievanceCutoff) throw new Error("No grievance window open");
    if (Date.now() > competition.grievanceCutoff) throw new Error("Grievance window has closed");

    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", competition.clubId!).eq("userId", identity.subject))
      .unique();
    if (!member) throw new Error("Not a club member");

    const existing = await ctx.db
      .query("drawGrievances")
      .withIndex("by_competition_and_member", q => q.eq("competitionId", competitionId).eq("memberId", member._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { type, severity, body, updatedAt: Date.now() });
      return existing._id;
    }

    return ctx.db.insert("drawGrievances", {
      competitionId,
      memberId: member._id,
      userId: identity.subject,
      clubId: competition.clubId,
      type,
      severity,
      body,
      submittedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const competition = await ctx.db.get(competitionId);
    if (!competition?.clubId) throw new Error("Not a club competition");
    if (competition.grievanceCutoff && Date.now() > competition.grievanceCutoff) {
      throw new Error("Grievance window has closed");
    }

    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", competition.clubId!).eq("userId", identity.subject))
      .unique();
    if (!member) return;

    const existing = await ctx.db
      .query("drawGrievances")
      .withIndex("by_competition_and_member", q => q.eq("competitionId", competitionId).eq("memberId", member._id))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

// ── Queries ───────────────────────────────────────────────────────────────────

export const getMyGrievance = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const competition = await ctx.db.get(competitionId);
    if (!competition?.clubId) return null;

    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", competition.clubId!).eq("userId", identity.subject))
      .unique();
    if (!member) return null;

    return ctx.db
      .query("drawGrievances")
      .withIndex("by_competition_and_member", q => q.eq("competitionId", competitionId).eq("memberId", member._id))
      .unique();
  },
});

// Count only — visible to all admins, no content
export const getCount = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const grievances = await ctx.db
      .query("drawGrievances")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .collect();
    return grievances.length;
  },
});

// Full content — super admin only
export const getAll = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !isSuperAdmin(identity.email)) throw new Error("Super admin only");

    const grievances = await ctx.db
      .query("drawGrievances")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .collect();

    return Promise.all(grievances.map(async g => {
      const member = await ctx.db.get(g.memberId);
      return { ...g, memberName: member?.displayName ?? "Unknown" };
    }));
  },
});

// ── Admin mutations ───────────────────────────────────────────────────────────

export const setCutoff = mutation({
  args: {
    competitionId: v.id("competitions"),
    cutoff: v.optional(v.number()),
  },
  handler: async (ctx, { competitionId, cutoff }) => {
    const competition = await ctx.db.get(competitionId);
    if (!competition?.clubId) throw new Error("Not a club competition");
    await assertAdmin(ctx, competition.clubId);
    await ctx.db.patch(competitionId, { grievanceCutoff: cutoff });
  },
});

export const publishDraft = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const competition = await ctx.db.get(competitionId);
    if (!competition?.clubId) throw new Error("Not a club competition");
    await assertAdmin(ctx, competition.clubId);
    if (!competition.grievanceDraft) throw new Error("No draft to publish");

    const draft = JSON.parse(competition.grievanceDraft) as {
      groups: Array<{ groupNumber: number; entryIds: string[] }>;
    };

    let order = 1;
    for (const group of [...draft.groups].sort((a, b) => a.groupNumber - b.groupNumber)) {
      for (const entryId of group.entryIds) {
        await ctx.db.patch(entryId as Id<"entries">, {
          groupNumber: group.groupNumber,
          drawOrder: order++,
        });
      }
    }

    await ctx.db.patch(competitionId, {
      grievanceRoundPublishedAt: Date.now(),
      grievanceDraft: undefined,
      grievanceDraftSummary: undefined,
    });
  },
});

export const discardDraft = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const competition = await ctx.db.get(competitionId);
    if (!competition?.clubId) throw new Error("Not a club competition");
    await assertAdmin(ctx, competition.clubId);
    await ctx.db.patch(competitionId, {
      grievanceDraft: undefined,
      grievanceDraftSummary: undefined,
    });
  },
});

// ── Internal ──────────────────────────────────────────────────────────────────

export const getAllInternal = internalQuery({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    return ctx.db
      .query("drawGrievances")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .collect();
  },
});

export const saveDraft = internalMutation({
  args: {
    competitionId: v.id("competitions"),
    draft: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, { competitionId, draft, summary }) => {
    await ctx.db.patch(competitionId, {
      grievanceDraft: draft,
      grievanceDraftSummary: summary,
    });
  },
});
