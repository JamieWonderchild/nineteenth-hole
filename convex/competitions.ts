import { v } from "convex/values";
import { mutation, query, action, MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

async function assertClubAdminOrSuperAdmin(
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

async function assertSuperAdmin(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  if (!identity.email || !superAdminEmails.includes(identity.email)) throw new Error("Not authorised");
}

// ── Queries ─────────────────────────────────────────────────────────────────

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("competitions")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .order("desc")
      .collect();
  },
});

// All platform-wide pools (scope = 'platform')
export const listPlatform = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("competitions")
      .withIndex("by_scope", q => q.eq("scope", "platform"))
      .order("desc")
      .collect();
  },
});

// Platform pools that are open or live (for the home page banner)
export const listPlatformActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("competitions")
      .withIndex("by_scope", q => q.eq("scope", "platform"))
      .collect();
    return all.filter(c => c.status === "open" || c.status === "live");
  },
});

export const getBySlug = query({
  args: { clubId: v.id("clubs"), slug: v.string() },
  handler: async (ctx, { clubId, slug }) => {
    return ctx.db
      .query("competitions")
      .withIndex("by_club_and_slug", q => q.eq("clubId", clubId).eq("slug", slug))
      .unique();
  },
});

// Global slug lookup — for platform pools (no clubId)
export const getByPlatformSlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const results = await ctx.db
      .query("competitions")
      .withIndex("by_slug", q => q.eq("slug", slug))
      .collect();
    return results.find(c => c.scope === "platform") ?? null;
  },
});

export const get = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    return ctx.db.get(competitionId);
  },
});

export const listLive = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("competitions")
      .withIndex("by_status", q => q.eq("status", "live"))
      .collect();
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

// Create a club-scoped competition (club admin only)
export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    type: v.string(),
    tournamentRef: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    entryDeadline: v.string(),
    drawType: v.string(),
    tierCount: v.number(),
    playersPerTier: v.number(),
    pickCount: v.optional(v.number()),
    reserveCount: v.optional(v.number()),
    entryFee: v.number(),
    currency: v.string(),
    prizeStructure: v.array(v.object({
      position: v.number(),
      percentage: v.number(),
    })),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    await assertClubAdminOrSuperAdmin(ctx, args.clubId);

    const existing = await ctx.db
      .query("competitions")
      .withIndex("by_club_and_slug", q => q.eq("clubId", args.clubId).eq("slug", args.slug))
      .unique();
    if (existing) throw new Error(`Slug "${args.slug}" already exists in this club`);

    const now = new Date().toISOString();
    return ctx.db.insert("competitions", {
      ...args,
      scope: "club",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Create a platform-wide tour pool (super admin only)
export const createPlatformPool = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    type: v.string(),
    tournamentRef: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    entryDeadline: v.string(),
    drawType: v.string(),
    tierCount: v.number(),
    playersPerTier: v.number(),
    entryFee: v.number(),
    currency: v.string(),
    prizeStructure: v.array(v.object({
      position: v.number(),
      percentage: v.number(),
    })),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    await assertSuperAdmin(ctx);

    // Global slug uniqueness check
    const existing = await ctx.db
      .query("competitions")
      .withIndex("by_slug", q => q.eq("slug", args.slug))
      .collect();
    if (existing.some(c => c.scope === "platform")) {
      throw new Error(`Platform pool with slug "${args.slug}" already exists`);
    }

    const now = new Date().toISOString();
    return ctx.db.insert("competitions", {
      ...args,
      scope: "platform",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
    competitionId: v.id("competitions"),
    status: v.string(),
  },
  handler: async (ctx, { competitionId, status }) => {
    const comp = await ctx.db.get(competitionId);
    if (!comp) throw new Error("Competition not found");

    if (comp.scope === "platform") {
      await assertSuperAdmin(ctx);
    } else if (comp.clubId) {
      await assertClubAdminOrSuperAdmin(ctx, comp.clubId);
    } else {
      await assertSuperAdmin(ctx);
    }

    await ctx.db.patch(competitionId, { status, updatedAt: new Date().toISOString() });
  },
});

export const markDrawComplete = mutation({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const comp = await ctx.db.get(competitionId);
    if (!comp) throw new Error("Competition not found");

    if (comp.scope === "platform") {
      await assertSuperAdmin(ctx);
    } else if (comp.clubId) {
      await assertClubAdminOrSuperAdmin(ctx, comp.clubId);
    } else {
      await assertSuperAdmin(ctx);
    }

    await ctx.db.patch(competitionId, {
      drawCompletedAt: new Date().toISOString(),
      status: "live",
      updatedAt: new Date().toISOString(),
    });
  },
});

