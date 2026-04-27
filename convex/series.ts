import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";

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

// Split a multi-player display name into individual names.
// Handles "Oliver Rawlings (4) & Sam Selhaoui" and
// "Ben Coleman, Rebecca Ley, Jake Lipschitz, Sam Morley" formats.
function splitPairsName(displayName: string): string[] {
  const sep = displayName.includes(" & ") ? " & " : displayName.includes(", ") ? ", " : null;
  if (!sep) return [displayName];
  return displayName.split(sep).map(name =>
    name.replace(/\s*\(\d+\)\s*$/, "").trim()
  ).filter(Boolean);
}

// Official Race to Swinley Forest 2026 registered participants
// (source: FGC official leaderboard CSV as of 2026-04-19)
const RTSF_PARTICIPANT_NAMES = new Set([
  "wingfield martin", "harley ashcroft", "rajiv punja", "will middleton",
  "tim green", "james bliss", "claude chene", "paul blackburn",
  "jonny bentwood", "steve davies", "haydn gush", "alex wills",
  "jamie aronson", "ben plumridge", "carole golten", "gus ganduglia",
  "howard bentwood", "james monk", "noel cunningham", "tom huntley",
  "hilary springer", "sven hoffelner", "sanjeev gulati", "sam selhaoui",
  "edward hikmet", "oliver peake", "william money", "tom walker",
  "scott leaver", "ben benawra", "bobbie jethwa", "matthew horgan",
  "gerry o'donohoe", "allan yarish", "ruari boyd", "vijay popat",
  "andreas sommer", "samuel auld", "mundeep gill", "jp gorrie",
  "richard bentwood", "lewis spencer", "richard land", "katie olewnik",
  "helen tout", "steve morris", "jamie crocker", "oswald miller",
  "anthony harris", "ben hodges", "oliver rawlings", "alex thomas",
  "wayne mandic", "kevin redmond", "matthew hodkin", "john wainwright",
  "nessan harpur", "alexandra o'donohoe", "nigel arbuthnot", "edward barrett",
  "nigel edwards", "terry cordeiro", "peter bernstein", "justin hawkins",
  "chris wright", "mudrek hossain", "ed sumner", "coraline martin",
  "des quilty", "john gee-grant", "jessica haley", "klaus schreiner",
  "andrew dyson", "william daunt", "andrew rose", "keith howlett",
  "david motts", "jack keane", "richard tyler", "tom vale",
  "lisa zaferakis", "david carman", "tanguy de fenoyl", "thomas geraghty",
  "david hallgarten", "steve jayson", "scott johnston", "nicholas kilbey",
  "alan o'donoghue",
]);

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
    // Fetch series for RTSF filter and clubId
    const series = await ctx.db.get(seriesId);

    // Build displayName → userId map so seeded scores (display-name only) and
    // scraper entries (userId-keyed for matched members) collapse into one row.
    const nameToUserId = new Map<string, string>();
    if (series?.clubId) {
      const members = await ctx.db
        .query("clubMembers")
        .withIndex("by_club", q => q.eq("clubId", series.clubId))
        .collect();
      for (const cm of members) {
        if (cm.displayName && cm.userId) {
          nameToUserId.set(cm.displayName.toLowerCase(), cm.userId);
        }
      }
    }

    // Resolve a player to their canonical key (userId when known, else displayName)
    function resolve(userId: string | undefined, displayName: string) {
      const uid = userId ?? nameToUserId.get(displayName.toLowerCase());
      return { key: uid ?? displayName, uid };
    }

    const links = await ctx.db
      .query("seriesCompetitions")
      .withIndex("by_series", q => q.eq("seriesId", seriesId))
      .collect();

    type MemberAccum = {
      userId?: string;
      displayName: string;
      majorScores: number[];
      medalScores: number[];
      stablefordScores: number[];
      knockoutTotal: number;
      trophyTotal: number;
      competitionsPlayed: number;
    };

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
          const N = comp.participantCount ?? sorted.length;

          sorted.forEach((score, idx) => {
            const pos = score.position ?? (idx + 1);
            const pts = calcPoints(pos, N, category, isPairsEvent);
            const { key, uid } = resolve(score.userId, score.displayName);
            const m = accum(key, uid, score.displayName);
            m.competitionsPlayed++;
            if (category === "major") m.majorScores.push(pts);
            else if (category === "medal") m.medalScores.push(pts);
            else if (category === "stableford") m.stablefordScores.push(pts);
            else if (category === "knockout") m.knockoutTotal += pts;
            else if (category === "trophy") m.trophyTotal += pts;
          });

        } else {
          // Fallback: scraper-imported results in entries table
          const allEntries = await ctx.db
            .query("entries")
            .withIndex("by_competition", q => q.eq("competitionId", link.competitionId))
            .collect();
          const validEntries = allEntries.filter(e => e.leaderboardPosition != null);
          const N = comp.participantCount ?? validEntries.length;

          for (const entry of validEntries) {
            const pos = entry.leaderboardPosition!;
            const pts = calcPoints(pos, N, category, isPairsEvent);
            const names = splitPairsName(entry.displayName);
            for (const name of names) {
              const rawUid = names.length === 1 ? entry.userId : undefined;
              const { key, uid } = resolve(rawUid, name);
              const m = accum(key, uid, name);
              m.competitionsPlayed++;
              if (category === "major") m.majorScores.push(pts);
              else if (category === "medal") m.medalScores.push(pts);
              else if (category === "stableford") m.stablefordScores.push(pts);
              else if (category === "knockout") m.knockoutTotal += pts;
              else if (category === "trophy") m.trophyTotal += pts;
            }
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
          const names = splitPairsName(entry.displayName);
          for (const name of names) {
            const rawUid = names.length === 1 ? entry.userId : undefined;
            const { key, uid } = resolve(rawUid, name);
            const m = accum(key, uid, name);
            m.competitionsPlayed++;
            if (category === "major") m.majorScores.push(pts);
            else if (category === "medal") m.medalScores.push(pts);
            else if (category === "stableford") m.stablefordScores.push(pts);
            else if (category === "knockout") m.knockoutTotal += pts;
            else if (category === "trophy") m.trophyTotal += pts;
          }
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

    const sorted = standings.sort((a, b) => b.total - a.total);

    // For RTSF, restrict to registered participants only
    const isRTSF = (series?.name ?? "").toLowerCase().includes("swinley");
    if (isRTSF) {
      return sorted.filter(s =>
        RTSF_PARTICIPANT_NAMES.has(s.displayName.toLowerCase())
      );
    }

    return sorted;
  },
});

