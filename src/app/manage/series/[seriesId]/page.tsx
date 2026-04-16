"use client";

import { useState, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, X } from "lucide-react";
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

  const [addingComp, setAddingComp] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("stableford");
  const [isPairs, setIsPairs] = useState(false);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);

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

      {/* Competitions in this series */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Competitions ({totalCount})
              {totalCount > 0 && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  {completedCount} complete
                </span>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingComp(v => !v)}
            >
              <Plus size={14} className="mr-1.5" />
              Add competition
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Picker */}
          {addingComp && (
            <div className="border border-border rounded-lg p-4 bg-muted/40 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Add competition to series</p>
                <button onClick={() => setAddingComp(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={15} />
                </button>
              </div>

              {/* Category selector */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Category
                </label>
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

              {/* Pairs toggle (Trophy only) */}
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

              {/* Competition list */}
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

          {/* Competition list */}
          {totalCount === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No competitions added yet — add your club&apos;s events to start tracking points.
            </p>
          ) : (
            (compsWithLinks ?? []).filter(Boolean).map(({ link, competition }) => competition && (
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
                  <Link
                    href={competition.status === "complete"
                      ? `/manage/competitions/${competition._id}/scores`
                      : `/manage/competitions/${competition._id}`}
                    className="text-xs text-green-700 hover:underline shrink-0 ml-3"
                  >
                    {competition.status === "complete" ? "Results →" : "Manage →"}
                  </Link>
                </div>

                {/* Inline category editor */}
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

      {/* Season standings */}
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
                    <tr key={s.userId} className={`border-b border-gray-50 last:border-0 ${i === 0 ? "bg-amber-50/50" : ""}`}>
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
                Majors: best 3 · Medals &amp; Named Events: best 4 · Stablefords: best 4 · Knockouts &amp; Trophies: all count · brackets show quota used (counted/available)
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
