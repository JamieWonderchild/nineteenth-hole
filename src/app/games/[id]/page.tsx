"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trophy, CheckCircle } from "lucide-react";
import { use } from "react";

function scoreLabel(type: string) {
  if (type === "stableford") return "Points";
  if (type === "strokeplay") return "Strokes";
  if (type === "betterball") return "Best ball";
  return "Score";
}

function scoreHint(type: string) {
  if (type === "stableford") return "Higher is better";
  if (type === "strokeplay") return "Lower is better";
  return "";
}

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useUser();

  const game = useQuery(api.quickGames.get, { gameId: id as never });
  const completeGame = useMutation(api.quickGames.complete);

  const [scores, setScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"info" | "score">("info");

  if (game === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center py-16">
        <p className="text-xl font-semibold">Game not found</p>
        <button onClick={() => router.push("/games")} className="text-green-700 hover:underline mt-2 block mx-auto">
          ← Back to games
        </button>
      </div>
    );
  }

  const sym = game.currency === "GBP" ? "£" : game.currency === "EUR" ? "€" : "$";
  const isCreator = game.createdBy === user?.id;
  const totalPot = game.stakePerPlayer * game.players.length;

  async function handleComplete() {
    if (!game) return;
    const scoreArr = game.players.map(p => {
      const rawScore = parseFloat(scores[p.id] ?? "0");
      const isStableford = game.type === "stableford";
      return {
        playerId: p.id,
        gross: isStableford ? undefined : rawScore || undefined,
        points: isStableford ? rawScore || undefined : undefined,
        net: p.handicap !== undefined && !isStableford ? (rawScore - p.handicap) || undefined : undefined,
      };
    });

    const hasScores = scoreArr.some(s => (s.gross ?? s.points ?? 0) > 0);
    if (!hasScores) {
      setError("Enter at least one score before completing");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await completeGame({ gameId: game._id, scores: scoreArr });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (game.status === "complete" && game.result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/games")}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{game.name}</h1>
            <p className="text-sm text-muted-foreground">
              {game.type.charAt(0).toUpperCase() + game.type.slice(1)}
              {" · "}
              {new Date(game.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Result banner */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <Trophy size={32} className="text-amber-500 mx-auto mb-2" />
          <p className="font-bold text-lg text-gray-900">{game.result.summary}</p>
          {totalPot > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Total pot: {sym}{(totalPot / 100).toFixed(0)}
            </p>
          )}
        </div>

        {/* Settlement */}
        {game.result.settlement.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              Settlement
            </h2>
            <div className="space-y-2.5">
              {game.result.settlement.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="text-sm">
                    <span className="font-medium text-red-600">{s.fromName}</span>
                    <span className="text-gray-500 mx-2">owes</span>
                    <span className="font-medium text-green-700">{s.toName}</span>
                  </div>
                  <span className="font-bold text-gray-900">
                    {sym}{(s.amount / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">Settle up at the bar 🍺</p>
          </div>
        )}

        {/* All scores */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">{scoreLabel(game.type)}</th>
                {game.players.some(p => p.handicap !== undefined) && (
                  <th className="px-4 py-3 text-right">HCP</th>
                )}
              </tr>
            </thead>
            <tbody>
              {[...(game.scores ?? [])].sort((a, b) => {
                const va = (a.points ?? -(a.gross ?? 0));
                const vb = (b.points ?? -(b.gross ?? 0));
                return vb - va;
              }).map((score, i) => {
                const player = game.players.find(p => p.id === score.playerId);
                const isWinner = game.result?.winnerIds.includes(score.playerId);
                return (
                  <tr key={score.playerId} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-500" : "text-gray-400"}`}>
                          {i === 0 ? "🥇" : i + 1}
                        </span>
                        <span className={`font-medium ${isWinner ? "text-green-700" : "text-gray-900"}`}>
                          {player?.name ?? "Unknown"}
                        </span>
                        {isWinner && totalPot > 0 && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                            +{sym}{(totalPot / 100 / (game.result?.winnerIds.length ?? 1)).toFixed(0)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                      {score.points ?? score.gross ?? "—"}
                      {game.type === "stableford" && score.points !== undefined && " pts"}
                    </td>
                    {game.players.some(p => p.handicap !== undefined) && (
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {player?.handicap ?? "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Active game — show info or score entry
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/games")}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{game.name}</h1>
          <p className="text-sm text-muted-foreground">
            {game.type.charAt(0).toUpperCase() + game.type.slice(1)}
            {" · "}
            {new Date(game.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Game info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Format</div>
            <div className="font-medium text-gray-900 capitalize">{game.type}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Players</div>
            <div className="font-medium text-gray-900">{game.players.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Stake</div>
            <div className="font-medium text-gray-900">
              {game.stakePerPlayer > 0 ? `${sym}${(game.stakePerPlayer / 100).toFixed(0)}/player` : "For fun"}
            </div>
          </div>
          {totalPot > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Pot</div>
              <div className="font-bold text-green-800">{sym}{(totalPot / 100).toFixed(0)}</div>
            </div>
          )}
        </div>

        {game.players.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Players</div>
            <div className="flex flex-wrap gap-2">
              {game.players.map(p => (
                <span key={p.id} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {p.name}
                  {p.handicap !== undefined && <span className="text-gray-400 ml-1">({p.handicap})</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {game.notes && (
          <div className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            {game.notes}
          </div>
        )}
      </div>

      {/* Score entry — only show if creator */}
      {isCreator && view === "info" && (
        <Button
          onClick={() => setView("score")}
          className="w-full"
          size="lg"
        >
          Enter scores & complete
        </Button>
      )}

      {isCreator && view === "score" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Enter scores</h2>
            <p className="text-sm text-muted-foreground">{scoreHint(game.type)}</p>
          </div>

          {game.players.map(player => (
            <div key={player.id} className="flex items-center gap-3">
              <span className="flex-1 font-medium text-gray-900">{player.name}</span>
              <div className="relative w-28">
                <Input
                  type="number"
                  min="0"
                  value={scores[player.id] ?? ""}
                  onChange={e => setScores(prev => ({ ...prev, [player.id]: e.target.value }))}
                  placeholder={scoreLabel(game.type)}
                  className="text-right pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {game.type === "stableford" ? "pts" : "grs"}
                </span>
              </div>
            </div>
          ))}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setView("info")}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Saving…" : "Complete game"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
