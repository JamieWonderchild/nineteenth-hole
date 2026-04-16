"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { use } from "react";

function scoreLabel(score: number) {
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    live: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-400",
    complete: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function PoolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useUser();

  const pool = useQuery(api.competitions.getByPlatformSlug, { slug });
  const entries = useQuery(
    api.entries.listByCompetition,
    pool ? { competitionId: pool._id } : "skip"
  );
  const players = useQuery(
    api.players.listByCompetition,
    pool ? { competitionId: pool._id } : "skip"
  );
  const myEntry = useQuery(
    api.entries.getByCompetitionAndUser,
    pool && user ? { competitionId: pool._id, userId: user.id } : "skip"
  );

  if (pool === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (pool === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">⛳</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Pool not found</h1>
          <p className="text-gray-500 text-sm">This pool doesn&apos;t exist or may have moved.</p>
        </div>
      </div>
    );
  }

  const paidEntries = (entries ?? []).filter(e => e.paidAt);
  const pot = paidEntries.length * pool.entryFee;
  const playerMap = new Map<Id<"players">, Doc<"players">>((players ?? []).map(p => [p._id, p]));
  const sortedEntries = [...paidEntries].sort((a, b) =>
    (a.leaderboardPosition ?? 999) - (b.leaderboardPosition ?? 999)
  );

  const prizeAmounts = pool.prizeStructure.map(p => ({
    position: p.position,
    amount: Math.floor(pot * p.percentage / 100),
  }));

  const totalWithFee = pool.entryFee + Math.round(pool.entryFee * 0.1);

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link href="/pools" className="text-sm text-gray-500 hover:text-gray-700 mb-3 block">← Tour Pools</Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{pool.name}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {new Date(pool.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              {" – "}
              {new Date(pool.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              {pool.description && ` · ${pool.description}`}
            </p>
          </div>
          <StatusPill status={pool.status} />
        </div>
      </div>

        {/* Pot + entry CTA */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total pot</div>
              <div className="text-3xl font-bold text-green-800 mt-0.5">
                {formatCurrency(pot, pool.currency)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{paidEntries.length} paid {paidEntries.length === 1 ? "entry" : "entries"}</div>
            </div>
            {pool.status === "open" && !myEntry?.paidAt && (
              <Link
                href={`/pools/${slug}/enter`}
                className="px-5 py-2.5 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors"
              >
                Enter {formatCurrency(totalWithFee, pool.currency)}
              </Link>
            )}
            {myEntry?.paidAt && (
              <span className="px-4 py-2 bg-green-100 text-green-800 text-sm font-medium rounded-lg">
                ✓ Entered
              </span>
            )}
          </div>
          {prizeAmounts.length > 0 && (
            <div className="flex gap-3">
              {prizeAmounts.map(p => (
                <div key={p.position} className="flex-1 text-center bg-gray-50 rounded-lg py-2">
                  <div className="text-xs text-gray-500">{ordinal(p.position)} place</div>
                  <div className="font-semibold text-gray-900 text-sm mt-0.5">
                    {formatCurrency(p.amount, pool.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entry deadline */}
        {pool.status === "open" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm">
            <span className="font-medium text-amber-800">Entries close: </span>
            <span className="text-amber-700">
              {new Date(pool.entryDeadline).toLocaleDateString("en-GB", {
                weekday: "long", day: "numeric", month: "long",
                hour: "2-digit", minute: "2-digit"
              })}
            </span>
          </div>
        )}

        {/* My entry */}
        {myEntry?.paidAt && myEntry.drawnPlayerIds && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="text-xs text-green-700 font-semibold uppercase tracking-wide mb-3">
              {pool.drawType === "pick" ? "Your picks" : "Your drawn players"}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {myEntry.drawnPlayerIds.map(pid => {
                const player = playerMap.get(pid);
                if (!player) return null;
                return (
                  <div key={pid} className="bg-white rounded-lg p-3 text-center border border-green-100">
                    {pool.drawType !== "pick" && (
                      <div className={`text-xs font-medium mb-1 ${
                        player.tier === 1 ? "text-amber-600" :
                        player.tier === 2 ? "text-blue-600" : "text-gray-500"
                      }`}>
                        Tier {player.tier}
                      </div>
                    )}
                    <div className="font-semibold text-gray-900 text-sm leading-tight">{player.name}</div>
                    <div className="text-xs text-gray-400">{player.country}</div>
                    {pool.drawType === "pick" ? (
                      player.prizeMoney !== undefined ? (
                        <div className={`text-xs font-semibold mt-1 ${player.prizeMoney > 0 ? "text-green-700" : "text-red-500"}`}>
                          {player.prizeMoney > 0 ? `$${(player.prizeMoney / 100).toLocaleString("en-US")}` : "MC"}
                        </div>
                      ) : null
                    ) : (
                      <>
                        {player.scoreToPar !== undefined && (
                          <div className={`text-sm font-bold mt-1 ${player.scoreToPar < 0 ? "text-green-700" : player.scoreToPar > 0 ? "text-red-600" : "text-gray-700"}`}>
                            {scoreLabel(player.scoreToPar)}
                          </div>
                        )}
                        {player.position && (
                          <div className="text-xs text-gray-500">T{player.position}</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {myEntry.leaderboardPosition && (
              <div className="mt-3 text-center text-sm text-green-800 font-medium">
                {pool.status === "complete"
                  ? `You finished ${ordinal(myEntry.leaderboardPosition)}`
                  : `You're currently ${ordinal(myEntry.leaderboardPosition)} in the pool`}
              </div>
            )}
          </div>
        )}

        {/* Pool leaderboard */}
        {sortedEntries.length > 0 ? (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Pool leaderboard</h2>
            <div className="space-y-2">
              {sortedEntries.map((entry, i) => {
                const isMe = entry.userId === user?.id;
                const myPlayers = (entry.drawnPlayerIds ?? []).map(pid => playerMap.get(pid)).filter(Boolean);
                return (
                  <div
                    key={entry._id}
                    className={`bg-white border rounded-xl px-4 py-3 ${isMe ? "border-green-400 ring-1 ring-green-200" : "border-gray-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-lg font-bold w-8 text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-gray-500" : i === 2 ? "text-amber-700" : "text-gray-400"}`}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{entry.displayName}</span>
                          {isMe && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">You</span>}
                        </div>
                        {myPlayers.length > 0 && (
                          <div className="text-xs text-gray-400 mt-0.5 truncate">
                            {myPlayers.map(p => p!.name).join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {pool.drawType === "pick" && entry.totalPrizeMoney !== undefined ? (
                          <div className="font-bold text-sm text-green-700">
                            ${(entry.totalPrizeMoney / 100).toLocaleString("en-US")}
                          </div>
                        ) : entry.bestPlayerScore !== undefined ? (
                          <div className={`font-bold text-base ${entry.bestPlayerScore < 0 ? "text-green-700" : entry.bestPlayerScore > 0 ? "text-red-600" : "text-gray-700"}`}>
                            {scoreLabel(entry.bestPlayerScore)}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-sm">—</div>
                        )}
                        {i < 3 && prizeAmounts[i] && (
                          <div className="text-xs text-gray-400">
                            {formatCurrency(prizeAmounts[i].amount, pool.currency)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : pool.status === "open" ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
            <p className="text-4xl mb-3">🏌️</p>
            <p className="mb-3">No entries yet — be the first!</p>
            <Link href={`/pools/${slug}/enter`} className="text-green-700 font-medium hover:underline">
              Enter now →
            </Link>
          </div>
        ) : null}

        {/* Tournament leaderboard — pick format shows prize money */}
        {pool.drawType === "pick" && (players ?? []).some(p => p.prizeMoney !== undefined) ? (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Tournament prize money</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3 text-right">Prize money</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(players ?? [])]
                    .sort((a, b) => (b.prizeMoney ?? 0) - (a.prizeMoney ?? 0))
                    .map(player => (
                      <tr key={player._id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">{player.name}</div>
                          {player.madeCut === false && (
                            <div className="text-xs text-red-500">Missed cut</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          {(player.prizeMoney ?? 0) > 0
                            ? <span className="text-gray-900">${((player.prizeMoney ?? 0) / 100).toLocaleString("en-US")}</span>
                            : <span className="text-red-500 text-xs font-medium">MC</span>
                          }
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (players ?? []).some(p => p.scoreToPar !== undefined) ? (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Tournament leaderboard</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Pos</th>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3 text-center">T</th>
                    <th className="px-4 py-3 text-center hidden sm:table-cell">R1</th>
                    <th className="px-4 py-3 text-center hidden sm:table-cell">R2</th>
                    <th className="px-4 py-3 text-center hidden sm:table-cell">R3</th>
                    <th className="px-4 py-3 text-center hidden sm:table-cell">R4</th>
                    <th className="px-4 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(players ?? [])]
                    .filter(p => !p.withdrawn)
                    .sort((a, b) => (a.scoreToPar ?? 99) - (b.scoreToPar ?? 99))
                    .map(player => (
                      <tr key={player._id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{player.position ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">{player.name}</div>
                          <div className="text-xs text-gray-400">{player.country}</div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            player.tier === 1 ? "bg-amber-100 text-amber-700" :
                            player.tier === 2 ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>{player.tier}</span>
                        </td>
                        {(["r1", "r2", "r3", "r4"] as const).map(r => (
                          <td key={r} className="px-4 py-2.5 text-center text-gray-600 hidden sm:table-cell">
                            {player[r] ?? "—"}
                          </td>
                        ))}
                        <td className={`px-4 py-2.5 text-right font-semibold ${
                          (player.scoreToPar ?? 0) < 0 ? "text-green-700" :
                          (player.scoreToPar ?? 0) > 0 ? "text-red-600" : "text-gray-700"
                        }`}>
                          {player.scoreToPar !== undefined ? scoreLabel(player.scoreToPar) : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
    </div>
  );
}
