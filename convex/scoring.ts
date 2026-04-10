import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function assertAdmin(ctx: MutationCtx, clubId: Id<"clubs">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return identity.subject;
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", identity.subject))
    .unique();
  if (!member || member.role !== "admin") throw new Error("Not authorised");
  return identity.subject;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const listByCompetition = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const scores = await ctx.db
      .query("competitionScores")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .collect();

    // Sort and assign positions client-side (returned already ordered)
    return scores;
  },
});

// Leaderboard — scored and ranked
export const leaderboard = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const competition = await ctx.db.get(competitionId);
    if (!competition) return [];

    const scores = await ctx.db
      .query("competitionScores")
      .withIndex("by_competition", q => q.eq("competitionId", competitionId))
      .collect();

    const format = competition.scoringFormat ?? "stableford";

    // Sort: stableford = highest points first; strokeplay = lowest net first
    const sorted = [...scores].sort((a, b) => {
      if (format === "stableford") {
        return (b.stablefordPoints ?? 0) - (a.stablefordPoints ?? 0);
      }
      // strokeplay — sort by net, then gross
      const netA = a.netScore ?? a.grossScore ?? 999;
      const netB = b.netScore ?? b.grossScore ?? 999;
      if (netA !== netB) return netA - netB;
      return (a.grossScore ?? 999) - (b.grossScore ?? 999);
    });

    // Assign positions (handle ties)
    return sorted.map((score, idx) => {
      const prev = sorted[idx - 1];
      let position = idx + 1;
      if (prev) {
        const sameAs = format === "stableford"
          ? prev.stablefordPoints === score.stablefordPoints
          : (prev.netScore ?? prev.grossScore) === (score.netScore ?? score.grossScore);
        if (sameAs) position = idx; // tied — use prev position (will show same number)
      }
      return { ...score, position };
    });
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const submitScore = mutation({
  args: {
    competitionId: v.id("competitions"),
    clubId: v.id("clubs"),
    userId: v.optional(v.string()),
    displayName: v.string(),
    handicap: v.number(),
    grossScore: v.optional(v.number()),
    stablefordPoints: v.optional(v.number()),
    countback: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submittedBy = await assertAdmin(ctx, args.clubId);

    // Prevent duplicate entries for the same user
    if (args.userId) {
      const existing = await ctx.db
        .query("competitionScores")
        .withIndex("by_competition_and_user", q =>
          q.eq("competitionId", args.competitionId).eq("userId", args.userId)
        )
        .unique();
      if (existing) {
        // Update existing score
        const netScore = args.grossScore != null ? args.grossScore - Math.round(args.handicap) : undefined;
        await ctx.db.patch(existing._id, {
          handicap: args.handicap,
          grossScore: args.grossScore,
          netScore,
          stablefordPoints: args.stablefordPoints,
          countback: args.countback,
          notes: args.notes,
          submittedBy,
          submittedAt: new Date().toISOString(),
        });
        return existing._id;
      }
    }

    const netScore = args.grossScore != null ? args.grossScore - Math.round(args.handicap) : undefined;

    return ctx.db.insert("competitionScores", {
      competitionId: args.competitionId,
      clubId: args.clubId,
      userId: args.userId,
      displayName: args.displayName,
      handicap: args.handicap,
      grossScore: args.grossScore,
      netScore,
      stablefordPoints: args.stablefordPoints,
      countback: args.countback,
      notes: args.notes,
      submittedAt: new Date().toISOString(),
      submittedBy,
    });
  },
});

export const updateScore = mutation({
  args: {
    scoreId: v.id("competitionScores"),
    handicap: v.number(),
    grossScore: v.optional(v.number()),
    stablefordPoints: v.optional(v.number()),
    countback: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const score = await ctx.db.get(args.scoreId);
    if (!score) throw new Error("Score not found");
    const submittedBy = await assertAdmin(ctx, score.clubId);
    const netScore = args.grossScore != null ? args.grossScore - Math.round(args.handicap) : undefined;
    await ctx.db.patch(args.scoreId, {
      handicap: args.handicap,
      grossScore: args.grossScore,
      netScore,
      stablefordPoints: args.stablefordPoints,
      countback: args.countback,
      notes: args.notes,
      submittedBy,
      submittedAt: new Date().toISOString(),
    });
  },
});

export const deleteScore = mutation({
  args: { scoreId: v.id("competitionScores") },
  handler: async (ctx, { scoreId }) => {
    const score = await ctx.db.get(scoreId);
    if (!score) throw new Error("Score not found");
    await assertAdmin(ctx, score.clubId);
    await ctx.db.delete(scoreId);
  },
});

// ── Handicap management ───────────────────────────────────────────────────────

export const setHandicap = mutation({
  args: {
    memberId: v.id("clubMembers"),
    handicap: v.optional(v.number()),
  },
  handler: async (ctx, { memberId, handicap }) => {
    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");
    await assertAdmin(ctx, member.clubId);
    await ctx.db.patch(memberId, { handicap, updatedAt: new Date().toISOString() });
  },
});
