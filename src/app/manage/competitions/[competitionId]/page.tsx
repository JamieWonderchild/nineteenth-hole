"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Copy, CheckCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PRIZE_STRUCTURE_PRESETS: Record<string, Array<{ name: string; tier: number; worldRanking: number; country: string }>> = {
  "masters-2026": [
    // Tier 1 — World #1-15
    { name: "Scottie Scheffler", tier: 1, worldRanking: 1, country: "USA" },
    { name: "Rory McIlroy", tier: 1, worldRanking: 2, country: "NIR" },
    { name: "Jon Rahm", tier: 1, worldRanking: 3, country: "ESP" },
    { name: "Xander Schauffele", tier: 1, worldRanking: 4, country: "USA" },
    { name: "Collin Morikawa", tier: 1, worldRanking: 5, country: "USA" },
    { name: "Bryson DeChambeau", tier: 1, worldRanking: 6, country: "USA" },
    { name: "Ludvig Åberg", tier: 1, worldRanking: 7, country: "SWE" },
    { name: "Viktor Hovland", tier: 1, worldRanking: 8, country: "NOR" },
    { name: "Tommy Fleetwood", tier: 1, worldRanking: 9, country: "ENG" },
    { name: "Patrick Cantlay", tier: 1, worldRanking: 10, country: "USA" },
    { name: "Russell Henley", tier: 1, worldRanking: 11, country: "USA" },
    { name: "Shane Lowry", tier: 1, worldRanking: 12, country: "IRL" },
    { name: "Justin Thomas", tier: 1, worldRanking: 13, country: "USA" },
    { name: "Tony Finau", tier: 1, worldRanking: 14, country: "USA" },
    { name: "Brian Harman", tier: 1, worldRanking: 15, country: "USA" },
    // Tier 2 — World #16-40
    { name: "Hideki Matsuyama", tier: 2, worldRanking: 16, country: "JPN" },
    { name: "Cameron Smith", tier: 2, worldRanking: 17, country: "AUS" },
    { name: "Tyrrell Hatton", tier: 2, worldRanking: 18, country: "ENG" },
    { name: "Max Homa", tier: 2, worldRanking: 19, country: "USA" },
    { name: "Wyndham Clark", tier: 2, worldRanking: 20, country: "USA" },
    { name: "Matt Fitzpatrick", tier: 2, worldRanking: 21, country: "ENG" },
    { name: "Sepp Straka", tier: 2, worldRanking: 22, country: "AUT" },
    { name: "Will Zalatoris", tier: 2, worldRanking: 23, country: "USA" },
    { name: "Min Woo Lee", tier: 2, worldRanking: 24, country: "AUS" },
    { name: "Keegan Bradley", tier: 2, worldRanking: 25, country: "USA" },
    { name: "Tom Kim", tier: 2, worldRanking: 26, country: "KOR" },
    { name: "Si Woo Kim", tier: 2, worldRanking: 27, country: "KOR" },
    { name: "Sungjae Im", tier: 2, worldRanking: 28, country: "KOR" },
    { name: "Adam Scott", tier: 2, worldRanking: 29, country: "AUS" },
    { name: "Robert MacIntyre", tier: 2, worldRanking: 30, country: "SCO" },
    { name: "Jordan Spieth", tier: 2, worldRanking: 31, country: "USA" },
    { name: "Sahith Theegala", tier: 2, worldRanking: 32, country: "USA" },
    { name: "Rickie Fowler", tier: 2, worldRanking: 33, country: "USA" },
    { name: "Corey Conners", tier: 2, worldRanking: 34, country: "CAN" },
    { name: "Ryan Fox", tier: 2, worldRanking: 35, country: "NZL" },
    { name: "Brooks Koepka", tier: 2, worldRanking: 36, country: "USA" },
    { name: "Cameron Davis", tier: 2, worldRanking: 37, country: "AUS" },
    { name: "Akshay Bhatia", tier: 2, worldRanking: 38, country: "USA" },
    { name: "Denny McCarthy", tier: 2, worldRanking: 39, country: "USA" },
    { name: "Tom Hoge", tier: 2, worldRanking: 40, country: "USA" },
    // Tier 3 — past champions & qualifiers
    { name: "Justin Rose", tier: 3, worldRanking: 41, country: "ENG" },
    { name: "Sergio Garcia", tier: 3, worldRanking: 42, country: "ESP" },
    { name: "Patrick Reed", tier: 3, worldRanking: 43, country: "USA" },
    { name: "Dustin Johnson", tier: 3, worldRanking: 44, country: "USA" },
    { name: "Phil Mickelson", tier: 3, worldRanking: 45, country: "USA" },
    { name: "Bubba Watson", tier: 3, worldRanking: 46, country: "USA" },
    { name: "Danny Willett", tier: 3, worldRanking: 47, country: "ENG" },
    { name: "Tiger Woods", tier: 3, worldRanking: 48, country: "USA" },
    { name: "Jason Day", tier: 3, worldRanking: 49, country: "AUS" },
    { name: "Adam Hadwin", tier: 3, worldRanking: 50, country: "CAN" },
    { name: "Nick Taylor", tier: 3, worldRanking: 51, country: "CAN" },
    { name: "Joaquin Niemann", tier: 3, worldRanking: 52, country: "CHI" },
    { name: "Nicolai Hojgaard", tier: 3, worldRanking: 53, country: "DEN" },
    { name: "Rasmus Hojgaard", tier: 3, worldRanking: 54, country: "DEN" },
    { name: "Thomas Detry", tier: 3, worldRanking: 55, country: "BEL" },
    { name: "Victor Perez", tier: 3, worldRanking: 56, country: "FRA" },
    { name: "Taylor Moore", tier: 3, worldRanking: 57, country: "USA" },
    { name: "Davis Riley", tier: 3, worldRanking: 58, country: "USA" },
    { name: "Harris English", tier: 3, worldRanking: 59, country: "USA" },
    { name: "J.J. Spaun", tier: 3, worldRanking: 60, country: "USA" },
    { name: "Jake Knapp", tier: 3, worldRanking: 61, country: "USA" },
    { name: "Chris Kirk", tier: 3, worldRanking: 62, country: "USA" },
    { name: "Beau Hossler", tier: 3, worldRanking: 63, country: "USA" },
    { name: "Louis Oosthuizen", tier: 3, worldRanking: 64, country: "RSA" },
    { name: "Abraham Ancer", tier: 3, worldRanking: 65, country: "MEX" },
    { name: "Fred Couples", tier: 3, worldRanking: 99, country: "USA" },
  ],
  "pga-championship-2026": [
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
    { name: "Brooks Koepka", tier: 2, worldRanking: 11, country: "USA" },
    { name: "Shane Lowry", tier: 2, worldRanking: 12, country: "IRL" },
    { name: "Justin Thomas", tier: 2, worldRanking: 13, country: "USA" },
    { name: "Tony Finau", tier: 2, worldRanking: 14, country: "USA" },
    { name: "Hideki Matsuyama", tier: 2, worldRanking: 15, country: "JPN" },
    { name: "Cameron Smith", tier: 2, worldRanking: 16, country: "AUS" },
    { name: "Tyrrell Hatton", tier: 2, worldRanking: 18, country: "ENG" },
    { name: "Max Homa", tier: 2, worldRanking: 19, country: "USA" },
    { name: "Sepp Straka", tier: 2, worldRanking: 20, country: "AUT" },
    { name: "Russell Henley", tier: 2, worldRanking: 22, country: "USA" },
    { name: "Sergio Garcia", tier: 3, worldRanking: 25, country: "ESP" },
    { name: "Matt Fitzpatrick", tier: 3, worldRanking: 30, country: "ENG" },
    { name: "Justin Rose", tier: 3, worldRanking: 35, country: "ENG" },
    { name: "Adam Scott", tier: 3, worldRanking: 38, country: "AUS" },
    { name: "Phil Mickelson", tier: 3, worldRanking: 40, country: "USA" },
    { name: "Kevin Kisner", tier: 3, worldRanking: 50, country: "USA" },
    { name: "Si Woo Kim", tier: 3, worldRanking: 45, country: "KOR" },
    { name: "Corey Conners", tier: 3, worldRanking: 48, country: "CAN" },
    { name: "Ryan Fox", tier: 3, worldRanking: 55, country: "NZL" },
    { name: "Sungjae Im", tier: 3, worldRanking: 58, country: "KOR" },
  ],
};

