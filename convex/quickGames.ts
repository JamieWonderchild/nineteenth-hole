import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";

async function assertCreator(ctx: MutationCtx, gameId: import("./_generated/dataModel").Id<"quickGames">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const game = await ctx.db.get(gameId);
  if (!game) throw new Error("Game not found");
  if (game.createdBy !== identity.subject) throw new Error("Not authorised");
  return game;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export const get = query({
  args: { gameId: v.id("quickGames") },
  handler: async (ctx, { gameId }) => {
    return ctx.db.get(gameId);
  },
});

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("quickGames")
      .withIndex("by_creator", q => q.eq("createdBy", userId))
      .order("desc")
      .collect();
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    type: v.string(),           // 'stableford' | 'strokeplay' | 'betterball' | 'skins' | 'nassau'
    currency: v.string(),
    stakePerPlayer: v.number(), // pence/cents per player (0 = fun only)
    settlementType: v.string(), // 'cash' | 'stripe'
    players: v.array(v.object({
      id: v.string(),
      name: v.string(),
      userId: v.optional(v.string()),
      handicap: v.optional(v.number()),
    })),
    pairings: v.optional(v.array(v.array(v.string()))),
    date: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = new Date().toISOString();
    return ctx.db.insert("quickGames", {
      ...args,
      createdBy: identity.subject,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateScores = mutation({
  args: {
    gameId: v.id("quickGames"),
    scores: v.array(v.object({
      playerId: v.string(),
      gross: v.optional(v.number()),
      net: v.optional(v.number()),
      points: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { gameId, scores }) => {
    await assertCreator(ctx, gameId);
    await ctx.db.patch(gameId, { scores, updatedAt: new Date().toISOString() });
  },
});

export const complete = mutation({
  args: {
    gameId: v.id("quickGames"),
    scores: v.array(v.object({
      playerId: v.string(),
      gross: v.optional(v.number()),
      net: v.optional(v.number()),
      points: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { gameId, scores }) => {
    const game = await assertCreator(ctx, gameId);

    // Determine winner and settlement based on game type
    type Score = { playerId: string; gross?: number; net?: number; points?: number };

    let winnerIds: string[] = [];
    let summary = "";

    function getRelevantScore(s: Score): number {
      if (game.type === "stableford") return s.points ?? 0;
      if (game.type === "strokeplay") return -(s.gross ?? 999); // lower is better, negate for max
      return s.points ?? s.net ?? -(s.gross ?? 999);
    }

    const sortedScores = [...scores].sort((a, b) => getRelevantScore(b) - getRelevantScore(a));
    const topScore = getRelevantScore(sortedScores[0]);
    winnerIds = sortedScores.filter(s => getRelevantScore(s) === topScore).map(s => s.playerId);

    const winner = game.players.find(p => p.id === winnerIds[0]);
    const winnerName = winner?.name ?? "Unknown";

    if (game.type === "stableford") {
      const pts = scores.find(s => s.playerId === winnerIds[0])?.points ?? 0;
      summary = `${winnerName} wins with ${pts} stableford points`;
    } else if (game.type === "strokeplay") {
      const strokes = scores.find(s => s.playerId === winnerIds[0])?.gross ?? 0;
      summary = `${winnerName} wins with ${strokes} strokes`;
    } else {
      summary = `${winnerName} wins`;
    }

    // Calculate settlement (losers pay winners)
    const settlement: Array<{ fromName: string; toName: string; amount: number }> = [];
    if (game.stakePerPlayer > 0) {
      const losers = game.players.filter(p => !winnerIds.includes(p.id));
      const winners = game.players.filter(p => winnerIds.includes(p.id));
      const totalPot = game.stakePerPlayer * game.players.length;
      const perWinner = Math.floor(totalPot / winners.length);

      for (const loser of losers) {
        for (const winner of winners) {
          settlement.push({
            fromName: loser.name,
            toName: winner.name,
            amount: Math.floor(game.stakePerPlayer * losers.length / winners.length),
          });
        }
      }

      if (settlement.length === 0 && winners.length > 0) {
        summary += ` · Pot: ${(totalPot / 100).toFixed(2)} ${game.currency}`;
      }
      void perWinner; // suppress unused warning
    }

    await ctx.db.patch(gameId, {
      scores,
      status: "complete",
      result: { winnerIds, settlement, summary },
      updatedAt: new Date().toISOString(),
    });
  },
});

export const deleteGame = mutation({
  args: { gameId: v.id("quickGames") },
  handler: async (ctx, { gameId }) => {
    await assertCreator(ctx, gameId);
    await ctx.db.delete(gameId);
  },
});
