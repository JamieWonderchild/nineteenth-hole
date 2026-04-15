"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Check, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";

const TEE_COLOUR_MAP: Record<string, string> = {
  white: "#f9fafb", yellow: "#fbbf24", red: "#ef4444", blue: "#3b82f6",
  black: "#111827", gold: "#d97706", silver: "#9ca3af", green: "#16a34a", other: "#6b7280",
};

type Tee = {
  _id: string; name: string; colour: string; gender: string;
  par: number; courseRating?: number; slopeRating?: number; totalYards?: number;
};

type CourseWithTees = {
  _id: string; name: string; venueName?: string; city?: string; county?: string; tees: Tee[];
};

function TeeDot({ colour }: { colour: string }) {
  return (
    <span style={{
      display: "inline-block", width: 10, height: 10, borderRadius: "50%",
      backgroundColor: TEE_COLOUR_MAP[colour] ?? TEE_COLOUR_MAP.other,
      border: "1px solid rgba(0,0,0,0.15)", flexShrink: 0,
    }} />
  );
}

export default function WebNewRoundPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCourseId = searchParams.get("courseId");

  const createRound = useMutation(api.rounds.create);
  const ensureDetail = useAction(api.golfCourses.ensureDetail);

  // ── Course search ─────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<CourseWithTees | null>(null);
  const [selectedTee, setSelectedTee] = useState<Tee | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const searchResults = useQuery(
    api.golfCourses.search,
    debouncedQuery.length >= 2 && !selectedCourse ? { query: debouncedQuery, limit: 8 } : "skip"
  );

  // Pre-load course if courseId param provided
  const preloadedCourse = useQuery(
    api.golfCourses.getWithTees,
    initialCourseId && !selectedCourse ? { courseId: initialCourseId as Id<"golfCourses"> } : "skip"
  ) as CourseWithTees | null | undefined;

  useEffect(() => {
    if (preloadedCourse && !selectedCourse) {
      setSelectedCourse(preloadedCourse);
    }
  }, [preloadedCourse]);

  // Lazy-load tees when a course is picked with no tees
  useEffect(() => {
    if (selectedCourse && selectedCourse.tees.length === 0) {
      ensureDetail({ courseId: selectedCourse._id as Id<"golfCourses"> });
    }
  }, [selectedCourse?._id]);

  // Refresh course data after tees load
  const courseWithTees = useQuery(
    api.golfCourses.getWithTees,
    selectedCourse ? { courseId: selectedCourse._id as Id<"golfCourses"> } : "skip"
  ) as CourseWithTees | null | undefined;

  const tees = courseWithTees
    ? [...(courseWithTees.tees ?? [])].sort((a, b) => {
        const ga = a.gender === "female" ? 1 : 0;
        const gb = b.gender === "female" ? 1 : 0;
        if (ga !== gb) return ga - gb;
        return (b.totalYards ?? -1) - (a.totalYards ?? -1);
      })
    : [];

  // ── Round details ─────────────────────────────────────────────────────────
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [grossScore, setGrossScore] = useState("");
  const [format, setFormat] = useState<"stableford" | "strokeplay">("stableford");
  const [skipRatings, setSkipRatings] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = (selectedCourse !== null) && (selectedTee !== null || skipRatings) && grossScore && parseInt(grossScore) >= 18;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedCourse) return;
    setSubmitting(true);
    setError("");
    try {
      await createRound({
        golfCourseId: selectedCourse._id as Id<"golfCourses">,
        ...(selectedTee ? { teeId: selectedTee._id as Id<"courseTees"> } : {}),
        courseNameFreetext: selectedCourse.name,
        tees: selectedTee?.name ?? "Unknown",
        grossScore: parseInt(grossScore),
        date,
        isCountingRound: !skipRatings,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      router.push("/home");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save round");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/home">
          <Button variant="ghost" size="icon"><ArrowLeft size={18} /></Button>
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Log a Round</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Course */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Course</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedCourse ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <div>
                  <p className="font-medium text-green-900">{selectedCourse.name}</p>
                  {(selectedCourse.city || selectedCourse.county) && (
                    <p className="text-xs text-green-700">
                      {[selectedCourse.city, selectedCourse.county].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedCourse(null); setSelectedTee(null); setQuery(""); }}
                  className="text-xs text-green-700 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search course name…"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            )}

            {/* Search results dropdown */}
            {!selectedCourse && debouncedQuery.length >= 2 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {searchResults === undefined ? (
                  <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
                ) : searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">No courses found</div>
                ) : (
                  searchResults.slice(0, 6).map((course: any) => (
                    <button
                      key={course._id}
                      type="button"
                      onClick={() => { setSelectedCourse(course); setQuery(""); }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{course.name}</p>
                        {(course.city || course.county) && (
                          <p className="text-xs text-gray-500">
                            {[course.city, course.county].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-gray-400 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Tee picker */}
            {selectedCourse && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Select Tee</Label>
                {tees.length === 0 ? (
                  <p className="text-sm text-gray-400">Loading tee data…</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                    {tees.map(tee => (
                      <button
                        key={tee._id}
                        type="button"
                        onClick={() => setSelectedTee(tee)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                          selectedTee?._id === tee._id ? "bg-green-50" : ""
                        }`}
                      >
                        <TeeDot colour={tee.colour} />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{tee.name}</span>
                          <span className="text-xs text-gray-400 ml-2 capitalize">{tee.gender}</span>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {[
                              tee.courseRating ? `CR ${tee.courseRating}` : null,
                              tee.slopeRating ? `Slope ${tee.slopeRating}` : null,
                              `Par ${tee.par}`,
                              tee.totalYards ? `${tee.totalYards} yds` : null,
                            ].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        {selectedTee?._id === tee._id && (
                          <Check size={16} className="text-green-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Round details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Round Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gross">Gross Score</Label>
                <Input
                  id="gross"
                  type="number"
                  min={18}
                  max={200}
                  placeholder="e.g. 85"
                  value={grossScore}
                  onChange={e => setGrossScore(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Format</Label>
              <div className="flex gap-2">
                {(["stableford", "strokeplay"] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
                      format === f
                        ? "border-green-600 bg-green-50 text-green-800"
                        : "border-gray-200 text-gray-600 hover:border-green-400"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="How did it go?"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={skipRatings}
                onChange={e => setSkipRatings(e.target.checked)}
                className="rounded"
              />
              Skip ratings (round won't count to handicap)
            </label>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          type="submit"
          disabled={!canSubmit || submitting}
          className="w-full bg-green-700 hover:bg-green-600 text-white"
          size="lg"
        >
          {submitting ? "Saving…" : "Save Round"}
        </Button>
      </form>
    </div>
  );
}