// Generic field player set for any major/tour event
const GENERIC_TOUR_PLAYERS = [
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
  { name: "Brooks Koepka", tier: 2, worldRanking: 11, country: "USA" },
  { name: "Shane Lowry", tier: 2, worldRanking: 12, country: "IRL" },
  { name: "Justin Thomas", tier: 2, worldRanking: 13, country: "USA" },
  { name: "Tony Finau", tier: 2, worldRanking: 14, country: "USA" },
  { name: "Hideki Matsuyama", tier: 2, worldRanking: 15, country: "JPN" },
  { name: "Cameron Smith", tier: 2, worldRanking: 16, country: "AUS" },
  { name: "Tyrrell Hatton", tier: 2, worldRanking: 18, country: "ENG" },
  { name: "Max Homa", tier: 2, worldRanking: 19, country: "USA" },
  { name: "Sepp Straka", tier: 2, worldRanking: 20, country: "AUT" },
  { name: "Russell Henley", tier: 2, worldRanking: 22, country: "USA" },
  { name: "Sergio Garcia", tier: 3, worldRanking: 25, country: "ESP" },
  { name: "Matt Fitzpatrick", tier: 3, worldRanking: 30, country: "ENG" },
  { name: "Justin Rose", tier: 3, worldRanking: 35, country: "ENG" },
  { name: "Adam Scott", tier: 3, worldRanking: 38, country: "AUS" },
  { name: "Phil Mickelson", tier: 3, worldRanking: 40, country: "USA" },
  { name: "Kevin Kisner", tier: 3, worldRanking: 50, country: "USA" },
  { name: "Si Woo Kim", tier: 3, worldRanking: 45, country: "KOR" },
  { name: "Corey Conners", tier: 3, worldRanking: 48, country: "CAN" },
  { name: "Ryan Fox", tier: 3, worldRanking: 55, country: "NZL" },
  { name: "Sungjae Im", tier: 3, worldRanking: 58, country: "KOR" },
];

