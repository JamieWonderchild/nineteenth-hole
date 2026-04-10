import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function assertAdmin(ctx: MutationCtx, clubId: Id<"clubs">) {
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

// ── Queries ──────────────────────────────────────────────────────────────────

export const listByClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    return ctx.db
      .query("knockoutTournaments")
      .withIndex("by_club", q => q.eq("clubId", clubId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { tournamentId: v.id("knockoutTournaments") },
  handler: async (ctx, { tournamentId }) => {
    return ctx.db.get(tournamentId);
  },
});

export const getEntrants = query({
  args: { tournamentId: v.id("knockoutTournaments") },
  handler: async (ctx, { tournamentId }) => {
    return ctx.db
      .query("knockoutEntrants")
      .withIndex("by_tournament", q => q.eq("tournamentId", tournamentId))
      .collect();
  },
});

export const getMatches = query({
  args: { tournamentId: v.id("knockoutTournaments") },
  handler: async (ctx, { tournamentId }) => {
    return ctx.db
      .query("knockoutMatches")
      .withIndex("by_tournament", q => q.eq("tournamentId", tournamentId))
      .collect();
  },
});

export const getRoundMatches = query({
  args: { tournamentId: v.id("knockoutTournaments"), round: v.number() },
  handler: async (ctx, { tournamentId, round }) => {
    return ctx.db
      .query("knockoutMatches")
      .withIndex("by_tournament_and_round", q => q.eq("tournamentId", tournamentId).eq("round", round))
      .collect();
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    seeded: v.optional(v.boolean()),
    entrants: v.array(v.object({
      userId: v.optional(v.string()),
      displayName: v.string(),
      seed: v.optional(v.number()),
    })),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    await assertAdmin(ctx, args.clubId);

    const count = args.entrants.length;
    if (count < 2) throw new Error("Need at least 2 entrants");

    // Total rounds = ceil(log2(count))
    const totalRounds = Math.ceil(Math.log2(count));
    const bracketSize = Math.pow(2, totalRounds);

    const now = new Date().toISOString();
    const tournamentId = await ctx.db.insert("knockoutTournaments", {
      clubId: args.clubId,
      name: args.name,
      status: "active",
      format: "single_elimination",
      seeded: args.seeded,
      currentRound: 1,
      totalRounds,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    // Insert entrants (sorted by seed if seeded)
    const sorted = args.seeded
      ? [...args.entrants].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
      : shuffle([...args.entrants]);

    const entrantIds: Array<Id<"knockoutEntrants">> = [];
    for (const e of sorted) {
      const id = await ctx.db.insert("knockoutEntrants", {
        tournamentId,
        userId: e.userId,
        displayName: e.displayName,
        seed: e.seed,
      });
      entrantIds.push(id);
    }

    // Pad with byes to fill bracket
    const byeIds: Array<Id<"knockoutEntrants"> | null> = [...entrantIds];
    while (byeIds.length < bracketSize) byeIds.push(null);

    // Generate round 1 matches
    const matchCount = bracketSize / 2;
    for (let i = 0; i < matchCount; i++) {
      const playerAId = byeIds[i * 2] ?? undefined;
      const playerBId = byeIds[i * 2 + 1] ?? undefined;

      // Auto-advance if one player is a bye
      let winnerId: Id<"knockoutEntrants"> | undefined;
      if (playerAId && !playerBId) winnerId = playerAId;
      if (playerBId && !playerAId) winnerId = playerBId;

      await ctx.db.insert("knockoutMatches", {
        tournamentId,
        round: 1,
        matchNumber: i + 1,
        playerAId: playerAId ?? undefined,
        playerBId: playerBId ?? undefined,
        winnerId,
        completedAt: winnerId ? now : undefined,
      });
    }

    // If byes caused auto-advances, generate subsequent rounds
    await generateNextRoundIfReady(ctx, tournamentId, 1, totalRounds, now);

    return tournamentId;
  },
});

export const recordResult = mutation({
  args: {
    matchId: v.id("knockoutMatches"),
    winnerId: v.id("knockoutEntrants"),
    scoreA: v.optional(v.string()),
    scoreB: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error("Match not found");

    const tournament = await ctx.db.get(match.tournamentId);
    if (!tournament) throw new Error("Tournament not found");

    await assertAdmin(ctx, tournament.clubId);

    const now = new Date().toISOString();
    await ctx.db.patch(args.matchId, {
      winnerId: args.winnerId,
      scoreA: args.scoreA,
      scoreB: args.scoreB,
      completedAt: now,
    });

    // Mark loser as eliminated
    const loserId = args.winnerId === match.playerAId ? match.playerBId : match.playerAId;
    if (loserId) {
      await ctx.db.patch(loserId, {
        eliminated: true,
        eliminatedRound: match.round,
      });
    }

    // Check if round is complete → generate next round
    await generateNextRoundIfReady(ctx, match.tournamentId, match.round, tournament.totalRounds, now);
  },
});

// ── Internal helper ───────────────────────────────────────────────────────────

async function generateNextRoundIfReady(
  ctx: MutationCtx,
  tournamentId: Id<"knockoutTournaments">,
  round: number,
  totalRounds: number,
  now: string
) {
  const roundMatches = await ctx.db
    .query("knockoutMatches")
    .withIndex("by_tournament_and_round", q => q.eq("tournamentId", tournamentId).eq("round", round))
    .collect();

  const allComplete = roundMatches.every(m => m.winnerId);
  if (!allComplete) return;

  const nextRound = round + 1;
  if (nextRound > totalRounds) {
    // Tournament complete
    await ctx.db.patch(tournamentId, { status: "complete", updatedAt: now });
    return;
  }

  // Advance winners to next round
  const winners = roundMatches
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map(m => m.winnerId!);

  const nextMatchCount = Math.ceil(winners.length / 2);
  for (let i = 0; i < nextMatchCount; i++) {
    const playerAId = winners[i * 2];
    const playerBId = winners[i * 2 + 1];
    let winnerId: Id<"knockoutEntrants"> | undefined;
    if (playerAId && !playerBId) winnerId = playerAId;

    await ctx.db.insert("knockoutMatches", {
      tournamentId,
      round: nextRound,
      matchNumber: i + 1,
      playerAId,
      playerBId,
      winnerId,
      completedAt: winnerId ? now : undefined,
    });
  }

  await ctx.db.patch(tournamentId, { currentRound: nextRound, updatedAt: now });

  // Recurse in case this round also has byes
  await generateNextRoundIfReady(ctx, tournamentId, nextRound, totalRounds, now);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
