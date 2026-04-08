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

export default function SeriesDetailPage({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = use(params);
  const router = useRouter();
  const { user } = useUser();

  const series = useQuery(api.series.get, { seriesId: seriesId as Id<"series"> });
  const seriesComps = useQuery(api.series.getCompetitions, { seriesId: seriesId as Id<"series"> });

  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(api.clubs.get, adminMembership ? { clubId: adminMembership.clubId } : "skip");
  const allClubComps = useQuery(api.competitions.listByClub, club ? { clubId: club._id } : "skip");

  const addCompetition = useMutation(api.series.addCompetition);

  const [addingComp, setAddingComp] = useState(false);

  if (!series) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const seriesCompIds = new Set(seriesComps?.map(c => c?._id));
  const availableComps = (allClubComps ?? []).filter(c => !seriesCompIds.has(c._id));

  // Compute standings from entries
  // For now, show which competitions are in the series and a placeholder standings table
  const sym = series.currency === "GBP" ? "£" : series.currency === "EUR" ? "€" : "$";

  async function handleAddComp(competitionId: Id<"competitions">) {
    await addCompetition({ seriesId: seriesId as Id<"series">, competitionId });
    setAddingComp(false);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
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

      {/* Points structure */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Points structure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {series.pointsStructure.map(p => (
              <div key={p.position} className="text-center bg-muted rounded-lg px-4 py-2 min-w-[64px]">
                <div className="text-xs text-muted-foreground">
                  {p.position === 1 ? "1st" : p.position === 2 ? "2nd" : p.position === 3 ? "3rd" : `${p.position}th`}
                </div>
                <div className="font-bold text-foreground">{p.points}pts</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Competitions in this series */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Competitions ({seriesComps?.length ?? 0})
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
            <div className="border border-border rounded-lg p-3 bg-muted/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Add competition to series</p>
                <button onClick={() => setAddingComp(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={15} />
                </button>
              </div>
              {availableComps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No other club competitions to add.</p>
              ) : (
                <div className="space-y-1.5">
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
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* List */}
          {(seriesComps ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No competitions added yet — add your club&apos;s events to start tracking points.
            </p>
          ) : (
            (seriesComps ?? []).filter(Boolean).map(comp => comp && (
              <div key={comp._id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-2.5">
                <div>
                  <span className="font-medium text-sm text-gray-900">{comp.name}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {new Date(comp.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <Link
                  href={`/manage/competitions/${comp._id}`}
                  className="text-xs text-green-700 hover:underline"
                >
                  Manage →
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Standings placeholder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Season standings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Standings are calculated automatically once competitions complete.
            Points are awarded per the structure above based on each member&apos;s finishing position.
          </p>
          {(seriesComps ?? []).length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {(seriesComps ?? []).filter(c => c?.status === "complete").length} of {(seriesComps ?? []).length} competitions complete
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
