"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";

const MASTERS_2026_PLAYERS = [
  // Tier 1 — Top contenders
  { name: "Scottie Scheffler", tier: 1, worldRanking: 1, country: "USA" },
  { name: "Rory McIlroy", tier: 1, worldRanking: 2, country: "NIR" },
  { name: "Jon Rahm", tier: 1, worldRanking: 3, country: "ESP" },
  { name: "Xander Schauffele", tier: 1, worldRanking: 4, country: "USA" },
  { name: "Collin Morikawa", tier: 1, worldRanking: 5, country: "USA" },
  { name: "Bryson DeChambeau", tier: 1, worldRanking: 6, country: "USA" },
  { name: "Ludvig Aberg", tier: 1, worldRanking: 7, country: "SWE" },
  { name: "Viktor Hovland", tier: 1, worldRanking: 8, country: "NOR" },
  { name: "Tommy Fleetwood", tier: 1, worldRanking: 9, country: "ENG" },
  { name: "Patrick Cantlay", tier: 1, worldRanking: 10, country: "USA" },
  // Tier 2 — Mid-field
  { name: "Brooks Koepka", tier: 2, worldRanking: 11, country: "USA" },
  { name: "Shane Lowry", tier: 2, worldRanking: 12, country: "IRL" },
  { name: "Justin Thomas", tier: 2, worldRanking: 13, country: "USA" },
  { name: "Tony Finau", tier: 2, worldRanking: 14, country: "USA" },
  { name: "Hideki Matsuyama", tier: 2, worldRanking: 15, country: "JPN" },
  { name: "Cameron Smith", tier: 2, worldRanking: 16, country: "AUS" },
  { name: "Jason Day", tier: 2, worldRanking: 17, country: "AUS" },
  { name: "Tyrrell Hatton", tier: 2, worldRanking: 18, country: "ENG" },
  { name: "Max Homa", tier: 2, worldRanking: 19, country: "USA" },
  { name: "Sepp Straka", tier: 2, worldRanking: 20, country: "AUT" },
  // Tier 3 — Long shots
  { name: "Sergio Garcia", tier: 3, worldRanking: 25, country: "ESP" },
  { name: "Phil Mickelson", tier: 3, worldRanking: 40, country: "USA" },
  { name: "Justin Rose", tier: 3, worldRanking: 35, country: "ENG" },
  { name: "Adam Scott", tier: 3, worldRanking: 38, country: "AUS" },
  { name: "Kevin Kisner", tier: 3, worldRanking: 50, country: "USA" },
  { name: "Si Woo Kim", tier: 3, worldRanking: 45, country: "KOR" },
  { name: "Corey Conners", tier: 3, worldRanking: 48, country: "CAN" },
  { name: "Matt Fitzpatrick", tier: 3, worldRanking: 30, country: "ENG" },
  { name: "Ryan Fox", tier: 3, worldRanking: 55, country: "NZL" },
  { name: "Jose Maria Olazabal", tier: 3, worldRanking: 99, country: "ESP" },
];

