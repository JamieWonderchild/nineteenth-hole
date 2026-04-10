import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getIdentity(ctx: MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  return identity;
}

function isSuperAdmin(email: string | undefined | null) {
  const emails = (process.env.SUPERADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  return !!email && emails.includes(email);
}

// Can manage a fixture: club admin OR the team captain for that team
async function assertCanManageFixture(ctx: MutationCtx, fixtureId: Id<"interclubFixtures">) {
  const identity = await getIdentity(ctx);
  if (isSuperAdmin(identity.email)) return identity.subject;

  const fixture = await ctx.db.get(fixtureId);
  if (!fixture) throw new Error("Fixture not found");

  const homeTeam = await ctx.db.get(fixture.homeTeamId);
  const awayTeam = await ctx.db.get(fixture.awayTeamId);

  // Check if user is captain of either team
  const isCaptain = homeTeam?.captainUserId === identity.subject ||
    awayTeam?.captainUserId === identity.subject;
  if (isCaptain) return identity.subject;

  // Check if club admin for either team's club (only platform clubs have clubId)
  const clubIds = [homeTeam?.clubId, awayTeam?.clubId].filter((id): id is Id<"clubs"> => !!id);
  for (const clubId of clubIds) {
    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", clubId).eq("userId", identity.subject))
      .unique();
    if (member?.role === "admin") return identity.subject;
  }
  throw new Error("Not authorised to manage this fixture");
}

async function assertCanManageLeague(ctx: MutationCtx, leagueId: Id<"interclubLeagues">) {
  const identity = await getIdentity(ctx);
  if (isSuperAdmin(identity.email)) return identity.subject;
  // Any club admin who has a team in the league can manage league settings
  const teams = await ctx.db
    .query("interclubTeams")
    .withIndex("by_league", q => q.eq("leagueId", leagueId))
    .collect();
  for (const team of teams) {
    if (!team.clubId) continue;
    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", q => q.eq("clubId", team.clubId!).eq("userId", identity.subject))
      .unique();
    if (member?.role === "admin") return identity.subject;
  }
  throw new Error("Not authorised");
}

// ── Leagues ───────────────────────────────────────────────────────────────────

export const listLeagues = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("interclubLeagues").order("desc").collect();
  },
});

export const getLeague = query({
  args: { leagueId: v.id("interclubLeagues") },
  handler: async (ctx, { leagueId }) => ctx.db.get(leagueId),
});

export const createLeague = mutation({
  args: {
    name: v.string(),
    county: v.optional(v.string()),
    season: v.string(),
    format: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    // Any admin can create a league
    return ctx.db.insert("interclubLeagues", {
      ...args,
      createdBy: identity.subject,
      createdAt: new Date().toISOString(),
    });
  },
});

// ── Teams ─────────────────────────────────────────────────────────────────────

export const listTeams = query({
  args: { leagueId: v.id("interclubLeagues") },
  handler: async (ctx, { leagueId }) => {
    return ctx.db
      .query("interclubTeams")
      .withIndex("by_league", q => q.eq("leagueId", leagueId))
      .collect();
  },
});

export const listTeamsByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("interclubTeams")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .collect();
  },
});

