"use client";

import { useState, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Trophy, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type Entrant = { _id: Id<"knockoutEntrants">; displayName: string; userId?: string; seed?: number; eliminated?: boolean; eliminatedRound?: number };
type Match = {
  _id: Id<"knockoutMatches">;
  round: number;
  matchNumber: number;
  playerAId?: Id<"knockoutEntrants">;
  playerBId?: Id<"knockoutEntrants">;
  winnerId?: Id<"knockoutEntrants">;
  scoreA?: string;
  scoreB?: string;
  completedAt?: string;
};

function MatchCard({
  match,
  entrants,
  isAdmin,
  round,
  totalRounds,
  onResult,
}: {
  match: Match;
  entrants: Map<string, Entrant>;
  isAdmin: boolean;
  round: number;
  totalRounds: number;
  onResult: (matchId: Id<"knockoutMatches">, winnerId: Id<"knockoutEntrants">, scoreA: string, scoreB: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");

  const playerA = match.playerAId ? entrants.get(match.playerAId) : undefined;
  const playerB = match.playerBId ? entrants.get(match.playerBId) : undefined;
  const winner = match.winnerId ? entrants.get(match.winnerId) : undefined;
  const isFinal = round === totalRounds;

  if (!playerA && !playerB) return null;
  const isBye = !playerA || !playerB;

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${match.winnerId ? "border-gray-200" : "border-green-200"}`}>
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {isFinal ? "Final" : `Match ${match.matchNumber}`}
        </span>
        {match.winnerId && (
          <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
            <CheckCircle2 size={12} /> Complete
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        {[
          { player: playerA, playerId: match.playerAId, score: match.scoreA, isWinner: match.winnerId === match.playerAId },
          { player: playerB, playerId: match.playerBId, score: match.scoreB, isWinner: match.winnerId === match.playerBId },
        ].map(({ player, playerId, score, isWinner }, idx) => (
          <div key={idx} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${isWinner ? "bg-green-50" : ""}`}>
            <div className="flex items-center gap-2 min-w-0">
              {isWinner && <Trophy size={13} className="text-amber-500 shrink-0" />}
              <span className={`text-sm font-medium truncate ${!player ? "text-gray-300 italic" : isWinner ? "text-green-800" : "text-gray-900"}`}>
                {player?.displayName ?? "Bye"}
              </span>
              {player?.seed && <span className="text-xs text-gray-400">(#{player.seed})</span>}
            </div>
            {score && <span className="text-xs text-gray-500 shrink-0">{score}</span>}
          </div>
        ))}
      </div>

      {/* Record result */}
      {isAdmin && !match.winnerId && !isBye && (
        <div className="px-4 pb-3">
          {!recording ? (
            <button
              onClick={() => setRecording(true)}
              className="w-full py-2 border border-green-300 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-50 transition-colors"
            >
              Record result
            </button>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1 truncate">{playerA?.displayName}</p>
                  <input
                    type="text"
                    value={scoreA}
                    onChange={e => setScoreA(e.target.value)}
                    placeholder="e.g. 2&1"
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1 truncate">{playerB?.displayName}</p>
                  <input
                    type="text"
                    value={scoreB}
                    onChange={e => setScoreB(e.target.value)}
                    placeholder="e.g. lost"
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 text-center">Who won?</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { player: playerA, id: match.playerAId },
                  { player: playerB, id: match.playerBId },
                ].map(({ player, id }) => id && (
                  <button
                    key={id}
                    onClick={() => { onResult(match._id, id, scoreA, scoreB); setRecording(false); }}
                    className="py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition-colors truncate px-2"
                  >
                    {player?.displayName ?? ""}
                  </button>
                ))}
              </div>
              <button onClick={() => setRecording(false)} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KnockoutDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const { user } = useUser();
  const router = useRouter();

  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const isAdmin = activeMembership?.role === "admin";

  const tournament = useQuery(api.knockouts.get, { tournamentId: tournamentId as Id<"knockoutTournaments"> });
  const entrantList = useQuery(api.knockouts.getEntrants, { tournamentId: tournamentId as Id<"knockoutTournaments"> }) as Entrant[] | undefined;
  const matchList = useQuery(api.knockouts.getMatches, { tournamentId: tournamentId as Id<"knockoutTournaments"> }) as Match[] | undefined;
  const recordResult = useMutation(api.knockouts.recordResult);

  const entrantMap = new Map((entrantList ?? []).map(e => [e._id as string, e]));

  async function handleResult(matchId: Id<"knockoutMatches">, winnerId: Id<"knockoutEntrants">, scoreA: string, scoreB: string) {
    await recordResult({ matchId, winnerId, scoreA: scoreA || undefined, scoreB: scoreB || undefined });
  }

  if (!tournament || !entrantList || !matchList) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Group matches by round
  const rounds: Record<number, Match[]> = {};
  for (const m of matchList) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
    rounds[m.round].sort((a, b) => a.matchNumber - b.matchNumber);
  }

  const champion = tournament.status === "complete"
    ? entrantList.find(e => !e.eliminated)
    : undefined;

  const roundLabels: Record<number, string> = {};
  for (let r = 1; r <= tournament.totalRounds; r++) {
    const remaining = tournament.totalRounds - r;
    if (remaining === 0) roundLabels[r] = "Final";
    else if (remaining === 1) roundLabels[r] = "Semi-finals";
    else if (remaining === 2) roundLabels[r] = "Quarter-finals";
    else roundLabels[r] = `Round ${r}`;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/manage/knockouts" className="text-gray-400 hover:text-gray-600 mt-0.5">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              tournament.status === "active" ? "bg-green-100 text-green-700" :
              tournament.status === "complete" ? "bg-purple-100 text-purple-700" :
              "bg-gray-100 text-gray-500"
            }`}>
              {tournament.status === "active" ? `Round ${tournament.currentRound} of ${tournament.totalRounds}` : tournament.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {entrantList.length} players · single elimination
          </p>
        </div>
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 text-center">
          <p className="text-amber-600 text-sm font-medium uppercase tracking-wider mb-1">Champion</p>
          <p className="text-3xl font-bold text-amber-800">🏆 {champion.displayName}</p>
        </div>
      )}

      {/* Rounds */}
      {Object.entries(rounds)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([round, matches]) => (
          <section key={round}>
            <h2 className="text-base font-semibold text-gray-900 mb-3">{roundLabels[Number(round)]}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {matches.map(match => (
                <MatchCard
                  key={match._id}
                  match={match}
                  entrants={entrantMap}
                  isAdmin={!!isAdmin}
                  round={Number(round)}
                  totalRounds={tournament.totalRounds}
                  onResult={handleResult}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