function getPresetPlayers(ref?: string) {
  if (!ref) return GENERIC_TOUR_PLAYERS;
  return PRIZE_STRUCTURE_PRESETS[ref] ?? GENERIC_TOUR_PLAYERS;
}

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
  const club = useQuery(
    api.clubs.get,
    competition?.clubId ? { clubId: competition.clubId } : "skip"
  );

  const bulkCreatePlayers = useMutation(api.players.bulkCreate);
  const updateStatus = useMutation(api.competitions.updateStatus);
  const runDraw = useMutation(api.entries.runDraw);
  const upsertScore = useMutation(api.players.upsertScore);
  const updatePrizeMoney = useMutation(api.players.updatePrizeMoney);
  const refreshLeaderboard = useMutation(api.entries.refreshLeaderboard);

  const [scoreEdits, setScoreEdits] = useState<Record<string, { r1?: string; r2?: string; r3?: string; r4?: string }>>({});
  const [prizeEdits, setPrizeEdits] = useState<Record<string, string>>({}); // playerId → prize money string (in whole currency units)
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  void user;

  if (!competition || !players || !entries) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const paidEntries = entries.filter(e => e.paidAt);
  const pot = paidEntries.length * competition.entryFee;
  const isPlatformPool = competition.scope === "platform";
  const isPickFormat = competition.drawType === "pick";
  const publicUrl = isPlatformPool
    ? `/pools/${competition.slug}`
    : club ? `/${club.slug}/${competition.slug}` : "";

  async function handleLoadPlayers() {
    setLoading("players");
    const preset = getPresetPlayers(competition?.tournamentRef);
    await bulkCreatePlayers({
      competitionId: competitionId as Id<"competitions">,
      players: preset,
    });
    setLoading(null);
  }

  async function handleRunDraw() {
    if (!confirm(`Run draw for ${paidEntries.length} paid entries? This cannot be undone.`)) return;
    setLoading("draw");
    try {
      const count = await runDraw({ competitionId: competitionId as Id<"competitions"> });
      alert(`Draw complete! ${count} entries assigned.`);
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
    const rounds = [r1, r2, r3, r4].filter((r): r is number => r !== undefined);
    const totalScore = rounds.length > 0 ? rounds.reduce((a, b) => a + b, 0) : undefined;
    const par = 72;
    const scoreToPar = totalScore !== undefined ? totalScore - par * rounds.length : undefined;
    await upsertScore({ playerId, r1, r2, r3, r4, totalScore, scoreToPar });
    setScoreEdits(prev => { const n = { ...prev }; delete n[playerId]; return n; });
  }

  async function handleSavePrizeMoney(playerId: Id<"players">) {
    const val = prizeEdits[playerId];
    if (!val) return;
    const prizeMoney = Math.round(parseFloat(val) * 100); // convert from whole units to pence
    await updatePrizeMoney({ playerId, prizeMoney });
    setPrizeEdits(prev => { const n = { ...prev }; delete n[playerId]; return n; });
  }

  async function handleRefreshLeaderboard() {
    setLoading("refresh");
    await refreshLeaderboard({ competitionId: competitionId as Id<"competitions"> });
    setLoading(null);
  }

  async function copyLink() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    await navigator.clipboard.writeText(`${origin}${publicUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const statusFlow = ["draft", "open", "live", "complete"] as const;
  const currentStep = statusFlow.indexOf(competition.status as typeof statusFlow[number]);
  const nextStatus = statusFlow[currentStep + 1];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 mt-0.5">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">{competition.name}</h1>
            <StatusBadge status={competition.status} />
            {isPlatformPool && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Platform pool</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date(competition.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
            {" – "}
            {new Date(competition.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            {club && ` · ${club.name}`}
          </p>
        </div>
        {publicUrl && (
          <Link href={publicUrl} target="_blank"
            className="flex items-center gap-1.5 text-sm text-green-700 hover:underline shrink-0">
            Public page <ExternalLink size={13} />
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Paid entries", value: paidEntries.length },
          { label: "Pot", value: formatCurrency(pot, competition.currency) },
          { label: "Players", value: players.length },
          { label: "Status", value: competition.status.charAt(0).toUpperCase() + competition.status.slice(1) },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-800">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Entry link */}
          {publicUrl && (
            <div className="flex items-center gap-3 bg-muted rounded-lg px-4 py-2.5">
              <code className="text-xs text-muted-foreground flex-1 truncate">
                {typeof window !== "undefined" ? window.location.origin : "playthepool.golf"}{publicUrl}
              </code>
              <button onClick={copyLink}
                className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-600 shrink-0">
                {copied ? <><CheckCircle size={13} /> Copied</> : <><Copy size={13} /> Copy link</>}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {/* Load players */}
            {players.length === 0 && (competition.type === "major" || competition.type === "tour" || competition.scope === "platform") && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadPlayers}
                disabled={loading === "players"}
              >
                {loading === "players" ? "Loading…" : `Load ${competition.tournamentRef ? "field players" : "default field"}`}
              </Button>
            )}

            {/* Status transitions */}
            {competition.status === "draft" && (
              <Button size="sm" onClick={() => updateStatus({ competitionId: competitionId as Id<"competitions">, status: "open" })}>
                Open for entries
              </Button>
            )}

            {competition.status === "open" && !isPickFormat && (
              <>
                <Button
                  size="sm"
                  onClick={handleRunDraw}
                  disabled={loading === "draw" || paidEntries.length === 0 || players.length === 0}
                >
                  {loading === "draw" ? "Drawing…" : `🎰 Run draw (${paidEntries.length} entries)`}
                </Button>
                {(paidEntries.length === 0 || players.length === 0) && (
                  <p className="text-xs text-muted-foreground self-center">
                    {players.length === 0 ? "Load players first · " : ""}
                    {paidEntries.length === 0 ? "No paid entries yet" : ""}
                  </p>
                )}
              </>
            )}
            {competition.status === "open" && isPickFormat && (
              <p className="text-xs text-muted-foreground self-center">
                {paidEntries.length === 0 ? "No paid entries yet — " : `${paidEntries.length} paid entr${paidEntries.length === 1 ? "y" : "ies"} · `}
                {players.length === 0 ? "Load player field to open for picks" : "Members pick their team from the competition page"}
              </p>
            )}

            {competition.status === "live" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshLeaderboard}
                  disabled={loading === "refresh"}
                >
                  {loading === "refresh" ? "Refreshing…" : "Refresh leaderboard"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatus({ competitionId: competitionId as Id<"competitions">, status: "complete" })}
                >
                  Mark complete
                </Button>
              </>
            )}

            {nextStatus && !["draft", "open", "live"].includes(competition.status) && (
              <Button variant="ghost" size="sm" onClick={() => updateStatus({ competitionId: competitionId as Id<"competitions">, status: nextStatus })}>
                → {nextStatus}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Entries */}
      {entries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Entries ({entries.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3 hidden sm:table-cell">
                    {isPickFormat ? "Picks" : "Players drawn"}
                  </th>
                  <th className="px-5 py-3 text-right">
                    {isPickFormat ? "Prize $" : "Position"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  const pickedNames = isPickFormat
                    ? (entry.drawnPlayerIds ?? []).map(pid => players.find(p => p._id === pid)?.name).filter(Boolean)
                    : [];
                  return (
                    <tr key={entry._id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-medium text-gray-900">{entry.displayName}</td>
                      <td className="px-5 py-3">
                        {entry.paidAt ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Paid</span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Unpaid</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 hidden sm:table-cell">
                        {isPickFormat
                          ? (pickedNames.length ? pickedNames.join(", ") : "—")
                          : (entry.drawnPlayerIds?.length ? `${entry.drawnPlayerIds.length} drawn` : "—")}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {isPickFormat
                          ? (entry.totalPrizeMoney ? `£${(entry.totalPrizeMoney / 100).toLocaleString()}` : "—")
                          : (entry.leaderboardPosition ?? "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Player field */}
      {players.length > 0 && isPickFormat && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Prize money — enter after tournament</CardTitle>
              <p className="text-xs text-muted-foreground">Enter whole {competition.currency} amounts (e.g. 1440000 for £1.44M)</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3 text-center">Rank</th>
                    <th className="px-4 py-3 text-center">Prize won ({competition.currency})</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...players]
                    .sort((a, b) => (b.prizeMoney ?? 0) - (a.prizeMoney ?? 0) || (a.worldRanking ?? 99) - (b.worldRanking ?? 99))
                    .map(player => {
                      const editVal = prizeEdits[player._id];
                      const hasEdit = editVal !== undefined;
                      return (
                        <tr key={player._id} className={cn(
                          "border-b border-gray-50 last:border-0",
                          hasEdit && "bg-amber-50/50"
                        )}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-900 leading-tight">{player.name}</div>
                            <div className="text-xs text-gray-400">{player.country}</div>
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-500">#{player.worldRanking ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              value={editVal ?? (player.prizeMoney !== undefined ? String(player.prizeMoney / 100) : "")}
                              onChange={e => setPrizeEdits(prev => ({ ...prev, [player._id]: e.target.value }))}
                              className="w-32 text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                              placeholder="0"
                              min="0"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            {hasEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSavePrizeMoney(player._id as Id<"players">)}
                                className="text-xs h-7 px-2 text-green-700 hover:bg-green-50"
                              >
                                Save
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Player scores (sweep / draw format) */}
      {players.length > 0 && !isPickFormat && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Player scores — manual entry</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3 text-center">T</th>
                    <th className="px-4 py-3 text-center">R1</th>
                    <th className="px-4 py-3 text-center">R2</th>
                    <th className="px-4 py-3 text-center">R3</th>
                    <th className="px-4 py-3 text-center">R4</th>
                    <th className="px-4 py-3 text-center">Score</th>
                    <th className="px-4 py-3 text-center">Pos</th>
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
                        <tr key={player._id} className={cn(
                          "border-b border-gray-50 last:border-0",
                          hasEdits && "bg-amber-50/50"
                        )}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-900 leading-tight">{player.name}</div>
                            <div className="text-xs text-gray-400">{player.country}</div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              player.tier === 1 ? "bg-amber-100 text-amber-700" :
                              player.tier === 2 ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-500"
                            }`}>{player.tier}</span>
                          </td>
                          {(["r1", "r2", "r3", "r4"] as const).map(round => (
                            <td key={round} className="px-2 py-2.5">
                              <input
                                type="number"
                                value={edits[round] ?? (player[round] !== undefined ? String(player[round]) : "")}
                                onChange={e => setScoreEdits(prev => ({
                                  ...prev,
                                  [player._id]: { ...(prev[player._id] ?? {}), [round]: e.target.value },
                                }))}
                                className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                                placeholder="—"
                                min="55"
                                max="90"
                              />
                            </td>
                          ))}
                          <td className={cn("px-4 py-2.5 text-center font-semibold",
                            (player.scoreToPar ?? 0) < 0 ? "text-green-700" :
                            (player.scoreToPar ?? 0) > 0 ? "text-red-600" : "text-gray-700"
                          )}>
                            {player.scoreToPar !== undefined
                              ? player.scoreToPar === 0 ? "E" : player.scoreToPar > 0 ? `+${player.scoreToPar}` : `${player.scoreToPar}`
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center text-gray-500">
                            {player.position ?? "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {hasEdits && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveScore(player._id)}
                                className="text-xs h-7 px-2 text-green-700 hover:bg-green-50"
                              >
                                Save
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
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
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
