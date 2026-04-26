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

// RTSF rule: the best stableford score is worth ×2; remaining are ×1
function sumBestNStableford(scores: number[], n: number): number {
  const sorted = [...scores].sort((a, b) => b - a).slice(0, n);
  return sorted.reduce((acc, s, i) => acc + (i === 0 ? s * 2 : s), 0);
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
// Formula: best-3 Majors + best-4 Medals + best-4 Stablefords + all Knockouts + all Trophies
//
// Source tables:
//   club_comp  → competitionScores (stableford/medal events at Finchley)
//   pool/sweep → entries (sweepstake draws, e.g. Masters Pool)
export const computeStandings = query({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    const links = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", seriesId))
      .collect();

    type MemberAccum = {
      userId?: string;         // undefined for guest/display-name-only entries
      displayName: string;
      majorScores: number[];
      medalScores: number[];
      stablefordScores: number[];
      knockoutTotal: number;
      trophyTotal: number;
      competitionsPlayed: number;
    };

    // Key: userId if present, else displayName
    const memberMap = new Map<string, MemberAccum>();

    function accum(key: string, userId: string | undefined, displayName: string) {
      if (!memberMap.has(key)) {
        memberMap.set(key, {
          userId,
          displayName,
          majorScores: [],
          medalScores: [],
          stablefordScores: [],
          knockoutTotal: 0,
          trophyTotal: 0,
          competitionsPlayed: 0,
        });
      }
      return memberMap.get(key)!;
    }

    for (const link of links) {
      const comp = await ctx.db.get(link.competitionId);
      if (!comp || comp.status !== "complete") continue;

      const category = link.category;
      const isPairsEvent = link.isPairsEvent ?? false;

      if (comp.type === "club_comp") {
        // ── Club competition ───────────────────────────────────────────────
        // Primary source: competitionScores (seeded / hole-by-hole entry)
        const scores = await ctx.db
          .query("competitionScores")
          .withIndex("by_competition", q => q.eq("competitionId", link.competitionId))
          .collect();

        if (scores.length > 0) {
          const format = comp.scoringFormat ?? "stableford";
          const sorted = [...scores].sort((a, b) =>
            format === "stableford"
              ? (b.stablefordPoints ?? 0) - (a.stablefordPoints ?? 0)
              : (a.netScore ?? a.grossScore ?? 999) - (b.netScore ?? b.grossScore ?? 999)
          );
          // participantCount = full field size (may be larger than scored subset)
          const N = comp.participantCount ?? sorted.length;

          sorted.forEach((score, idx) => {
            const pos = score.position ?? (idx + 1);
            const pts = calcPoints(pos, N, category, isPairsEvent);
            const key = score.userId ?? score.displayName;
            const m = accum(key, score.userId, score.displayName);
            m.competitionsPlayed++;
            if (category === "major") m.majorScores.push(pts);
            else if (category === "medal") m.medalScores.push(pts);
            else if (category === "stableford") m.stablefordScores.push(pts);
            else if (category === "knockout") m.knockoutTotal += pts;
            else if (category === "trophy") m.trophyTotal += pts;
          });

        } else {
          // Fallback: scraper-imported results live in the entries table
          // (leaderboardPosition = finishing position in the full field)
          const allEntries = await ctx.db
            .query("entries")
            .withIndex("by_competition", q => q.eq("competitionId", link.competitionId))
            .collect();
          const validEntries = allEntries.filter(e => e.leaderboardPosition != null);
          // participantCount set by scraper; fall back to entry count (full field imported)
          const N = comp.participantCount ?? validEntries.length;

          for (const entry of validEntries) {
            const pos = entry.leaderboardPosition!;
            const pts = calcPoints(pos, N, category, isPairsEvent);
            const key = entry.userId ?? entry.displayName;
            const m = accum(key, entry.userId, entry.displayName);
            m.competitionsPlayed++;
            if (category === "major") m.majorScores.push(pts);
            else if (category === "medal") m.medalScores.push(pts);
            else if (category === "stableford") m.stablefordScores.push(pts);
            else if (category === "knockout") m.knockoutTotal += pts;
            else if (category === "trophy") m.trophyTotal += pts;
          }
        }

      } else {
        // ── Pool/sweep competition: entries table ──────────────────────────
        const allEntries = await ctx.db
          .query("entries")
          .withIndex("by_competition", q => q.eq("competitionId", link.competitionId))
          .collect();

        const paidEntries = allEntries.filter(e => e.paidAt && e.leaderboardPosition != null);
        const N = paidEntries.length;

        for (const entry of paidEntries) {
          const pos = entry.leaderboardPosition!;
          const pts = calcPoints(pos, N, category, isPairsEvent);
          const m = accum(entry.userId, entry.userId, entry.displayName);
          m.competitionsPlayed++;
          if (category === "major") m.majorScores.push(pts);
          else if (category === "medal") m.medalScores.push(pts);
          else if (category === "stableford") m.stablefordScores.push(pts);
          else if (category === "knockout") m.knockoutTotal += pts;
          else if (category === "trophy") m.trophyTotal += pts;
        }
      }
    }

    const MAJOR_QUOTA = 3;
    const MEDAL_QUOTA = 4;
    const STABLEFORD_QUOTA = 4;

    const standings = [...memberMap.values()].map(m => {
      const majorTotal = sumBestN(m.majorScores, MAJOR_QUOTA);
      const medalTotal = sumBestN(m.medalScores, MEDAL_QUOTA);
      const stablefordTotal = sumBestNStableford(m.stablefordScores, STABLEFORD_QUOTA);
      const total =
        majorTotal + medalTotal + stablefordTotal + m.knockoutTotal + m.trophyTotal;

      return {
        userId: m.userId,
        displayName: m.displayName,
        majorTotal,
        majorPlayed: m.majorScores.length,
        majorCounted: Math.min(m.majorScores.length, MAJOR_QUOTA),
        majorQuota: MAJOR_QUOTA,
        medalTotal,
        medalPlayed: m.medalScores.length,
        medalCounted: Math.min(m.medalScores.length, MEDAL_QUOTA),
        medalQuota: MEDAL_QUOTA,
        stablefordTotal,
        stablefordPlayed: m.stablefordScores.length,
        stablefordCounted: Math.min(m.stablefordScores.length, STABLEFORD_QUOTA),
        stablefordQuota: STABLEFORD_QUOTA,
        knockoutTotal: m.knockoutTotal,
        trophyTotal: m.trophyTotal,
        competitionsPlayed: m.competitionsPlayed,
        total,
      };
    });

    return standings.sort((a, b) => b.total - a.total);
  },
});

