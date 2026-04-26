"use client";

import { useState, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = [
  { value: "major",      label: "Major",      bf: 3, description: "Best 3 count · BF×3" },
  { value: "medal",      label: "Medal / Named Event", bf: 2, description: "Best 4 count · BF×2" },
  { value: "stableford", label: "Stableford",  bf: 1, description: "Best 4 count × 2 · BF×1" },
  { value: "knockout",   label: "Knockout",    bf: 0, description: "300/150/75/50 fixed pts" },
  { value: "trophy",     label: "Trophy",      bf: 0, description: "100/50 (÷2 if pairs)" },
] as const;

const CATEGORY_COLOURS: Record<string, string> = {
  major:      "bg-amber-100 text-amber-800",
  medal:      "bg-blue-100 text-blue-800",
  stableford: "bg-green-100 text-green-800",
  knockout:   "bg-purple-100 text-purple-800",
  trophy:     "bg-rose-100 text-rose-800",
};

const CAT_LABEL: Record<string, string> = {
  major: "Major", medal: "Medal", stableford: "Stableford",
  knockout: "Knockout", trophy: "Trophy",
};

const MAJOR_QUOTA = 3;
const MEDAL_QUOTA = 4;
const STABLEFORD_QUOTA = 4;

type Standing = {
  userId?: string;
  displayName: string;
  majorTotal: number; majorPlayed: number; majorCounted: number; majorQuota: number;
  medalTotal: number; medalPlayed: number; medalCounted: number; medalQuota: number;
  stablefordTotal: number; stablefordPlayed: number; stablefordCounted: number; stablefordQuota: number;
  knockoutTotal: number;
  trophyTotal: number;
  competitionsPlayed: number;
  total: number;
};

function PlayerDetailModal({
  standing,
  position,
  seriesId,
  onClose,
}: {
  standing: Standing;
  position: number;
  seriesId: string;
  onClose: () => void;
}) {
  const playerKey = standing.userId ?? standing.displayName;
  const results = useQuery(api.series.getPlayerResults, {
    seriesId: seriesId as Id<"series">,
    playerKey,
  });

  // Mark which results are counted in each category
  function markCounted(items: typeof results, cat: string, quota: number) {
    if (!items) return new Set<string>();
    const catItems = items
      .filter(r => r.category === cat)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, quota);
    // For stableford the first item is doubled — still same "counted" set
    return new Set(catItems.map(r => r.competitionId + r.date));
  }

  const majorCounted    = markCounted(results, "major",      MAJOR_QUOTA);
  const medalCounted    = markCounted(results, "medal",      MEDAL_QUOTA);
  const sfCounted       = markCounted(results, "stableford", STABLEFORD_QUOTA);

  const pos = position;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-lg bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `#${pos}`}
              </span>
              <h2 className="text-lg font-semibold text-gray-900">{standing.displayName}</h2>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {standing.competitionsPlayed} competitions · {standing.total} pts total
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Points breakdown */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Points breakdown</h3>
            <div className="space-y-2">
              {[
                { label: "Majors",      total: standing.majorTotal,      counted: standing.majorCounted,      quota: standing.majorQuota,      colour: "text-amber-700",  bg: "bg-amber-50" },
                { label: "Medals",      total: standing.medalTotal,       counted: standing.medalCounted,       quota: standing.medalQuota,       colour: "text-blue-700",   bg: "bg-blue-50"  },
                { label: "Stablefords", total: standing.stablefordTotal,  counted: standing.stablefordCounted,  quota: standing.stablefordQuota,  colour: "text-green-700",  bg: "bg-green-50" },
                { label: "Knockouts",   total: standing.knockoutTotal,    counted: null,                        quota: null,                       colour: "text-purple-700", bg: "bg-purple-50"},
                { label: "Trophies",    total: standing.trophyTotal,      counted: null,                        quota: null,                       colour: "text-rose-700",   bg: "bg-rose-50"  },
              ].map(row => (
                <div key={row.label} className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${row.bg}`}>
                  <span className={`text-sm font-medium ${row.colour}`}>{row.label}</span>
                  <div className="flex items-center gap-2">
                    {row.counted !== null && (
                      <span className="text-xs text-gray-400">({row.counted}/{row.quota} counted)</span>
                    )}
                    <span className={`font-bold tabular-nums ${row.colour}`}>{row.total}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg px-4 py-2.5 bg-gray-900">
                <span className="text-sm font-semibold text-white">Total</span>
                <span className="font-bold text-white tabular-nums">{standing.total}</span>
              </div>
            </div>
          </div>

          {/* Competition results */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Competition results</h3>
            {results === undefined ? (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : results.length === 0 ? (
              <p className="text-sm text-gray-400">No results found.</p>
            ) : (
              <div className="space-y-1.5">
                {results.map(r => {
                  const key = r.competitionId + r.date;
                  const isCounted =
                    r.category === "major"      ? majorCounted.has(key) :
                    r.category === "medal"      ? medalCounted.has(key) :
                    r.category === "stableford" ? sfCounted.has(key) :
                    true; // knockouts/trophies always count

                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
                        isCounted ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"
                      }`}
                    >
                      <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLOURS[r.category] ?? "bg-gray-100 text-gray-600"}`}>
                        {CAT_LABEL[r.category] ?? r.category}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.competitionName}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          {" · "}T{r.position}/{r.participantCount}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold tabular-nums text-gray-900">{r.pts}</p>
                        {!isCounted && (
                          <p className="text-xs text-gray-400">not counted</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SeriesDetailPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = use(params);
  const router = useRouter();
  const { user } = useUser();

  const series = useQuery(api.series.get, { seriesId: seriesId as Id<"series"> });
  const compsWithLinks = useQuery(api.series.getCompetitionsWithLinks, {
    seriesId: seriesId as Id<"series">,
  });
  const standings = useQuery(api.series.computeStandings, { seriesId: seriesId as Id<"series"> });

  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(api.clubs.get, adminMembership ? { clubId: adminMembership.clubId } : "skip");
  const allClubComps = useQuery(api.competitions.listByClub, club ? { clubId: club._id } : "skip");

  const addCompetition = useMutation(api.series.addCompetition);
  const updateCategory = useMutation(api.series.updateCompetitionCategory);
  const removeCompetition = useMutation(api.series.removeCompetition);

  const [showComps, setShowComps] = useState(false);
  const [addingComp, setAddingComp] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("stableford");
  const [isPairs, setIsPairs] = useState(false);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<{ standing: Standing; position: number } | null>(null);

  if (!series) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const seriesCompIds = new Set(compsWithLinks?.map(c => c.competition?._id).filter(Boolean));
  const availableComps = (allClubComps ?? []).filter(c => !seriesCompIds.has(c._id));
  const sym = series.currency === "GBP" ? "£" : series.currency === "EUR" ? "€" : "$";

  async function handleAddComp(competitionId: Id<"competitions">) {
    await addCompetition({
      seriesId: seriesId as Id<"series">,
      competitionId,
      category: selectedCategory,
      isPairsEvent: isPairs || undefined,
    });
    setAddingComp(false);
    setIsPairs(false);
  }

  const completedCount = (compsWithLinks ?? []).filter(c => c.competition?.status === "complete").length;
  const totalCount = (compsWithLinks ?? []).length;

  // Competitions sorted by date
  const sortedComps = [...(compsWithLinks ?? [])].sort((a, b) => {
    const da = a.competition?.startDate ?? "";
    const db = b.competition?.startDate ?? "";
    return da.localeCompare(db);
  });

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/manage/series")}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{series.name}</h1>
          <p className="text-sm text-muted-foreground">
            Season {series.season}
            {series.prizePool && ` · ${sym}${(series.prizePool / 100).toFixed(0)} prize pool`}
            {" · "}
            <span className={series.status === "active" ? "text-green-700" : "text-gray-500"}>
              {series.status}
            </span>
          </p>
        </div>
      </div>

      {series.description && (
        <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl px-5 py-3">
          {series.description}
        </p>
      )}

      {/* Scoring formula explainer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm">
        <p className="font-semibold text-amber-900 mb-1.5">Race to Swinley Forest scoring</p>
        <div className="text-amber-800 space-y-0.5 text-xs leading-relaxed">
          <p><strong>Majors (BF=3):</strong> (50+N)·3 / (25+N)·3 / (10+N)·3 / (5+N)·3 / max(0,N+5−pos)·3 — best 3 count</p>
          <p><strong>Medals &amp; Named Events (BF=2):</strong> same formula · BF=2 — best 4 count</p>
          <p><strong>Stablefords (BF=1):</strong> same formula · BF=1 — best 4 count</p>
          <p><strong>Knockouts:</strong> 300 / 150 / 75 (semi) / 50 (quarter) — all count</p>
          <p><strong>Trophies:</strong> 100 / 50 — all count (÷2 for pairs events)</p>
        </div>
      </div>

      {/* ── Season standings ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Season standings</CardTitle>
        </CardHeader>
        <CardContent>
          {completedCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Standings appear once competitions are marked complete.
            </p>
          ) : standings === undefined ? (
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
          ) : standings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries recorded yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-2 py-2 w-8">#</th>
                    <th className="px-2 py-2">Member</th>
                    <th className="px-2 py-2 text-right text-amber-700">Majors</th>
                    <th className="px-2 py-2 text-right text-blue-700">Medals</th>
                    <th className="px-2 py-2 text-right text-green-700">Stablefords</th>
                    <th className="px-2 py-2 text-right text-purple-700">Knockouts</th>
                    <th className="px-2 py-2 text-right text-rose-700">Trophies</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-900">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr
                      key={s.userId ?? s.displayName}
                      onClick={() => setSelectedPlayer({ standing: s as Standing, position: i + 1 })}
                      className={`border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${i === 0 ? "bg-amber-50/50 hover:bg-amber-50" : ""}`}
                    >
                      <td className="px-2 py-2.5 text-gray-400 text-center">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="font-medium text-gray-900">{s.displayName}</span>
                        <span className="ml-1.5 text-xs text-gray-400">{s.competitionsPlayed} comps</span>
                      </td>
                      <td className="px-2 py-2.5 text-right text-amber-700 tabular-nums">
                        {s.majorTotal > 0 ? s.majorTotal : <span className="text-gray-300">—</span>}
                        {s.majorPlayed > 0 && (
                          <span className="text-xs text-gray-400 ml-0.5">({s.majorCounted}/{s.majorQuota})</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right text-blue-700 tabular-nums">
                        {s.medalTotal > 0 ? s.medalTotal : <span className="text-gray-300">—</span>}
                        {s.medalPlayed > 0 && (
                          <span className="text-xs text-gray-400 ml-0.5">({s.medalCounted}/{s.medalQuota})</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right text-green-700 tabular-nums">
                        {s.stablefordTotal > 0 ? s.stablefordTotal : <span className="text-gray-300">—</span>}
                        {s.stablefordPlayed > 0 && (
                          <span className="text-xs text-gray-400 ml-0.5">({s.stablefordCounted}/{s.stablefordQuota})</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right text-purple-700 tabular-nums">
                        {s.knockoutTotal > 0 ? s.knockoutTotal : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right text-rose-700 tabular-nums">
                        {s.trophyTotal > 0 ? s.trophyTotal : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold text-gray-900 tabular-nums">
                        {s.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-3 px-2">
                Majors: best 3 · Medals &amp; Named Events: best 4 · Stablefords: best 4 · Knockouts &amp; Trophies: all count · brackets show quota used (counted/available) · click a row for full breakdown
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Competitions (collapsed by default) ── */}
      <div>
        <button
          onClick={() => setShowComps(v => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          {showComps ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Competitions ({totalCount}
          {totalCount > 0 && completedCount > 0 && `, ${completedCount} complete`})
        </button>

        {showComps && (
          <Card className="mt-3">
            <CardContent className="pt-4 space-y-2">
              {/* Add comp button + picker */}
              <div className="flex justify-end mb-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingComp(v => !v)}
                >
                  <Plus size={14} className="mr-1.5" />
                  Add competition
                </Button>
              </div>

              {addingComp && (
                <div className="border border-border rounded-lg p-4 bg-muted/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Add competition to series</p>
                    <button onClick={() => setAddingComp(false)} className="text-muted-foreground hover:text-foreground">
                      <X size={15} />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Category</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.value}
                          onClick={() => setSelectedCategory(cat.value)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            selectedCategory === cat.value
                              ? "border-green-600 bg-green-50 text-green-800"
                              : "border-border bg-white text-muted-foreground hover:border-green-400"
                          }`}
                        >
                          {cat.label}
                          <span className="ml-1 opacity-60">{cat.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedCategory === "trophy" && (
                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPairs}
                        onChange={e => setIsPairs(e.target.checked)}
                        className="rounded"
                      />
                      Pairs event (points ÷2)
                    </label>
                  )}

                  {availableComps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No other club competitions to add.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {availableComps.map(comp => (
                        <button
                          key={comp._id}
                          onClick={() => handleAddComp(comp._id)}
                          className="w-full text-left text-sm px-3 py-2 rounded-lg border border-border bg-white hover:border-primary/50 hover:bg-accent/50 transition-all"
                        >
                          <span className="font-medium">{comp.name}</span>
                          <span className="text-muted-foreground ml-2">
                            {new Date(comp.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                            comp.status === "complete" ? "bg-purple-100 text-purple-700" :
                            comp.status === "live" ? "bg-green-100 text-green-700" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {comp.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {totalCount === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No competitions added yet.
                </p>
              ) : (
                sortedComps.filter(Boolean).map(({ link, competition }) => competition && (
                  <div key={competition._id} className="bg-white border border-gray-100 rounded-lg px-4 py-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => setEditingCompId(editingCompId === competition._id ? null : competition._id)}
                          className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLOURS[link.category] ?? "bg-gray-100 text-gray-600"} hover:opacity-80`}
                          title="Click to change category"
                        >
                          {CATEGORIES.find(c => c.value === link.category)?.label ?? link.category}
                          {link.isPairsEvent && " (pairs)"}
                        </button>
                        <span className="font-medium text-sm text-gray-900 truncate">{competition.name}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {new Date(competition.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                        {competition.status === "complete" && (
                          <span className="text-xs text-purple-600 shrink-0">✓</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <Link
                          href={competition.status === "complete"
                            ? `/manage/competitions/${competition._id}/scores`
                            : `/manage/competitions/${competition._id}`}
                          className="text-xs text-green-700 hover:underline"
                        >
                          {competition.status === "complete" ? "Results →" : "Manage →"}
                        </Link>
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove "${competition.name}" from this series?`)) return;
                            await removeCompetition({
                              seriesId: seriesId as Id<"series">,
                              competitionId: competition._id,
                            });
                          }}
                          className="text-xs text-red-400 hover:text-red-600"
                          title="Remove from series"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {editingCompId === competition._id && (
                      <div className="pt-1 border-t border-gray-50 space-y-2">
                        <p className="text-xs text-gray-500">Change category:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORIES.map(cat => (
                            <button
                              key={cat.value}
                              onClick={async () => {
                                await updateCategory({
                                  seriesId: seriesId as Id<"series">,
                                  competitionId: competition._id,
                                  category: cat.value,
                                  isPairsEvent: cat.value === "trophy" ? link.isPairsEvent : undefined,
                                });
                                setEditingCompId(null);
                              }}
                              className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                                link.category === cat.value
                                  ? "border-green-600 bg-green-50 text-green-800"
                                  : "border-border bg-white text-muted-foreground hover:border-green-400"
                              }`}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Player detail panel ── */}
      {selectedPlayer && (
        <PlayerDetailModal
          standing={selectedPlayer.standing}
          position={selectedPlayer.position}
          seriesId={seriesId}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