export default function CompetitionManagePage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = use(params);
  const router = useRouter();
  const { user } = useUser();

  const competition = useQuery(api.competitions.get, {
    competitionId: competitionId as Id<"competitions">,
  });
  const players = useQuery(api.players.listByCompetition, {
    competitionId: competitionId as Id<"competitions">,
  });
  const entries = useQuery(api.entries.listByCompetition, {
    competitionId: competitionId as Id<"competitions">,
  });

  const bulkCreatePlayers = useMutation(api.players.bulkCreate);
  const updateStatus = useMutation(api.competitions.updateStatus);
  const runDraw = useMutation(api.entries.runDraw);
  const upsertScore = useMutation(api.players.upsertScore);

  const [scoreEdits, setScoreEdits] = useState<Record<string, { r1?: string; r2?: string; r3?: string; r4?: string }>>({});
  const [loading, setLoading] = useState<string | null>(null);

  if (!competition || !players || !entries) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  }

  const paidEntries = entries.filter(e => e.paidAt);
  const unpaidEntries = entries.filter(e => !e.paidAt);
  const pot = paidEntries.length * competition.entryFee;

  async function handleLoadMastersPlayers() {
    setLoading("players");
    await bulkCreatePlayers({
      competitionId: competitionId as Id<"competitions">,
      players: MASTERS_2026_PLAYERS,
    });
    setLoading(null);
  }

  async function handleRunDraw() {
    if (!confirm(`Run draw for ${paidEntries.length} paid entries?`)) return;
    setLoading("draw");
    try {
      const count = await runDraw({ competitionId: competitionId as Id<"competitions"> });
      alert(`Draw complete! ${count} players assigned.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Draw failed");
    }
    setLoading(null);
  }

  async function handleSaveScore(playerId: Id<"players">) {
    const edits = scoreEdits[playerId];
    if (!edits) return;
    const r1 = edits.r1 ? parseInt(edits.r1) : undefined;
    const r2 = edits.r2 ? parseInt(edits.r2) : undefined;
    const r3 = edits.r3 ? parseInt(edits.r3) : undefined;
    const r4 = edits.r4 ? parseInt(edits.r4) : undefined;
    const rounds = [r1, r2, r3, r4].filter(r => r !== undefined) as number[];
    const totalScore = rounds.length > 0 ? rounds.reduce((a, b) => a + b, 0) : undefined;
    const par = 72;
    const scoreToPar = totalScore !== undefined ? totalScore - par * rounds.length : undefined;
    await upsertScore({ playerId, r1, r2, r3, r4, totalScore, scoreToPar });
    setScoreEdits(prev => { const n = { ...prev }; delete n[playerId]; return n; });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-900 text-white px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push("/manage")} className="text-green-300 hover:text-white text-sm">← Dashboard</button>
        <div className="flex-1">
          <h1 className="font-bold">{competition.name}</h1>
        </div>
        <StatusBadge status={competition.status} />
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Paid entries", value: paidEntries.length },
            { label: "Unpaid", value: unpaidEntries.length },
            { label: "Players loaded", value: players.length },
            { label: "Pot", value: formatCurrency(pot, competition.currency) },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-green-800">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Public link */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">Entry link</div>
            <div className="text-sm text-gray-500 font-mono mt-0.5">
              {typeof window !== "undefined" ? window.location.origin : ""}/your-club/{competition.slug}
            </div>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/your-club/${competition.slug}`)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Copy link
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {players.length === 0 && competition.tournamentRef === "masters-2026" && (
            <button
              onClick={handleLoadMastersPlayers}
              disabled={loading === "players"}
              className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-600 disabled:bg-gray-300"
            >
              {loading === "players" ? "Loading…" : "Load Masters 2026 players"}
            </button>
          )}
          {competition.status === "draft" && (
            <button
              onClick={() => updateStatus({ competitionId: competitionId as Id<"competitions">, status: "open" })}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500"
            >
              Open for entries
            </button>
          )}
          {competition.status === "open" && paidEntries.length > 0 && players.length > 0 && !competition.drawCompletedAt && (
            <button
              onClick={handleRunDraw}
              disabled={loading === "draw"}
              className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-500 disabled:bg-gray-300"
            >
              {loading === "draw" ? "Drawing…" : `🎰 Run draw (${paidEntries.length} entries)`}
            </button>
          )}
          {competition.status === "live" && (
            <button
              onClick={() => updateStatus({ competitionId: competitionId as Id<"competitions">, status: "complete" })}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500"
            >
              Mark complete
            </button>
          )}
        </div>

        {/* Entries */}
        {entries.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Entries</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Paid</th>
                    <th className="px-5 py-3 font-medium">Drawn players</th>
                    <th className="px-5 py-3 font-medium text-right">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry._id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-900">{entry.displayName}</td>
                      <td className="px-5 py-3">
                        {entry.paidAt
                          ? <span className="text-green-600">✓ Paid</span>
                          : <span className="text-amber-600">Pending</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs">
                        {entry.drawnPlayerIds?.length
                          ? `${entry.drawnPlayerIds.length} players drawn`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {entry.leaderboardPosition ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Score entry */}
        {players.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Player scores (manual entry)</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">Player</th>
                    <th className="px-4 py-3 font-medium text-center">T</th>
                    <th className="px-4 py-3 font-medium text-center">R1</th>
                    <th className="px-4 py-3 font-medium text-center">R2</th>
                    <th className="px-4 py-3 font-medium text-center">R3</th>
                    <th className="px-4 py-3 font-medium text-center">R4</th>
                    <th className="px-4 py-3 font-medium text-center">Score</th>
                    <th className="px-4 py-3 font-medium text-center">Pos</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...players]
                    .sort((a, b) => a.tier - b.tier || (a.worldRanking ?? 99) - (b.worldRanking ?? 99))
                    .map(player => {
                      const edits = scoreEdits[player._id] ?? {};
                      const hasEdits = Object.keys(edits).length > 0;
                      return (
                        <tr key={player._id} className="border-b border-gray-50 last:border-0">
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-900">{player.name}</div>
                            <div className="text-xs text-gray-400">{player.country}</div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              player.tier === 1 ? "bg-amber-100 text-amber-700" :
                              player.tier === 2 ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>{player.tier}</span>
                          </td>
                          {(["r1", "r2", "r3", "r4"] as const).map(round => (
                            <td key={round} className="px-4 py-2">
                              <input
                                type="number"
                                value={edits[round] ?? player[round] ?? ""}
                                onChange={e => setScoreEdits(prev => ({
                                  ...prev,
                                  [player._id]: { ...(prev[player._id] ?? {}), [round]: e.target.value },
                                }))}
                                className="w-14 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                                placeholder="—"
                                min="55"
                                max="90"
                              />
                            </td>
                          ))}
                          <td className="px-4 py-2 text-center font-medium text-gray-900">
                            {player.scoreToPar !== undefined
                              ? player.scoreToPar === 0 ? "E" : player.scoreToPar > 0 ? `+${player.scoreToPar}` : `${player.scoreToPar}`
                              : "—"}
                          </td>
                          <td className="px-4 py-2 text-center text-gray-600">
                            {player.position ?? "—"}
                          </td>
                          <td className="px-4 py-2">
                            {hasEdits && (
                              <button
                                onClick={() => handleSaveScore(player._id)}
                                className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-500"
                              >
                                Save
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    open: "bg-blue-100 text-blue-700",
    live: "bg-green-100 text-green-700",
    complete: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
