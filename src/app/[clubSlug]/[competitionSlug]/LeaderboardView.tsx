"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useClubCtx } from "@/app/providers/club-context-provider";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";

interface Props {
  clubSlug: string;
  competitionSlug: string;
}

export function LeaderboardView({ clubSlug, competitionSlug }: Props) {
  const { club } = useClubCtx();
  const { user } = useUser();
  const { openSignIn } = useClerk();

  const competition = useQuery(
    api.competitions.getBySlug,
    club ? { clubId: club._id, slug: competitionSlug } : "skip"
  );
  const entries = useQuery(
    api.entries.listByCompetition,
    competition ? { competitionId: competition._id } : "skip"
  );
  const players = useQuery(
    api.players.listByCompetition,
    competition ? { competitionId: competition._id } : "skip"
  );
  const myEntries = useQuery(
    api.entries.listByCompetitionAndUser,
    competition && user ? { competitionId: competition._id, userId: user.id } : "skip"
  );
  const membership = useQuery(
    api.clubMembers.getByClubAndUser,
    club && user ? { clubId: club._id, userId: user.id } : "skip"
  );

  const claimProvisionalMember = useMutation(api.clubMembers.claimProvisionalMember);
  const [joining, setJoining] = useState(false);
  const [joinResult, setJoinResult] = useState<{ matched: boolean; status: string; displayName: string } | null>(null);

  // Once membership goes active (auto-match), clear the join state
  useEffect(() => {
    if (membership?.status === "active") setJoinResult(null);
  }, [membership?.status]);

  async function handleJoin() {
    if (!user) { openSignIn(); return; }
    if (!club) return;
    setJoining(true);
    try {
      const displayName = user.fullName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? "Member";
      const res = await claimProvisionalMember({ clubId: club._id, displayName });
      setJoinResult(res as { matched: boolean; status: string; displayName: string });
    } finally {
      setJoining(false);
    }
  }

  if (!club || !competition || !entries || !players || myEntries === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isImported = competition.drawType === "import";
  const isPickFormat = competition.drawType === "pick";
  const isMember = membership?.status === "active";

  // ── Club competition (FGC import) ──────────────────────────────────────────
  if (isImported) {
    const sorted = [...entries].sort(
      (a, b) => (a.leaderboardPosition ?? 999) - (b.leaderboardPosition ?? 999)
    );

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-green-900 text-white px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-green-400 mb-0.5">⛳ {club.name}</div>
              <h1 className="font-bold text-xl">{competition.name}</h1>
              <div className="text-green-300 text-sm mt-0.5">
                {new Date(competition.startDate).toLocaleDateString("en-GB", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </div>
            </div>
            <StatusBadge status={competition.status} />
          </div>
        </header>

        {/* Join CTA */}
        {!isMember && (
          <div className="bg-green-800 px-4 sm:px-6 py-3">
            {joinResult ? (
              joinResult.matched ? (
                <p className="text-green-200 text-sm text-center">
                  Welcome back, <strong className="text-white">{joinResult.displayName}</strong>! Your competition history is linked.
                </p>
              ) : (
                <p className="text-green-200 text-sm text-center">
                  Request sent — an admin will link your account shortly.
                </p>
              )
            ) : (
              <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
                <p className="text-green-200 text-sm">
                  {user ? `Join ${club.name} to track your stats and history.` : `Sign in to join ${club.name} and view your history.`}
                </p>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="shrink-0 bg-white text-green-900 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-60"
                >
                  {joining ? "Joining…" : user ? `Join ${club.name}` : "Sign in"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="px-4 sm:px-6 py-6">
          {sorted.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 w-10">Pos</th>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((entry, i) => {
                    const isMe = entry.userId === user?.id;
                    const pos = entry.leaderboardPosition ?? i + 1;
                    return (
                      <tr
                        key={entry._id}
                        className={`border-b border-gray-50 last:border-0 ${isMe ? "bg-green-50" : ""}`}
                      >
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : pos}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">{entry.displayName}</span>
                          {isMe && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">You</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {entry.score ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">🏌️</p>
              <p>No results yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Pool / sweep / standard competition ────────────────────────────────────
  const paidEntries = entries.filter(e => e.paidAt);
  const unpaidEntries = entries.filter(e => !e.paidAt);
  const pot = paidEntries.length * competition.entryFee;
  const playerMap = new Map<Id<"players">, Doc<"players">>(players.map(p => [p._id, p]));
  const sortedEntries = [...paidEntries].sort((a, b) =>
    (a.leaderboardPosition ?? 999) - (b.leaderboardPosition ?? 999)
  );
  const isCash = competition.paymentCollection === "cash";
  const myPaidEntries = (myEntries ?? []).filter(e => e.paidAt);
  const myUnpaidEntry = (myEntries ?? []).find(e => !e.paidAt);

  const positionCounts = new Map<number, number>();
  for (const e of paidEntries) {
    if (e.leaderboardPosition) {
      positionCounts.set(e.leaderboardPosition, (positionCounts.get(e.leaderboardPosition) ?? 0) + 1);
    }
  }

  const prizeAmounts = competition.prizeStructure.map(p => ({
    position: p.position,
    total: Math.floor(pot * p.percentage / 100),
    perPerson: Math.floor(pot * p.percentage / 100 / Math.max(1, positionCounts.get(p.position) ?? 1)),
    count: positionCounts.get(p.position) ?? 0,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-900 text-white px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-green-400 mb-0.5">⛳ {club.name}</div>
            <h1 className="font-bold text-xl">{competition.name}</h1>
            <div className="text-green-300 text-sm mt-0.5">
              {new Date(competition.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
              {" – "}
              {new Date(competition.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <StatusBadge status={competition.status} />
        </div>
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total pot</div>
              <div className="text-3xl font-bold text-green-800 mt-0.5">
                {formatCurrency(pot, competition.currency)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {paidEntries.length} paid
                {unpaidEntries.length > 0 && ` · ${unpaidEntries.length} awaiting payment`}
              </div>
            </div>
            {competition.status === "open" && !myUnpaidEntry && myPaidEntries.length === 0 && (
              <Link
                href={`/${clubSlug}/${competitionSlug}/enter`}
                className="px-5 py-2.5 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-600 transition-colors"
              >
                {isCash ? "Register" : "Enter pool"}
              </Link>
            )}
            {myUnpaidEntry && isCash && (
              <div className="text-right">
                <span className="inline-block px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-lg">
                  Awaiting payment
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {prizeAmounts.map(p => (
              <div key={p.position} className="flex-1 text-center bg-gray-50 rounded-lg py-2">
                <div className="text-xs text-gray-500">{ordinal(p.position)} place</div>
                <div className="font-semibold text-gray-900 text-sm mt-0.5">
                  {formatCurrency(p.total, competition.currency)}
                </div>
                {p.count > 1 && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    {formatCurrency(p.perPerson, competition.currency)} each ({p.count} way)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {myPaidEntries.length > 0 && (
          <div className="space-y-3">
            {myPaidEntries.map((myEntry, teamIdx) => (
              <div key={myEntry._id} className="bg-green-50 border border-green-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-green-700 font-medium uppercase tracking-wide">
                    {isPickFormat && myPaidEntries.length > 1 ? `Your team ${teamIdx + 1}` : "Your entry"}
                  </div>
                  {isPickFormat && myEntry.totalPrizeMoney !== undefined && (
                    <div className="text-sm font-bold text-green-800">
                      ${(myEntry.totalPrizeMoney / 100).toLocaleString("en-US")} total
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(myEntry.drawnPlayerIds ?? []).map(pid => {
                    const player = playerMap.get(pid);
                    if (!player) return null;
                    const isReserve = myEntry.reservePlayerIds?.includes(pid);
                    return (
                      <div key={pid} className="bg-white rounded-lg p-3 text-center border border-green-100">
                        {isPickFormat ? (
                          <div className="text-xs font-medium mb-1 text-gray-400">#{player.worldRanking}</div>
                        ) : (
                          <div className={`text-xs font-medium mb-1 ${
                            player.tier === 1 ? "text-amber-600" :
                            player.tier === 2 ? "text-blue-600" : "text-gray-500"
                          }`}>Tier {player.tier}</div>
                        )}
                        <div className="font-semibold text-gray-900 text-sm leading-tight">{player.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{player.country}</div>
                        {isReserve && <div className="text-xs text-amber-600 font-medium mt-0.5">Reserve</div>}
                        {isPickFormat && player.prizeMoney !== undefined && (
                          <div className="text-xs font-bold text-green-700 mt-1">
                            ${(player.prizeMoney / 100).toLocaleString("en-US")}
                          </div>
                        )}
                        {!isPickFormat && player.scoreToPar !== undefined && (
                          <div className={`text-sm font-bold mt-1 ${player.scoreToPar < 0 ? "text-green-700" : player.scoreToPar > 0 ? "text-red-600" : "text-gray-700"}`}>
                            {scoreLabel(player.scoreToPar)}
                          </div>
                        )}
                        {!isPickFormat && player.position && (
                          <div className="text-xs text-gray-500">T{player.position}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {myEntry.leaderboardPosition && (
                  <div className="mt-3 text-center text-sm text-green-800 font-medium">
                    Currently {ordinal(myEntry.leaderboardPosition)} in the pool
                  </div>
                )}
              </div>
            ))}
            {isPickFormat && competition.status === "open" && (
              <Link
                href={`/${clubSlug}/${competitionSlug}/enter`}
                className="block text-center text-sm font-medium text-green-700 hover:underline"
              >
                + Add another team ({formatCurrency(competition.entryFee, competition.currency)})
              </Link>
            )}
          </div>
        )}

        {sortedEntries.length > 0 ? (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Pool leaderboard</h2>
            <div className="space-y-2">
              {sortedEntries.map((entry, i) => {
                const isMe = entry.userId === user?.id;
                const entryPlayers = (entry.drawnPlayerIds ?? []).map(pid => playerMap.get(pid)).filter(Boolean);
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
                        {entryPlayers.length > 0 && (
                          <div className="text-xs text-gray-400 mt-0.5 truncate">
                            {entryPlayers.map(p => p!.name).join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {isPickFormat ? (
                          entry.totalPrizeMoney !== undefined ? (
                            <div className="font-bold text-base text-green-700">
                              ${(entry.totalPrizeMoney / 100).toLocaleString("en-US")}
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm">picks in</div>
                          )
                        ) : entry.bestPlayerScore !== undefined ? (
                          <div className={`font-bold text-base ${entry.bestPlayerScore < 0 ? "text-green-700" : entry.bestPlayerScore > 0 ? "text-red-600" : "text-gray-700"}`}>
                            {scoreLabel(entry.bestPlayerScore)}
                          </div>
                        ) : (
                          <div className="text-gray-400 text-sm">—</div>
                        )}
                        {i < 3 && prizeAmounts[i] && (
                          <div className="text-xs text-gray-400">
                            {formatCurrency(prizeAmounts[i].perPerson, competition.currency)}
                            {prizeAmounts[i].count > 1 && " ea"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : competition.status === "open" ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🏌️</p>
            <p>No entries yet — be the first!</p>
            <Link href={`/${clubSlug}/${competitionSlug}/enter`} className="mt-3 inline-block text-green-700 font-medium hover:underline">
              Enter now →
            </Link>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p>{isPickFormat ? "No entries yet. Be the first to pick your team!" : "Draw hasn't happened yet. Check back soon."}</p>
          </div>
        )}

        {isCash && unpaidEntries.length > 0 && competition.status === "open" && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Awaiting payment ({unpaidEntries.length})</h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {unpaidEntries.map(e => (
                <div key={e._id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-700">{e.displayName}</span>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Unconfirmed</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Pay {formatCurrency(competition.entryFee, competition.currency)} cash to the organiser to be included in the draw.</p>
          </section>
        )}

        {!isPickFormat && players.some(p => p.scoreToPar !== undefined) && (
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
                  {[...players]
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
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-gray-700 text-gray-200" },
    open: { label: "Open", cls: "bg-blue-700 text-blue-100" },
    live: { label: "Live ●", cls: "bg-green-700 text-green-100" },
    complete: { label: "Complete", cls: "bg-purple-700 text-purple-100" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-700 text-gray-200" };
  return <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function scoreLabel(score: number) {
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
