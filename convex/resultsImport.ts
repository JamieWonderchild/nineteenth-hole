/**
 * Competition results import — for Alan's Finchley Golf Club scraper
 *
 * HTTP POST /api/import-results
 * Authorization: Bearer {IMPORT_API_KEY env var}
 *
 * Body shape:
 * {
 *   "clubSlug": "finchley-golf-club",
 *   "competitionName": "Monthly Medal",
 *   "competitionDate": "2026-04-15",   // YYYY-MM-DD
 *   "category": "medal",               // major | medal | stableford | knockout | trophy
 *   "isPairsEvent": false,             // optional, for trophy pairs
 *   "results": [
 *     { "position": 1, "name": "Jamie Aronson", "memberId": "12345" },
 *     ...
 *   ]
 * }
 */

import { v } from "convex/values";
import { httpAction, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// ── HTTP action (auth layer) ──────────────────────────────────────────────────

export const importResults = httpAction(async (ctx, request) => {
  const apiKey = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const expected = process.env.IMPORT_API_KEY ?? "";
  if (!expected || apiKey !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await ctx.runMutation(api.resultsImport.processCompetition, body as {
      clubSlug: string;
      competitionName: string;
      competitionDate: string;
      category: string;
      isPairsEvent?: boolean;
      results: Array<{ position: number; name: string; memberId?: string }>;
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// ── Mutation (DB logic) ───────────────────────────────────────────────────────

export const processCompetition = mutation({
  args: {
    clubSlug: v.string(),
    competitionName: v.string(),
    competitionDate: v.string(),      // "YYYY-MM-DD"
    category: v.string(),             // 'major' | 'medal' | 'stableford' | 'knockout' | 'trophy'
    isPairsEvent: v.optional(v.boolean()),
    results: v.array(v.object({
      position: v.number(),
      name: v.string(),
      memberId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // 1. Find club
    const club = await ctx.db
      .query("clubs")
      .withIndex("by_slug", q => q.eq("slug", args.clubSlug))
      .unique();
    if (!club) throw new Error(`Club not found: ${args.clubSlug}`);

    // 2. Find or create competition
    const compId = await findOrCreateCompetition(ctx, club._id, args.competitionName, args.competitionDate, club.currency);
    const comp = await ctx.db.get(compId);
    if (!comp) throw new Error("Failed to resolve competition");

    // 3. Auto-link to the club's active series (if not already linked)
    const activeSeries = await ctx.db
      .query("series")
      .withIndex("by_club", q => q.eq("clubId", club._id))
      .collect()
      .then(list => list.find(s => s.status === "active") ?? null);

    let linkedSeries: string | null = null;
    if (activeSeries) {
      const existingLinks = await ctx.db
        .query("seriesCompetitions")
        .withIndex("by_series", q => q.eq("seriesId", activeSeries._id))
        .collect();
      if (!existingLinks.some(l => l.competitionId === compId)) {
        await ctx.db.insert("seriesCompetitions", {
          seriesId: activeSeries._id,
          competitionId: compId,
          category: args.category,
          isPairsEvent: args.isPairsEvent,
          addedAt: new Date().toISOString(),
        });
        linkedSeries = activeSeries.name;
      } else {
        linkedSeries = activeSeries.name; // already linked
      }
    }

    // 4. Upsert entries for each result
    const now = new Date().toISOString();
    let created = 0, updated = 0;

    for (const result of args.results) {
      const userId = await findOrCreateMember(ctx, club._id, result.name, result.memberId, now);

      const existing = await ctx.db
        .query("entries")
        .withIndex("by_competition_and_user", q =>
          q.eq("competitionId", compId).eq("userId", userId)
        )
        .collect();

      if (existing.length > 0) {
        await ctx.db.patch(existing[0]._id, {
          leaderboardPosition: result.position,
          updatedAt: now,
        });
        updated++;
      } else {
        await ctx.db.insert("entries", {
          competitionId: compId,
          clubId: club._id,
          userId,
          displayName: result.name,
          paidAt: now,           // treated as paid so it counts in standings
          leaderboardPosition: result.position,
          createdAt: now,
          updatedAt: now,
        });
        created++;
      }
    }

    // 5. Mark competition as complete if not already
    if (comp.status !== "complete") {
      await ctx.db.patch(compId, { status: "complete", updatedAt: now });
    }

    return {
      ok: true,
      competitionId: compId,
      competitionName: comp.name,
      entriesCreated: created,
      entriesUpdated: updated,
      linkedSeries,
    };
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function findOrCreateCompetition(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  name: string,
  date: string,
  currency: string,
): Promise<Id<"competitions">> {
  const allComps = await ctx.db
    .query("competitions")
    .withIndex("by_club", q => q.eq("clubId", clubId))
    .collect();

  const normName = normalizeName(name);
  const existing = allComps.find(
    c => normalizeName(c.name) === normName && c.startDate.startsWith(date)
  );
  if (existing) return existing._id;

  // Create a minimal competition record
  const baseSlug = slugify(name) + "-" + date.replace(/-/g, "");
  let slug = baseSlug;
  let suffix = 2;
  while (allComps.some(c => c.slug === slug)) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const now = new Date().toISOString();
  return ctx.db.insert("competitions", {
    clubId,
    scope: "club",
    name,
    slug,
    type: "club_comp",
    drawType: "import",
    status: "complete",
    startDate: date,
    endDate: date,
    entryDeadline: date,
    tierCount: 0,
    playersPerTier: 0,
    entryFee: 0,
    currency,
    prizeStructure: [],
    createdBy: "import",
    createdAt: now,
    updatedAt: now,
  });
}

async function findOrCreateMember(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  name: string,
  memberId: string | undefined,
  now: string,
): Promise<string> {
  // 1. Try exact fgcMemberId match
  if (memberId) {
    const byFgcId = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_fgc_member", q => q.eq("clubId", clubId).eq("fgcMemberId", memberId))
      .unique();
    if (byFgcId) return byFgcId.userId;
  }

  // 2. Try normalized displayName match
  const normName = normalizeName(name);
  const allMembers = await ctx.db
    .query("clubMembers")
    .withIndex("by_club", q => q.eq("clubId", clubId))
    .collect();

  const byName = allMembers.find(m => normalizeName(m.displayName) === normName);
  if (byName) {
    // Backfill the fgcMemberId if we now have it
    if (memberId && !byName.fgcMemberId) {
      await ctx.db.patch(byName._id, { fgcMemberId: memberId });
    }
    return byName.userId;
  }

  // 3. Create a new offline member
  // userId prefix "fgc:" marks it as imported (not a Clerk user)
  const userId = memberId
    ? `fgc:${memberId}`
    : `fgc:name:${normName.replace(/\s+/g, "-")}`;

  await ctx.db.insert("clubMembers", {
    clubId,
    userId,
    role: "member",
    status: "active",
    displayName: name,
    fgcMemberId: memberId,
    totalEntered: 0,
    totalSpent: 0,
    totalWon: 0,
    totalProfit: 0,
    joinedAt: now,
    updatedAt: now,
  });

  return userId;
}
