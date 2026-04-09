import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";

async function assertClubAdmin(
  ctx: MutationCtx,
  clubId: import("./_generated/dataModel").Id<"clubs">
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (identity.email && superAdminEmails.includes(identity.email)) return;
  const member = await ctx.db
    .query("clubMembers")
    .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", identity.subject))
    .unique();
  if (!member || member.role !== "admin") throw new Error("Not authorised");
}

// ── Scoring helpers (Finchley Race to Swinley Forest rules) ──────────────────

function calcPoints(
  position: number,
  participantCount: number,
  category: string,
  isPairsEvent: boolean
): number {
  const N = participantCount;

  if (category === "major" || category === "medal" || category === "stableford") {
    const BF = category === "major" ? 3 : category === "medal" ? 2 : 1;
    // Raw RTSF points (no multiplier), then × weight (BF)
    // Formula: (basePoints + N) × BF  — positions 1-4 have fixed base; 5+ decay from N
    if (position === 1) return (50 + N) * BF;
    if (position === 2) return (25 + N) * BF;
    if (position === 3) return (10 + N) * BF;
    if (position === 4) return (5 + N) * BF;
    return Math.max(0, (N + 5 - position)) * BF;
  }

  if (category === "knockout") {
    // 1=winner(300), 2=finalist(150), 3-4=semi(75), 5-8=quarter-final(50)
    if (position === 1) return 300;
    if (position === 2) return 150;
    if (position <= 4) return 75;
    if (position <= 8) return 50;
    return 0;
  }

  if (category === "trophy") {
    const base = position === 1 ? 100 : position === 2 ? 50 : 0;
    return isPairsEvent ? Math.floor(base / 2) : base;
  }

  return 0;
}

function sumBestN(scores: number[], n: number): number {
  return [...scores].sort((a, b) => b - a).slice(0, n).reduce((s, x) => s + x, 0);
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("series")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    return ctx.db.get(seriesId);
  },
});

// Returns competitions with their series-link metadata (category, isPairsEvent)
export const getCompetitionsWithLinks = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    const links = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", seriesId))
      .collect();
    return Promise.all(
      links.map(async link => ({
        link,
        competition: await ctx.db.get(link.competitionId),
      }))
    );
  },
});

// Legacy — kept for backwards compat but getCompetitionsWithLinks is preferred
export const getCompetitions = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    const links = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", seriesId))
      .collect();
    const comps = await Promise.all(links.map(l => ctx.db.get(l.competitionId)));
    return comps.filter(Boolean);
  },
});

// Finchley Race to Swinley Forest standings
// Formula: best-3 Majors + best-4 Medals + best-4 Stablefords×2 + all Knockouts + all Trophies
export const computeStandings = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    const links = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", seriesId))
      .collect();

    type MemberAccum = {
      userId: string;
      displayName: string;
      majorScores: number[];
      medalScores: number[];
      stablefordScores: number[];
      knockoutTotal: number;
      trophyTotal: number;
      competitionsPlayed: number;
    };

    const memberMap = new Map<string, MemberAccum>();

    for (const link of links) {
      const comp = await ctx.db.get(link.competitionId);
      if (!comp || comp.status !== "complete") continue;

      const allEntries = await ctx.db
        .query("entries")
        .withIndex("by_competition", q => q.eq("competitionId", link.competitionId))
        .collect();

      const paidEntries = allEntries.filter(e => e.paidAt && e.leaderboardPosition != null);
      const N = paidEntries.length;
      const category = link.category;
      const isPairsEvent = link.isPairsEvent ?? false;

      for (const entry of paidEntries) {
        const pos = entry.leaderboardPosition!;
        const pts = calcPoints(pos, N, category, isPairsEvent);

        if (!memberMap.has(entry.userId)) {
          memberMap.set(entry.userId, {
            userId: entry.userId,
            displayName: entry.displayName,
            majorScores: [],
            medalScores: [],
            stablefordScores: [],
            knockoutTotal: 0,
            trophyTotal: 0,
            competitionsPlayed: 0,
          });
        }
        const m = memberMap.get(entry.userId)!;
        m.competitionsPlayed++;

        if (category === "major") m.majorScores.push(pts);
        else if (category === "medal") m.medalScores.push(pts);
        else if (category === "stableford") m.stablefordScores.push(pts);
        else if (category === "knockout") m.knockoutTotal += pts;
        else if (category === "trophy") m.trophyTotal += pts;
      }
    }

    const standings = [...memberMap.values()].map(m => {
      const majorTotal = sumBestN(m.majorScores, 3);
      const medalTotal = sumBestN(m.medalScores, 4);
      const stablefordTotal = sumBestN(m.stablefordScores, 4); // weight=1 already baked in per-comp
      const total =
        majorTotal + medalTotal + stablefordTotal + m.knockoutTotal + m.trophyTotal;

      return {
        userId: m.userId,
        displayName: m.displayName,
        majorTotal,
        majorPlayed: m.majorScores.length,
        medalTotal,
        medalPlayed: m.medalScores.length,
        stablefordTotal,
        stablefordPlayed: m.stablefordScores.length,
        knockoutTotal: m.knockoutTotal,
        trophyTotal: m.trophyTotal,
        competitionsPlayed: m.competitionsPlayed,
        total,
      };
    });

    return standings.sort((a, b) => b.total - a.total);
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    description: v.optional(v.string()),
    season: v.string(),
    pointsStructure: v.array(v.object({
      position: v.number(),
      points: v.number(),
    })),
    prizePool: v.optional(v.number()),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    await assertClubAdmin(ctx, args.clubId);
    const identity = await ctx.auth.getUserIdentity();
    const now = new Date().toISOString();
    return ctx.db.insert("series", {
      ...args,
      status: "active",
      createdBy: identity!.subject,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addCompetition = mutation({
  args: {
    seriesId: v.id("series"),
    competitionId: v.id("competitions"),
    category: v.string(),          // 'major' | 'medal' | 'stableford' | 'knockout' | 'trophy'
    isPairsEvent: v.optional(v.boolean()),
    weight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.seriesId);
    if (!series) throw new Error("Series not found");
    await assertClubAdmin(ctx, series.clubId);

    const existing = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", args.seriesId))
      .collect();
    if (existing.some(e => e.competitionId === args.competitionId)) return;

    await ctx.db.insert("seriesCompetitions", {
      seriesId: args.seriesId,
      competitionId: args.competitionId,
      category: args.category,
      isPairsEvent: args.isPairsEvent,
      weight: args.weight,
      addedAt: new Date().toISOString(),
    });
  },
});