// ── ESPN prize money sync ─────────────────────────────────────────────────────
// Maps our tournamentRef → ESPN tournament ID
const ESPN_TOURNAMENT_IDS: Record<string, string> = {
  "masters-2026":          "401811941",
  "pga-championship-2026": "401811943",
  "us-open-2026":          "401811945",
  "the-open-2026":         "401811947",
};

// Masters 2026 prize table (USD) — fallback when officialAmount not yet populated
const PRIZE_TABLE_BY_REF: Record<string, Record<number, number>> = {
  "masters-2026": {
    1: 4200000, 2: 2268000,  3: 1428000,  4: 1008000,  5: 840000,
    6: 756000,  7: 703500,   8: 651000,   9: 609000,   10: 567000,
    11: 525000, 12: 483000,  13: 441000,  14: 399000,  15: 378000,
    16: 357000, 17: 336000,  18: 315000,  19: 294000,  20: 273000,
    21: 252000, 22: 235200,  23: 218400,  24: 201600,  25: 184800,
    26: 168000, 27: 161700,  28: 155400,  29: 149100,  30: 142800,
    31: 136500, 32: 130200,  33: 123900,  34: 118650,  35: 113400,
    36: 108150, 37: 102900,  38: 98700,   39: 94500,   40: 90300,
    41: 86100,  42: 81900,   43: 77700,   44: 73500,   45: 69300,
    46: 65100,  47: 60900,   48: 57540,   49: 54600,   50: 52920,
  },
};

function normalizeName(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const syncESPNPrizeMoney = action({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }): Promise<{ updated: number; total: number; message: string }> => {
    const comp = await ctx.runQuery(api.competitions.get, { competitionId });
    if (!comp) throw new Error("Competition not found");
    if (!comp.tournamentRef) throw new Error("Competition has no tournament reference");

    const espnId = ESPN_TOURNAMENT_IDS[comp.tournamentRef];
    if (!espnId) throw new Error(`No ESPN ID mapped for ${comp.tournamentRef}`);

    const resp = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?tournamentId=${espnId}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!resp.ok) throw new Error(`ESPN API returned ${resp.status}`);
    const data = await resp.json() as {
      events?: Array<{
        competitions?: Array<{
          competitors?: Array<{
            athlete?: { displayName?: string };
            earnings?: number;
            sortOrder?: number;
            statistics?: Array<{ name: string; value?: number; displayValue?: string }>;
            status?: { position?: { displayName?: string; isTie?: boolean } };
          }>
        }>
      }>
    };

    const competitors = data?.events?.[0]?.competitions?.[0]?.competitors ?? [];
    const players = await ctx.runQuery(api.players.listByCompetition, { competitionId });
    const prizeTable = PRIZE_TABLE_BY_REF[comp.tournamentRef] ?? {};

    // Build lookup map: normalized name → player id
    const playerMap = new Map<string, Id<"players">>();
    for (const p of players) {
      playerMap.set(normalizeName(p.name), p._id);
    }

    const updates: Array<{ playerId: Id<"players">; prizeMoney: number }> = [];

    for (const comp of competitors) {
      const name = comp.athlete?.displayName ?? "";
      if (!name) continue;

      // Get prize: prefer officialAmount stat, fall back to earnings field, then position table
      const officialStat = comp.statistics?.find(s => s.name === "officialAmount");
      const officialVal = typeof officialStat?.value === "number" && officialStat.value > 0
        ? officialStat.value : null;
      const earningsVal = typeof comp.earnings === "number" && comp.earnings > 0
        ? comp.earnings : null;

      // Try position-based table
      const posStr = comp.status?.position?.displayName ?? "";
      const posNum = parseInt(posStr.replace("T", ""), 10);
      const tableVal = !isNaN(posNum) && prizeTable[posNum] ? prizeTable[posNum] : null;

      const prizeUSD = officialVal ?? earningsVal ?? tableVal;
      if (!prizeUSD) continue;

      // Find matching player (exact, then last-name fallback)
      const norm = normalizeName(name);
      let playerId = playerMap.get(norm);
      if (!playerId) {
        const lastName = norm.split(" ").pop() ?? "";
        for (const [pName, pId] of playerMap) {
          if (pName.split(" ").pop() === lastName) { playerId = pId; break; }
        }
      }
      if (!playerId) continue;

      updates.push({ playerId, prizeMoney: Math.round(prizeUSD * 100) }); // USD cents
    }

    if (updates.length > 0) {
      await ctx.runMutation(api.players.bulkUpdatePrizeMoney, { updates });
      await ctx.runMutation(api.entries.refreshLeaderboard, { competitionId });
    }

    const hasLiveData = competitors.some(c => (c.earnings ?? 0) > 0);
    return {
      updated: updates.length,
      total: competitors.length,
      message: hasLiveData
        ? `Updated ${updates.length} players from live ESPN data`
        : `No live prize money yet — used position-based table for ${updates.length} players`,
    };
  },
});
