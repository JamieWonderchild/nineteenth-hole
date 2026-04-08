import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const ESPN_GOLF_URL = "https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga";

// Map our tournamentRef to ESPN event IDs (extend as needed)
const TOURNAMENT_ESPN_IDS: Record<string, string> = {
  "masters-2026": "401703500",
  "us-open-2026": "",
  "the-open-2026": "",
  "pga-championship-2026": "",
};

export const syncFromEspn = internalAction({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, { competitionId }) => {
    const competition = await ctx.runQuery(api.competitions.get, { competitionId });
    if (!competition || !competition.tournamentRef) return;

    const espnId = TOURNAMENT_ESPN_IDS[competition.tournamentRef];
    const url = espnId
      ? `https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga&event=${espnId}`
      : ESPN_GOLF_URL;

    let data: unknown;
    try {
      const res = await fetch(url);
      data = await res.json();
    } catch (e) {
      console.error("[ScoreSync] ESPN fetch failed:", e);
      return;
    }

    const players = await ctx.runQuery(api.players.listByCompetition, { competitionId });
    if (players.length === 0) return;

    // Parse ESPN response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = (data as any)?.events ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const competitors: any[] = events[0]?.competitions?.[0]?.competitors ?? [];

    const updates: Array<{
      playerId: Id<"players">;
      r1?: number; r2?: number; r3?: number; r4?: number;
      totalScore?: number; scoreToPar?: number; position?: number;
      madeCut?: boolean; withdrawn?: boolean;
    }> = [];
    for (const comp of competitors) {
      const espnName: string = comp.athlete?.displayName ?? "";
      const espnId: string = comp.athlete?.id ?? "";

      // Match by espnPlayerId first, fall back to name matching
      const player = players.find(p =>
        (p.espnPlayerId && p.espnPlayerId === espnId) ||
        p.name.toLowerCase() === espnName.toLowerCase()
      );
      if (!player) continue;

      const linescores = comp.linescores ?? [];
      const r1 = linescores[0]?.value;
      const r2 = linescores[1]?.value;
      const r3 = linescores[2]?.value;
      const r4 = linescores[3]?.value;

      const scoreToPar = comp.score?.value !== undefined ? Number(comp.score.value) : undefined;
      const positionStr: string = comp.status?.position?.displayName ?? "";
      const position = positionStr ? parseInt(positionStr.replace(/[^0-9]/g, ""), 10) || undefined : undefined;
      const madeCut: boolean = comp.status?.type?.name !== "STATUS_MISSED_CUT";
      const withdrawn: boolean = comp.status?.type?.name === "STATUS_WITHDRAWN";

      updates.push({
        playerId: player._id as Id<"players">,
        r1: r1 !== undefined ? Number(r1) : undefined,
        r2: r2 !== undefined ? Number(r2) : undefined,
        r3: r3 !== undefined ? Number(r3) : undefined,
        r4: r4 !== undefined ? Number(r4) : undefined,
        scoreToPar,
        position,
        madeCut,
        withdrawn,
      });
    }

    if (updates.length > 0) {
      await ctx.runMutation(api.players.bulkUpdateScores, { updates });
      await ctx.runMutation(api.entries.refreshLeaderboard, { competitionId });
    }

    console.log(`[ScoreSync] Updated ${updates.length} players for competition ${competitionId}`);
  },
});

// Called by cron — syncs all live competitions
export const syncAllLive = internalAction({
  args: {},
  handler: async (ctx) => {
    const liveComps = await ctx.runQuery(api.competitions.listLive);
    for (const comp of liveComps) {
      await ctx.runAction(internal.scores.syncFromEspn, { competitionId: comp._id });
    }
  },
});