// Per-player competition breakdown for the detail panel
export const getPlayerResults = query({
  args: {
    seriesId: v.id("series"),
    playerKey: v.string(), // userId if the player has one, else displayName
  },
  handler: async (ctx, { seriesId, playerKey }) => {
    const links = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", seriesId))
      .collect();

    type ResultItem = {
      competitionId: string;
      competitionName: string;
      date: string;
      category: string;
      isPairsEvent: boolean;
      position: number;
      participantCount: number;
      pts: number;
    };

    const results: ResultItem[] = [];

    for (const link of links) {
      const comp = await ctx.db.get(link.competitionId);
      if (!comp || comp.status !== "complete") continue;

      const category = link.category;
      const isPairsEvent = link.isPairsEvent ?? false;
      let position: number | null = null;
      let N = 0;

      if (comp.type === "club_comp") {
        const scores = await ctx.db
          .query("competitionScores")
          .withIndex("by_competition", q => q.eq("competitionId", link.competitionId))
          .collect();

        if (scores.length > 0) {
          N = comp.participantCount ?? scores.length;
          const score = scores.find(s => (s.userId ?? s.displayName) === playerKey);
          if (score) {
            position = score.position ?? scores.findIndex(s => (s.userId ?? s.displayName) === playerKey) + 1;
          }
        } else {
          const entries = await ctx.db
            .query("entries")
            .withIndex("by_competition", q => q.eq("competitionId", link.competitionId))
            .collect();
          const valid = entries.filter(e => e.leaderboardPosition != null);
          N = comp.participantCount ?? valid.length;
          const entry = valid.find(e => (e.userId ?? e.displayName) === playerKey);
          if (entry) position = entry.leaderboardPosition!;
        }
      } else {
        const entries = await ctx.db
          .query("entries")
          .withIndex("by_competition", q => q.eq("competitionId", link.competitionId))
          .collect();
        const paid = entries.filter(e => e.paidAt && e.leaderboardPosition != null);
        N = paid.length;
        const entry = paid.find(e => (e.userId ?? e.displayName) === playerKey);
        if (entry) position = entry.leaderboardPosition!;
      }

      if (position !== null) {
        results.push({
          competitionId: link.competitionId,
          competitionName: comp.name,
          date: comp.startDate,
          category,
          isPairsEvent,
          position,
          participantCount: N,
          pts: calcPoints(position, N, category, isPairsEvent),
        });
      }
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
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

export const updateCompetitionCategory = mutation({
  args: {
    seriesId: v.id("series"),
    competitionId: v.id("competitions"),
    category: v.string(),
    isPairsEvent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.seriesId);
    if (!series) throw new Error("Series not found");
    await assertClubAdmin(ctx, series.clubId);

    const links = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", args.seriesId))
      .collect();
    const link = links.find(l => l.competitionId === args.competitionId);
    if (!link) throw new Error("Competition not in series");

    await ctx.db.patch(link._id, {
      category: args.category,
      isPairsEvent: args.isPairsEvent ?? undefined,
    });
  },
});

export const removeCompetition = mutation({
  args: {
    seriesId: v.id("series"),
    competitionId: v.id("competitions"),
  },
  handler: async (ctx, args) => {
    const series = await ctx.db.get(args.seriesId);
    if (!series) throw new Error("Series not found");
    await assertClubAdmin(ctx, series.clubId);

    const links = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", args.seriesId))
      .collect();
    const link = links.find(l => l.competitionId === args.competitionId);
    if (!link) throw new Error("Competition not in series");
    await ctx.db.delete(link._id);
  },
});

// ── One-time seed: import Race to Swinley Forest 2026 historical data ────────
// Super-admin only. Creates/updates competitions + competitionScores from
// the imported spreadsheet data (events up to 2026-04-15).

const RTSF_EVENTS = [
  {
    date: "2026-04-05", name: "Monthly Medal", slug: "rtsf-monthly-medal-apr05",
    category: "medal", participantCount: 71,
    players: [
      { name: "Jamie Aronson",    position: 7,  pts: 138 },
      { name: "Harley Ashcroft",  position: 23, pts: 106 },
      { name: "Ben Benawra",      position: 57, pts: 38  },
      { name: "Howard Bentwood",  position: 9,  pts: 134 },
      { name: "Jonny Bentwood",   position: 6,  pts: 140 },
      { name: "Richard Bentwood", position: 46, pts: 60  },
      { name: "Paul Blackburn",   position: 20, pts: 112 },
      { name: "Claude Chene",     position: 62, pts: 28  },
      { name: "Noel Cunningham",  position: 3,  pts: 162 },
      { name: "Steve Davies",     position: 14, pts: 124 },
      { name: "Gus Ganduglia",    position: 48, pts: 56  },
      { name: "Mundeep Gill",     position: 21, pts: 110 },
      { name: "Tim Green",        position: 26, pts: 100 },
      { name: "Sanjeev Gulati",   position: 53, pts: 46  },
      { name: "Haydn Gush",       position: 55, pts: 42  },
      { name: "Edward Hikmet",    position: 33, pts: 86  },
      { name: "Ben Hodges",       position: 38, pts: 76  },
      { name: "Matthew Hodkin",   position: 59, pts: 34  },
      { name: "Matthew Horgan",   position: 54, pts: 44  },
      { name: "Bobbie Jethwa",    position: 19, pts: 114 },
      { name: "Richard Land",     position: 13, pts: 126 },
      { name: "Scott Leaver",     position: 56, pts: 40  },
      { name: "Wingfield Martin", position: 11, pts: 130 },
      { name: "Will Middleton",   position: 1,  pts: 242 },
      { name: "William Money",    position: 24, pts: 104 },
      { name: "James Monk",       position: 29, pts: 94  },
      { name: "David Motts",      position: 61, pts: 30  },
      { name: "Gerry O'Donohoe", position: 17, pts: 118 },
      { name: "Oliver Peake",     position: 18, pts: 116 },
      { name: "Ben Plumridge",    position: 12, pts: 128 },
      { name: "Vijay Popat",      position: 47, pts: 58  },
      { name: "Rajiv Punja",      position: 30, pts: 92  },
      { name: "Des Quilty",       position: 50, pts: 52  },
      { name: "Sam Selhaoui",     position: 8,  pts: 136 },
      { name: "Andreas Sommer",   position: 2,  pts: 192 },
      { name: "Lewis Spencer",    position: 28, pts: 96  },
      { name: "Alex Thomas",      position: 32, pts: 88  },
      { name: "Tom Vale",         position: 67, pts: 18  },
      { name: "Tom Walker",       position: 16, pts: 120 },
      { name: "Alex Wills",       position: 39, pts: 74  },
      { name: "Allan Yarish",     position: 22, pts: 108 },
    ],
  },
  {
    date: "2026-04-11", name: "Masters Shootout", slug: "rtsf-masters-shootout-apr11",
    category: "medal", participantCount: 92,
    players: [
      { name: "Nigel Arbuthnot",     position: 36, pts: 122 },
      { name: "Jamie Aronson",        position: 32, pts: 130 },
      { name: "Harley Ashcroft",      position: 19, pts: 156 },
      { name: "Samuel Auld",          position: 20, pts: 154 },
      { name: "Edward Barrett",       position: 38, pts: 118 },
      { name: "Howard Bentwood",      position: 51, pts: 92  },
      { name: "Jonny Bentwood",       position: 37, pts: 120 },
      { name: "Richard Bentwood",     position: 44, pts: 106 },
      { name: "Peter Bernstein",      position: 74, pts: 46  },
      { name: "Paul Blackburn",       position: 42, pts: 110 },
      { name: "James Bliss",          position: 8,  pts: 178 },
      { name: "Ruari Boyd",           position: 31, pts: 132 },
      { name: "Claude Chene",         position: 59, pts: 76  },
      { name: "Terry Cordeiro",       position: 57, pts: 80  },
      { name: "Jamie Crocker",        position: 48, pts: 98  },
      { name: "William Daunt",        position: 80, pts: 34  },
      { name: "Steve Davies",         position: 12, pts: 170 },
      { name: "Nigel Edwards",        position: 39, pts: 116 },
      { name: "Gus Ganduglia",        position: 34, pts: 126 },
      { name: "John Gee-Grant",       position: 75, pts: 44  },
      { name: "Mundeep Gill",         position: 72, pts: 50  },
      { name: "Carole Golten",        position: 2,  pts: 234 },
      { name: "JP Gorrie",            position: 49, pts: 96  },
      { name: "Tim Green",            position: 1,  pts: 284 },
      { name: "Sanjeev Gulati",       position: 4,  pts: 194 },
      { name: "Haydn Gush",           position: 63, pts: 68  },
      { name: "Nessan Harpur",        position: 47, pts: 100 },
      { name: "Anthony Harris",       position: 30, pts: 134 },
      { name: "Justin Hawkins",       position: 73, pts: 48  },
      { name: "Edward Hikmet",        position: 50, pts: 94  },
      { name: "Sven Hoffelner",       position: 41, pts: 112 },
      { name: "Matthew Horgan",       position: 61, pts: 72  },
      { name: "Mudrek Hossain",       position: 66, pts: 62  },
      { name: "Tom Huntley",          position: 7,  pts: 180 },
      { name: "Bobbie Jethwa",        position: 62, pts: 70  },
      { name: "Jack Keane",           position: 86, pts: 22  },
      { name: "Scott Leaver",         position: 77, pts: 40  },
      { name: "Wingfield Martin",     position: 10, pts: 174 },
      { name: "Will Middleton",       position: 26, pts: 142 },
      { name: "Oswald Miller",        position: 21, pts: 152 },
      { name: "William Money",        position: 92, pts: 10  },
      { name: "James Monk",           position: 6,  pts: 182 },
      { name: "Steve Morris",         position: 53, pts: 88  },
      { name: "Alexandra O'Donohoe", position: 46, pts: 102 },
      { name: "Katie Olewnik",        position: 83, pts: 28  },
      { name: "Vijay Popat",          position: 29, pts: 136 },
      { name: "Rajiv Punja",          position: 17, pts: 160 },
      { name: "Oliver Rawlings",      position: 25, pts: 144 },
      { name: "Klaus Schreiner",      position: 85, pts: 24  },
      { name: "Sam Selhaoui",         position: 90, pts: 14  },
      { name: "Lewis Spencer",        position: 54, pts: 86  },
      { name: "Hilary Springer",      position: 22, pts: 150 },
      { name: "Helen Tout",           position: 16, pts: 162 },
      { name: "John Wainwright",      position: 28, pts: 138 },
      { name: "Alex Wills",           position: 13, pts: 168 },
      { name: "Chris Wright",         position: 71, pts: 52  },
      { name: "Lisa Zaferakis",       position: 89, pts: 16  },
    ],
  },
  {
    date: "2026-04-06", name: "Stableford", slug: "rtsf-stableford-apr06",
    category: "stableford", participantCount: 35,
    players: [
      { name: "Jamie Aronson",    position: 17, pts: 23 },
      { name: "Jonny Bentwood",   position: 29, pts: 11 },
      { name: "Paul Blackburn",   position: 2,  pts: 60 },
      { name: "James Bliss",      position: 3,  pts: 45 },
      { name: "Claude Chene",     position: 7,  pts: 33 },
      { name: "Noel Cunningham",  position: 4,  pts: 40 },
      { name: "Mundeep Gill",     position: 26, pts: 14 },
      { name: "Haydn Gush",       position: 19, pts: 21 },
      { name: "Nessan Harpur",    position: 22, pts: 18 },
      { name: "Edward Hikmet",    position: 30, pts: 10 },
      { name: "Matthew Horgan",   position: 23, pts: 17 },
      { name: "Wingfield Martin", position: 8,  pts: 32 },
      { name: "Katie Olewnik",    position: 9,  pts: 31 },
      { name: "Ben Plumridge",    position: 5,  pts: 35 },
      { name: "Rajiv Punja",      position: 11, pts: 29 },
      { name: "Kevin Redmond",    position: 31, pts: 9  },
      { name: "Sam Selhaoui",     position: 32, pts: 8  },
      { name: "Tom Walker",       position: 14, pts: 26 },
    ],
  },
  {
    date: "2026-04-09", name: "Stableford", slug: "rtsf-stableford-apr09",
    category: "stableford", participantCount: 23,
    players: [
      { name: "Paul Blackburn",  position: 2,  pts: 48 },
      { name: "Claude Chene",    position: 10, pts: 18 },
      { name: "JP Gorrie",       position: 5,  pts: 23 },
      { name: "Matthew Horgan",  position: 15, pts: 13 },
      { name: "Rajiv Punja",     position: 1,  pts: 73 },
      { name: "Hilary Springer", position: 3,  pts: 33 },
      { name: "Ed Sumner",       position: 11, pts: 17 },
    ],
  },
  {
    date: "2026-04-12", name: "Stableford", slug: "rtsf-stableford-apr12",
    category: "stableford", participantCount: 40,
    players: [
      { name: "Harley Ashcroft",     position: 1,  pts: 90 },
      { name: "Ben Benawra",         position: 9,  pts: 36 },
      { name: "Howard Bentwood",     position: 20, pts: 25 },
      { name: "Jonny Bentwood",      position: 16, pts: 29 },
      { name: "Richard Bentwood",    position: 37, pts: 8  },
      { name: "Claude Chene",        position: 35, pts: 10 },
      { name: "Jamie Crocker",       position: 18, pts: 27 },
      { name: "Andrew Dyson",        position: 26, pts: 19 },
      { name: "Haydn Gush",          position: 4,  pts: 45 },
      { name: "Matthew Hodkin",      position: 10, pts: 35 },
      { name: "Sven Hoffelner",      position: 21, pts: 24 },
      { name: "Matthew Horgan",      position: 34, pts: 11 },
      { name: "Keith Howlett",       position: 38, pts: 7  },
      { name: "Richard Land",        position: 22, pts: 23 },
      { name: "Scott Leaver",        position: 2,  pts: 65 },
      { name: "Alexandra O'Donohoe", position: 29, pts: 16 },
      { name: "Katie Olewnik",       position: 14, pts: 31 },
      { name: "Oliver Peake",        position: 19, pts: 26 },
      { name: "Ben Plumridge",       position: 8,  pts: 37 },
      { name: "Rajiv Punja",         position: 11, pts: 34 },
      { name: "Kevin Redmond",       position: 6,  pts: 39 },
      { name: "Sam Selhaoui",        position: 30, pts: 15 },
      { name: "Alex Thomas",         position: 17, pts: 28 },
    ],
  },
] as const;

export const seedRTSFData = mutation({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
    if (!identity.email || !superAdminEmails.includes(identity.email)) throw new Error("Super admin only");
    const adminId = identity.subject;

    const series = await ctx.db.get(seriesId);
    if (!series) throw new Error("Series not found");
    const { clubId } = series;
    const now = new Date().toISOString();

    const results: string[] = [];

    // Remove stale series links — competitions linked before the import whose slugs
    // don't match any RTSF event (e.g. manually-added "2026-masters-shootout").
    const rtsfSlugs = new Set<string>(RTSF_EVENTS.map(e => e.slug));
    const allLinks = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", seriesId))
      .collect();
    for (const link of allLinks) {
      const comp = await ctx.db.get(link.competitionId);
      if (comp && !rtsfSlugs.has(comp.slug ?? "")) {
        await ctx.db.delete(link._id);
        results.push(`removed stale link: ${comp.name} (${comp.slug})`);
      }
    }

    for (const ev of RTSF_EVENTS) {
      // Find or create the competition
      let compId: import("./_generated/dataModel").Id<"competitions"> | null = null;
      const existing = await ctx.db
        .query("competitions")
        .withIndex("by_club_and_slug", q => q.eq("clubId", clubId).eq("slug", ev.slug))
        .unique();

      if (existing) {
        compId = existing._id;
        // Ensure participantCount is set
        if (existing.participantCount !== ev.participantCount) {
          await ctx.db.patch(compId, { participantCount: ev.participantCount });
        }
        results.push(`found: ${ev.name} (${ev.date})`);
      } else {
        compId = await ctx.db.insert("competitions", {
          clubId,
          scope: "club",
          name: ev.name,
          slug: ev.slug,
          status: "complete",
          type: "club_comp",
          startDate: ev.date,
          endDate: ev.date,
          entryDeadline: ev.date + "T12:00:00.000Z",
          drawType: "random",
          tierCount: 0,
          playersPerTier: 0,
          entryFee: 0,
          currency: "GBP",
          prizeStructure: [],
          scoringFormat: ev.category === "medal" ? "strokeplay" : "stableford",
          participantCount: ev.participantCount,
          createdBy: adminId,
          createdAt: now,
          updatedAt: now,
        });
        results.push(`created: ${ev.name} (${ev.date})`);
      }

      // Link to series if not already linked
      const existingLink = await ctx.db
        .query("seriesCompetitions")
        .withIndex("by_series", q => q.eq("seriesId", seriesId))
        .collect();
      if (!existingLink.some(l => l.competitionId === compId)) {
        await ctx.db.insert("seriesCompetitions", {
          seriesId,
          competitionId: compId,
          category: ev.category,
          addedAt: now,
        });
        results.push(`linked: ${ev.name} → series`);
      }

      // Seed scores — skip players already present
      const existingScores = await ctx.db
        .query("competitionScores")
        .withIndex("by_competition", q => q.eq("competitionId", compId!))
        .collect();
      const existingNames = new Set(existingScores.map(s => s.displayName));

      for (const p of ev.players) {
        if (existingNames.has(p.name)) continue;
        await ctx.db.insert("competitionScores", {
          competitionId: compId!,
          clubId,
          displayName: p.name,
          handicap: 0,
          stablefordPoints: p.pts,
          position: p.position,
          submittedAt: now,
          submittedBy: adminId,
        });
      }
      results.push(`seeded ${ev.players.length} players for ${ev.name}`);
    }

    return results;
  },
});

