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

    // Sort: stableford = highest points first; strokeplay = lowest net/gross first,
    // falling back to stablefordPoints (race pts) desc then stored position asc
    // when no actual scores are entered (e.g. RTSF imported data).
    const sorted = [...scores].sort((a, b) => {
      if (format === "stableford") {
        return (b.stablefordPoints ?? 0) - (a.stablefordPoints ?? 0);
      }
      // strokeplay
      const netA = a.netScore ?? a.grossScore;
      const netB = b.netScore ?? b.grossScore;
      if (netA != null && netB != null) {
        if (netA !== netB) return netA - netB;
        return (a.grossScore ?? 999) - (b.grossScore ?? 999);
      }
      if (netA != null) return -1; // a has real score, b doesn't
      if (netB != null) return 1;
      // No actual scores — fall back to race pts desc, then stored position asc
      if ((b.stablefordPoints ?? 0) !== (a.stablefordPoints ?? 0))
        return (b.stablefordPoints ?? 0) - (a.stablefordPoints ?? 0);
      return (a.position ?? 999) - (b.position ?? 999);
    });

    // Assign positions (handle ties); respect stored position for imported data
    // (no actual scores entered) so it matches the source spreadsheet exactly.
    const hasRealScores = scores.some(s => s.netScore != null || s.grossScore != null);
    return sorted.map((score, idx) => {
      if (!hasRealScores && score.position != null) {
        return score; // use stored position from import
      }
      const prev = sorted[idx - 1];
      let position = idx + 1;
      if (prev) {
        const sameAs = format === "stableford"
          ? prev.stablefordPoints === score.stablefordPoints
          : (prev.netScore ?? prev.grossScore) === (score.netScore ?? score.grossScore);
        if (sameAs) position = idx;
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

// Member: submit their own score from mobile app (no admin required)
export const submitOwnScore = mutation({
  args: {
    competitionId: v.id("competitions"),
    grossScore: v.optional(v.number()),
    stablefordPoints: v.optional(v.number()),
    holeScores: v.optional(v.array(v.object({
      hole: v.number(),
      par: v.number(),
      strokeIndex: v.number(),
      score: v.number(),
    }))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const competition = await ctx.db.get(args.competitionId);
    if (!competition) throw new Error("Competition not found");
    if (!competition.clubId) throw new Error("Not a club competition");
    if (competition.status !== "live" && competition.status !== "open") {
      throw new Error("Competition is not accepting scores");
    }

    // Must be an active member of the club
    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q =>
        q.eq("clubId", competition.clubId!).eq("userId", identity.subject)
      )
      .unique();
    if (!member || member.status !== "active") throw new Error("Not a club member");

    const handicap = member.handicap ?? 0;
    const netScore = args.grossScore != null
      ? args.grossScore - Math.round(handicap)
      : undefined;

    // Compute stableford if not provided but we have hole scores
    let stablefordPoints = args.stablefordPoints;
    if (!stablefordPoints && args.holeScores && args.holeScores.length > 0) {
      stablefordPoints = args.holeScores.reduce((total, h) => {
        const strokesReceived = Math.floor((handicap * h.strokeIndex) / 18);
        const pts = Math.max(0, 2 + h.par - h.score + strokesReceived);
        return total + pts;
      }, 0);
    }

    const now = new Date().toISOString();

    // Upsert — one score per member per competition
    const existing = await ctx.db
      .query("competitionScores")
      .withIndex("by_competition_and_user", q =>
        q.eq("competitionId", args.competitionId).eq("userId", identity.subject)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        grossScore: args.grossScore,
        netScore,
        stablefordPoints,
        notes: args.notes,
        submittedBy: identity.subject,
        submittedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("competitionScores", {
      competitionId: args.competitionId,
      clubId: competition.clubId,
      userId: identity.subject,
      displayName: member.displayName,
      handicap,
      grossScore: args.grossScore,
      netScore,
      stablefordPoints,
      notes: args.notes,
      submittedAt: now,
      submittedBy: identity.subject,
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

// ── Hole-by-hole score entry (kiosk + member self-service) ───────────────────

// Stableford points for one hole
function holeStableford(gross: number, par: number, strokeIndex: number, handicap: number): number {
  const shotsReceived = Math.floor(handicap / 18) + (strokeIndex <= (handicap % 18) ? 1 : 0);
  return Math.max(0, par - (gross - shotsReceived) + 2);
}

// Called from the pro-shop kiosk (staff submitting for a member)
// OR from the member's own app session (self-service)
export const submitScoreHoleByHole = mutation({
  args: {
    competitionId: v.id("competitions"),
    clubId: v.id("clubs"),
    memberId: v.id("clubMembers"),     // the member whose score this is
    holeScores: v.array(v.object({ hole: v.number(), gross: v.number() })),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    // Authorise: must be the member themselves OR staff/admin of the club
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    const isSuperAdmin = identity.email && superAdminEmails.includes(identity.email);
    const callerMembership = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", args.clubId).eq("userId", identity.subject))
      .unique();
    const isSelf = callerMembership?._id === args.memberId;
    const isStaff = callerMembership && (callerMembership.role === "admin" || callerMembership.role === "staff");
    if (!isSelf && !isStaff && !isSuperAdmin) throw new Error("Not authorised");

    const grossScore = args.holeScores.reduce((s, h) => s + h.gross, 0);
    const handicap = member.handicap ?? 0;
    const netScore = grossScore - Math.round(handicap);

    // Auto-calc stableford if competition has a linked course
    let stablefordPoints: number | undefined;
    const competition = await ctx.db.get(args.competitionId);
    if (competition?.courseId) {
      const course = await ctx.db.get(competition.courseId);
      if (course) {
        stablefordPoints = args.holeScores.reduce((sum, hs) => {
          const h = course.holes.find(ch => ch.number === hs.hole);
          if (!h) return sum;
          return sum + holeStableford(hs.gross, h.par, h.strokeIndex, handicap);
        }, 0);
      }
    }

    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("competitionScores")
      .withIndex("by_competition_and_user", q =>
        q.eq("competitionId", args.competitionId).eq("userId", member.userId)
      )
      .unique();

    const scoreData = {
      handicap,
      grossScore,
      netScore,
      stablefordPoints,
      holeScores: args.holeScores,
      notes: args.notes,
      submittedBy: identity.subject,
      submittedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, scoreData);
      return existing._id;
    }

    return ctx.db.insert("competitionScores", {
      competitionId: args.competitionId,
      clubId: args.clubId,
      userId: member.userId,
      displayName: member.displayName,
      ...scoreData,
    });
  },
});

// Query: member's existing score for a competition (for "already submitted" check)
export const getMyScore = query({
  args: { competitionId: v.id("competitions"), userId: v.string() },
  handler: async (ctx, { competitionId, userId }) => {
    return ctx.db
      .query("competitionScores")
      .withIndex("by_competition_and_user", q =>
        q.eq("competitionId", competitionId).eq("userId", userId)
      )
      .unique();
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