export const saveTeam = mutation({
  args: {
    leagueId: v.id("interclubLeagues"),
    teamId: v.optional(v.id("interclubTeams")),
    clubId: v.optional(v.id("clubs")),
    golfClubId: v.optional(v.id("golfClubs")),
    clubName: v.string(),
    teamName: v.string(),
    handicapMin: v.optional(v.number()),
    handicapMax: v.optional(v.number()),
    captainUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    if (!isSuperAdmin(identity.email)) {
      // Must be admin of their own club (clubId) or super admin
      if (args.clubId) {
        const member = await ctx.db
          .query("clubMembers")
          .withIndex("by_club_and_user", q => q.eq("clubId", args.clubId!).eq("userId", identity.subject))
          .unique();
        if (!member || member.role !== "admin") throw new Error("Not authorised");
      } else {
        // Adding an away team (not platform club) — any league admin can do this
        await assertCanManageLeague(ctx, args.leagueId);
      }
    }
    const { teamId, ...fields } = args;
    if (teamId) {
      await ctx.db.patch(teamId, fields);
      return teamId;
    }
    return ctx.db.insert("interclubTeams", { ...fields, createdAt: new Date().toISOString() });
  },
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const listFixtures = query({
  args: { leagueId: v.id("interclubLeagues") },
  handler: async (ctx, { leagueId }) => {
    const fixtures = await ctx.db
      .query("interclubFixtures")
      .withIndex("by_league", q => q.eq("leagueId", leagueId))
      .order("desc")
      .collect();

    // Enrich with team names
    return Promise.all(fixtures.map(async f => {
      const [home, away] = await Promise.all([
        ctx.db.get(f.homeTeamId),
        ctx.db.get(f.awayTeamId),
      ]);
      return { ...f, homeTeam: home, awayTeam: away };
    }));
  },
});

export const getFixture = query({
  args: { fixtureId: v.id("interclubFixtures") },
  handler: async (ctx, { fixtureId }) => {
    const fixture = await ctx.db.get(fixtureId);
    if (!fixture) return null;
    const [home, away] = await Promise.all([
      ctx.db.get(fixture.homeTeamId),
      ctx.db.get(fixture.awayTeamId),
    ]);
    const matches = await ctx.db
      .query("interclubMatches")
      .withIndex("by_fixture", q => q.eq("fixtureId", fixtureId))
      .collect();
    return { ...fixture, homeTeam: home, awayTeam: away, matches };
  },
});

export const createFixture = mutation({
  args: {
    leagueId: v.id("interclubLeagues"),
    homeTeamId: v.id("interclubTeams"),
    awayTeamId: v.id("interclubTeams"),
    date: v.optional(v.string()),
    venue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    if (!isSuperAdmin(identity.email)) {
      await assertCanManageLeague(ctx, args.leagueId);
    }
    const now = new Date().toISOString();
    return ctx.db.insert("interclubFixtures", {
      ...args,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateFixture = mutation({
  args: {
    fixtureId: v.id("interclubFixtures"),
    date: v.optional(v.string()),
    venue: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { fixtureId, ...fields }) => {
    await assertCanManageFixture(ctx, fixtureId);
    await ctx.db.patch(fixtureId, { ...fields, updatedAt: new Date().toISOString() });
  },
});

// ── Match results ─────────────────────────────────────────────────────────────

export const saveMatch = mutation({
  args: {
    fixtureId: v.id("interclubFixtures"),
    matchId: v.optional(v.id("interclubMatches")),
    matchNumber: v.number(),
    homePlayer: v.string(),
    homeUserId: v.optional(v.string()),
    awayPlayer: v.string(),
    awayUserId: v.optional(v.string()),
    result: v.optional(v.string()),
    winner: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertCanManageFixture(ctx, args.fixtureId);
    const fixture = await ctx.db.get(args.fixtureId);
    if (!fixture) throw new Error("Fixture not found");

    const homePoints = args.winner === "home" ? 1 : args.winner === "halved" ? 0.5 : args.winner === "away" ? 0 : undefined;
    const awayPoints = args.winner === "away" ? 1 : args.winner === "halved" ? 0.5 : args.winner === "home" ? 0 : undefined;

    const { matchId, ...fields } = args;

    if (matchId) {
      await ctx.db.patch(matchId, { ...fields, homePoints, awayPoints });
    } else {
      await ctx.db.insert("interclubMatches", {
        ...fields,
        leagueId: fixture.leagueId,
        homePoints,
        awayPoints,
      });
    }

    // Recompute fixture totals
    await recomputeFixtureScore(ctx, args.fixtureId);
  },
});

async function recomputeFixtureScore(ctx: MutationCtx, fixtureId: Id<"interclubFixtures">) {
  const matches = await ctx.db
    .query("interclubMatches")
    .withIndex("by_fixture", q => q.eq("fixtureId", fixtureId))
    .collect();

  const homePoints = matches.reduce((s, m) => s + (m.homePoints ?? 0), 0);
  const awayPoints = matches.reduce((s, m) => s + (m.awayPoints ?? 0), 0);
  const allDone = matches.length > 0 && matches.every(m => m.winner !== undefined);

  await ctx.db.patch(fixtureId, {
    homePoints,
    awayPoints,
    status: allDone ? "complete" : "in_progress",
    updatedAt: new Date().toISOString(),
  });
}

export const deleteMatch = mutation({
  args: { matchId: v.id("interclubMatches") },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get(matchId);
    if (!match) throw new Error("Not found");
    await assertCanManageFixture(ctx, match.fixtureId);
    await ctx.db.delete(matchId);
    await recomputeFixtureScore(ctx, match.fixtureId);
  },
});

// ── Standings ─────────────────────────────────────────────────────────────────

export const standings = query({
  args: { leagueId: v.id("interclubLeagues") },
  handler: async (ctx, { leagueId }) => {
    const [teams, fixtures] = await Promise.all([
      ctx.db.query("interclubTeams").withIndex("by_league", q => q.eq("leagueId", leagueId)).collect(),
      ctx.db.query("interclubFixtures").withIndex("by_league", q => q.eq("leagueId", leagueId)).collect(),
    ]);

    const stats: Record<string, {
      teamId: string; teamName: string; clubName: string;
      played: number; won: number; lost: number; drawn: number;
      matchPointsFor: number; matchPointsAgainst: number;
    }> = {};

    for (const team of teams) {
      stats[team._id] = {
        teamId: team._id,
        teamName: team.teamName,
        clubName: team.clubName,
        played: 0, won: 0, lost: 0, drawn: 0,
        matchPointsFor: 0, matchPointsAgainst: 0,
      };
    }

    for (const fixture of fixtures) {
      if (fixture.status !== "complete") continue;
      const home = stats[fixture.homeTeamId];
      const away = stats[fixture.awayTeamId];
      if (!home || !away) continue;

      const hp = fixture.homePoints ?? 0;
      const ap = fixture.awayPoints ?? 0;

      home.played++;
      away.played++;
      home.matchPointsFor += hp;
      home.matchPointsAgainst += ap;
      away.matchPointsFor += ap;
      away.matchPointsAgainst += hp;

      if (hp > ap) { home.won++; away.lost++; }
      else if (ap > hp) { away.won++; home.lost++; }
      else { home.drawn++; away.drawn++; }
    }

    return Object.values(stats).sort((a, b) => {
      const ptA = a.won * 2 + a.drawn;
      const ptB = b.won * 2 + b.drawn;
      if (ptA !== ptB) return ptB - ptA;
      return (b.matchPointsFor - b.matchPointsAgainst) - (a.matchPointsFor - a.matchPointsAgainst);
    }).map((s, i) => ({ ...s, position: i + 1, points: s.won * 2 + s.drawn }));
  },
});
