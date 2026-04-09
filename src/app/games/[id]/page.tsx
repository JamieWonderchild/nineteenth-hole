"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trophy, CheckCircle } from "lucide-react";
import { use } from "react";

// ── Scoring helpers ──────────────────────────────────────────────────────────

function shotsOnHole(handicap: number, strokeIndex: number): number {
  const h = Math.round(handicap);
  return Math.floor(h / 18) + (strokeIndex <= h % 18 ? 1 : 0);
}

function stablefordPoints(par: number, handicap: number, strokeIndex: number, gross: number): number {
  return Math.max(0, 2 + par + shotsOnHole(handicap, strokeIndex) - gross);
}

function scoreLabel(type: string) {
  if (type === "stableford") return "Points";
  if (type === "strokeplay") return "Strokes";
  return "Score";
}

function scoreHint(type: string) {
  if (type === "stableford") return "Higher is better";
  if (type === "strokeplay") return "Lower is better";
  return "";
}

// ── Per-hole scorecard ───────────────────────────────────────────────────────

type CourseHole = { number: number; par: number; strokeIndex: number; yards?: number };
type Player = { id: string; name: string; handicap?: number };

function PerHoleScorecard({
  game,
  course,
  onComplete,
}: {
  game: { type: string; players: Player[] };
  course: { holes: CourseHole[] } | null;
  onComplete: (scores: Array<{
    playerId: string;
    gross?: number;
    net?: number;
    points?: number;
    holeScores?: Array<{ hole: number; gross: number }>;
  }>) => void;
}) {
  // holeInputs[playerId][holeNumber] = gross string
  const [holeInputs, setHoleInputs] = useState<Record<string, Record<number, string>>>({});
  const [error, setError] = useState("");

  const holes: CourseHole[] = course?.holes ?? Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: 4,
    strokeIndex: i + 1,
  }));

  function setInput(playerId: string, holeNumber: number, value: string) {
    setHoleInputs(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [holeNumber]: value },
    }));
  }

  // Live totals per player
  const totals = useMemo(() => {
    return game.players.map(p => {
      let totalGross = 0;
      let totalPoints = 0;
      let holesPlayed = 0;

      for (const hole of holes) {
        const raw = holeInputs[p.id]?.[hole.number];
        const gross = raw ? parseInt(raw) : 0;
        if (gross > 0) {
          totalGross += gross;
          holesPlayed++;
          if (game.type === "stableford" && p.handicap !== undefined) {
            totalPoints += stablefordPoints(hole.par, p.handicap, hole.strokeIndex, gross);
          }
        }
      }

      const totalNet = game.type === "strokeplay" && p.handicap !== undefined && holesPlayed === 18
        ? totalGross - Math.round(p.handicap)
        : undefined;

      return { playerId: p.id, totalGross, totalPoints, totalNet, holesPlayed };
    });
  }, [holeInputs, game.players, game.type, holes]);

  function handleComplete() {
    const scores = game.players.map(p => {
      const playerHoles = holes.map(h => ({
        hole: h.number,
        gross: parseInt(holeInputs[p.id]?.[h.number] ?? "0") || 0,
      })).filter(h => h.gross > 0);

      const t = totals.find(t => t.playerId === p.id)!;
      return {
        playerId: p.id,
        gross: t.totalGross || undefined,
        points: game.type === "stableford" && p.handicap !== undefined ? t.totalPoints || undefined : undefined,
        net: t.totalNet,
        holeScores: playerHoles.length > 0 ? playerHoles : undefined,
      };
    });

    const hasAnyScore = scores.some(s => (s.gross ?? 0) > 0);
    if (!hasAnyScore) {
      setError("Enter at least one score before completing");
      return;
    }

    setError("");
    onComplete(scores);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="text-sm min-w-full">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-3 py-2.5 text-left font-medium sticky left-0 bg-white z-10 w-12">Hole</th>
              {course && <th className="px-2 py-2.5 font-medium text-center w-10">Par</th>}
              {course && <th className="px-2 py-2.5 font-medium text-center w-10">SI</th>}
              {game.players.map(p => (
                <th key={p.id} className="px-2 py-2.5 font-medium text-center min-w-[5rem]">
                  <div className="truncate max-w-[5rem]">{p.name}</div>
                  {p.handicap !== undefined && (
                    <div className="text-[10px] text-muted-foreground font-normal">HCP {p.handicap}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holes.map(hole => (
              <tr key={hole.number} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className="px-3 py-1.5 font-medium text-gray-700 sticky left-0 bg-white">
                  {hole.number}
                </td>
                {course && (
                  <td className="px-2 py-1.5 text-center text-gray-500">{hole.par}</td>
                )}
                {course && (
                  <td className="px-2 py-1.5 text-center text-gray-400 text-xs">{hole.strokeIndex}</td>
                )}
                {game.players.map(p => {
                  const raw = holeInputs[p.id]?.[hole.number] ?? "";
                  const gross = raw ? parseInt(raw) : 0;
                  let pts: number | null = null;
                  if (game.type === "stableford" && p.handicap !== undefined && gross > 0) {
                    pts = stablefordPoints(hole.par, p.handicap, hole.strokeIndex, gross);
                  }
                  return (
                    <td key={p.id} className="px-1.5 py-1">
                      <div className="flex flex-col items-center gap-0.5">
                        <Input
                          type="number"
                          min="1"
                          max="12"
                          value={raw}
                          onChange={e => setInput(p.id, hole.number, e.target.value)}
                          className="w-14 text-center h-8 text-sm"
                        />
                        {pts !== null && (
                          <span className={`text-[10px] font-medium ${pts >= 3 ? "text-green-600" : pts === 2 ? "text-gray-500" : "text-red-400"}`}>
                            {pts}pt
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Totals row */}
            <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
              <td className="px-3 py-2.5 text-gray-700 sticky left-0 bg-gray-50">Total</td>
              {course && <td className="px-2 py-2.5 text-center text-gray-700">{holes.reduce((s, h) => s + h.par, 0)}</td>}
              {course && <td />}
              {game.players.map(p => {
                const t = totals.find(t => t.playerId === p.id)!;
                return (
                  <td key={p.id} className="px-2 py-2.5 text-center">
                    <div className="text-gray-900">{t.totalGross > 0 ? t.totalGross : "—"}</div>
                    {game.type === "stableford" && p.handicap !== undefined && t.totalGross > 0 && (
                      <div className="text-xs text-green-700 font-medium">{t.totalPoints}pts</div>
                    )}
                    {t.totalNet !== undefined && (
                      <div className="text-xs text-blue-600 font-medium">net {t.totalNet}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      <Button onClick={handleComplete} className="w-full" size="lg">
        Complete game
      </Button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useUser();

  const game = useQuery(api.quickGames.get, { gameId: id as never });
  const course = useQuery(
    api.courses.get,
    game?.courseId ? { courseId: game.courseId as never } : "skip"
  );
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
  const isPerHole = game.scoringMode === "per_hole";

  async function handleCompleteOverall() {
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

  async function handleCompletePerHole(scoreArr: Parameters<typeof completeGame>[0]["scores"]) {
    setLoading(true);
    setError("");
    try {
      await completeGame({ gameId: game!._id, scores: scoreArr });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (game.status === "complete" && game.result) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto px-4 py-6">
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

  // ── Active game ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/games")}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{game.name}</h1>
          <p className="text-sm text-muted-foreground">
            {game.type.charAt(0).toUpperCase() + game.type.slice(1)}
            {isPerHole && " · Per hole"}
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
        <>
          {isPerHole ? (
            /* Per-hole scorecard */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Per-hole scores</h2>
                <button
                  onClick={() => setView("info")}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center h-24">
                  <div className="animate-spin h-6 w-6 border-4 border-green-600 border-t-transparent rounded-full" />
                </div>
              ) : (
                <PerHoleScorecard
                  game={game}
                  course={course ?? null}
                  onComplete={handleCompletePerHole}
                />
              )}
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}
            </div>
          ) : (
            /* Overall score entry */
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
                  onClick={handleCompleteOverall}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Saving…" : "Complete game"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