// Per-player competition breakdown for the detail panel
export const getPlayerResults = query({
  args: {
    seriesId: v.id("series"),
    playerKey: v.string(), // userId if the player has one, else displayName
  },
  handler: async (ctx, { seriesId, playerKey }) => {
    // Build userId → displayName map so we can match userId-keyed playerKey
    // against seeded scores that only have a displayName.
    const series = await ctx.db.get(seriesId);
    const userIdToName = new Map<string, string>();
    if (series?.clubId) {
      const members = await ctx.db
        .query("clubMembers")
        .withIndex("by_club", q => q.eq("clubId", series.clubId))
        .collect();
      for (const cm of members) {
        if (cm.userId && cm.displayName) {
          userIdToName.set(cm.userId, cm.displayName);
        }
      }
    }
    // The display name corresponding to playerKey (null if playerKey is already a name)
    const playerDisplayName = userIdToName.get(playerKey) ?? null;

    function matchesPlayer(entryUserId: string | undefined, entryDisplayName: string): boolean {
      if (entryUserId === playerKey) return true;
      if (entryDisplayName === playerKey) return true;
      if (playerDisplayName && entryDisplayName === playerDisplayName) return true;
      return false;
    }

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
          const score = scores.find(s => matchesPlayer(s.userId, s.displayName));
          if (score) {
            position = score.position ?? scores.findIndex(s => matchesPlayer(s.userId, s.displayName)) + 1;
          }
        } else {
          const entries = await ctx.db
            .query("entries")
            .withIndex("by_competition", q => q.eq("competitionId", link.competitionId))
            .collect();
          const valid = entries.filter(e => e.leaderboardPosition != null);
          N = comp.participantCount ?? valid.length;
          const entry = valid.find(e =>
            matchesPlayer(e.userId, e.displayName) ||
            splitPairsName(e.displayName).some(n => matchesPlayer(undefined, n))
          );
          if (entry) position = entry.leaderboardPosition!;
        }
      } else {
        const entries = await ctx.db
          .query("entries")
          .withIndex("by_competition", q => q.eq("competitionId", link.competitionId))
          .collect();
        const paid = entries.filter(e => e.paidAt && e.leaderboardPosition != null);
        N = paid.length;
        const entry = paid.find(e =>
          matchesPlayer(e.userId, e.displayName) ||
          splitPairsName(e.displayName).some(n => matchesPlayer(undefined, n))
        );
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

// ── Race to Swinley Forest 2026: Full Competition Calendar ────────────────────
// All scheduled RTSF competitions for the 2026 season.
// Knockouts/trophies without fixed dates use approximate month-start placeholders.

type CalendarEntry = {
  date: string;
  name: string;
  slug: string;
  category: string;
  scoringFormat: string;
  isPairsEvent?: boolean;
};

const RTSF_CALENDAR_2026: CalendarEntry[] = [
  // ── Majors — Best 3 count, Bonus Factor ×3 ────────────────────────────────
  { date: "2026-06-14", name: "Dibbens Overall (Women)",         slug: "rtsf-dibbens-overall-jun14",            category: "major",    scoringFormat: "stableford" },
  { date: "2026-06-14", name: "Ward Trophy (Men)",               slug: "rtsf-ward-trophy-jun14",                category: "major",    scoringFormat: "stableford" },
  { date: "2026-06-27", name: "Captain's Day",                   slug: "rtsf-captains-day-jun27",               category: "major",    scoringFormat: "stableford" },
  { date: "2026-08-15", name: "President's Day",                 slug: "rtsf-presidents-day-aug15",             category: "major",    scoringFormat: "stableford" },
  { date: "2026-09-19", name: "Tiger of the Year",               slug: "rtsf-tiger-of-year-sep19",              category: "major",    scoringFormat: "stableford" },
  { date: "2026-10-03", name: "Fox of the Year",                 slug: "rtsf-fox-of-year-oct03",                category: "major",    scoringFormat: "stableford" },

  // ── Medals & Named Events — Best 4 count, Bonus Factor ×2 ────────────────
  { date: "2026-04-16", name: "Midweek Medal",                   slug: "rtsf-midweek-medal-apr16",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-04-19", name: "Men's Middlesex Coronation Bowl", slug: "rtsf-middlesex-coronation-bowl-apr19",  category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-05-02", name: "Steve Biggs Cup",                 slug: "rtsf-steve-biggs-cup-may02",            category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-05-03", name: "Monthly Medal",                   slug: "rtsf-monthly-medal-may03",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-05-14", name: "Midweek Medal",                   slug: "rtsf-midweek-medal-may14",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-06-07", name: "Monthly Medal",                   slug: "rtsf-monthly-medal-jun07",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-06-11", name: "Midweek Medal",                   slug: "rtsf-midweek-medal-jun11",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-07-05", name: "Monthly Medal",                   slug: "rtsf-monthly-medal-jul05",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-07-11", name: "Club Championships Guest Medal",  slug: "rtsf-club-champs-guest-medal-jul11",    category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-07-11", name: "Club Championships Overall",      slug: "rtsf-club-champs-overall-jul11",        category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-07-16", name: "Midweek Medal",                   slug: "rtsf-midweek-medal-jul16",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-07-19", name: "Open Pairs Mixed Medal",          slug: "rtsf-open-pairs-mixed-medal-jul19",     category: "medal",    scoringFormat: "strokeplay", isPairsEvent: true },
  { date: "2026-08-02", name: "Monthly Medal",                   slug: "rtsf-monthly-medal-aug02",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-08-06", name: "Midweek Medal",                   slug: "rtsf-midweek-medal-aug06",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-08-08", name: "Singles Bogey Competition",       slug: "rtsf-singles-bogey-aug08",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-08-12", name: "Braat Trophy Qualifier",          slug: "rtsf-braat-trophy-qualifier-aug12",     category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-09-06", name: "Monthly Medal",                   slug: "rtsf-monthly-medal-sep06",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-09-10", name: "Midweek Medal",                   slug: "rtsf-midweek-medal-sep10",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-09-17", name: "Rabbit of the Year",              slug: "rtsf-rabbit-of-year-sep17",             category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-10-04", name: "Monthly Medal",                   slug: "rtsf-monthly-medal-oct04",              category: "medal",    scoringFormat: "strokeplay" },
  { date: "2026-10-07", name: "Senior of the Year",              slug: "rtsf-senior-of-year-oct07",             category: "medal",    scoringFormat: "strokeplay" },

  // ── Knockouts — QF+ points (300/150/75/50); dates are approx. ─────────────
  { date: "2026-05-01", name: "Canick Cup",                      slug: "rtsf-canick-cup-2026",                  category: "knockout", scoringFormat: "strokeplay" },
  { date: "2026-06-01", name: "Cronshaw Cup",                    slug: "rtsf-cronshaw-cup-2026",                category: "knockout", scoringFormat: "strokeplay" },
  { date: "2026-07-01", name: "Holmes Cup",                      slug: "rtsf-holmes-cup-2026",                  category: "knockout", scoringFormat: "strokeplay" },

  // ── Trophies — Winner 100pts, Runner-up 50pts (÷2 pairs); dates approx. ──
  { date: "2026-05-01", name: "Davis Cup",                       slug: "rtsf-davis-cup-2026",                   category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-05-01", name: "Spring Foursomes",                slug: "rtsf-spring-foursomes-2026",            category: "trophy",   scoringFormat: "strokeplay", isPairsEvent: true },
  { date: "2026-05-01", name: "Towle Cup",                       slug: "rtsf-towle-cup-2026",                   category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-06-01", name: "Syrett Cup",                      slug: "rtsf-syrett-cup-2026",                  category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-06-01", name: "Lambert Cup",                     slug: "rtsf-lambert-cup-2026",                 category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-07-01", name: "Abbey Cup",                       slug: "rtsf-abbey-cup-2026",                   category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-07-01", name: "Scratch Singles (Men)",           slug: "rtsf-scratch-singles-men-2026",         category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-07-01", name: "Scratch Trophy (Women)",          slug: "rtsf-scratch-trophy-women-2026",        category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-08-01", name: "Keith Dalby Trophy",              slug: "rtsf-keith-dalby-trophy-2026",          category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-08-01", name: "Womens Club Champs",              slug: "rtsf-womens-club-champs-2026",          category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-09-01", name: "Trill Gobblers",                  slug: "rtsf-trill-gobblers-2026",              category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-09-01", name: "Lorne Wallet",                    slug: "rtsf-lorne-wallet-2026",                category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-09-01", name: "Koch Cup",                        slug: "rtsf-koch-cup-2026",                    category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-09-01", name: "Jackson Cup",                     slug: "rtsf-jackson-cup-2026",                 category: "trophy",   scoringFormat: "strokeplay" },
  { date: "2026-09-01", name: "Pairs Scramble",                  slug: "rtsf-pairs-scramble-2026",              category: "trophy",   scoringFormat: "strokeplay", isPairsEvent: true },
  { date: "2026-09-01", name: "Parker Cup",                      slug: "rtsf-parker-cup-2026",                  category: "trophy",   scoringFormat: "strokeplay" },
];

export const seedRTSFCalendar = internalMutation({
  args: { seriesId: v.id("series") },
  handler: async (ctx, { seriesId }) => {
    const adminId = "system";

    const series = await ctx.db.get(seriesId);
    if (!series) throw new Error("Series not found");
    const { clubId } = series;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const results: string[] = [];

    for (const ev of RTSF_CALENDAR_2026) {
      let compId: import("./_generated/dataModel").Id<"competitions"> | null = null;

      const existing = await ctx.db
        .query("competitions")
        .withIndex("by_club_and_slug", q => q.eq("clubId", clubId).eq("slug", ev.slug))
        .unique();

      if (existing) {
        compId = existing._id;
        results.push(`exists: ${ev.name} (${ev.date})`);
      } else {
        const status = ev.date < today ? "complete" : "upcoming";
        compId = await ctx.db.insert("competitions", {
          clubId,
          scope: "club",
          name: ev.name,
          slug: ev.slug,
          status,
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
          scoringFormat: ev.scoringFormat,
          createdBy: adminId,
          createdAt: now,
          updatedAt: now,
        });
        results.push(`created (${status}): ${ev.name} (${ev.date})`);
      }

      // Link to series if not already linked
      const existingLinks = await ctx.db
        .query("seriesCompetitions")
        .withIndex("by_series", q => q.eq("seriesId", seriesId))
        .collect();
      if (!existingLinks.some(l => l.competitionId === compId)) {
        await ctx.db.insert("seriesCompetitions", {
          seriesId,
          competitionId: compId,
          category: ev.category,
          isPairsEvent: ev.isPairsEvent ?? false,
          addedAt: now,
        });
        results.push(`linked: ${ev.name} → series`);
      }
    }

    return results;
  },
});
