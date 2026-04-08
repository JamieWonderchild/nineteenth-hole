"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, X } from "lucide-react";

const DEFAULT_POINTS = [
  { position: 1, points: 10 },
  { position: 2, points: 8 },
  { position: 3, points: 6 },
  { position: 4, points: 5 },
  { position: 5, points: 4 },
  { position: 6, points: 3 },
  { position: 7, points: 2 },
  { position: 8, points: 1 },
];

const POINTS_PRESETS = [
  { label: "10-8-6-5-4-3-2-1", points: DEFAULT_POINTS },
  { label: "5-4-3-2-1", points: [
    { position: 1, points: 5 },
    { position: 2, points: 4 },
    { position: 3, points: 3 },
    { position: 4, points: 2 },
    { position: 5, points: 1 },
  ]},
  { label: "Winner only", points: [{ position: 1, points: 1 }] },
];

export default function NewSeriesPage() {
  const router = useRouter();
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(api.clubs.get, adminMembership ? { clubId: adminMembership.clubId } : "skip");
  const createSeries = useMutation(api.series.create);

  const currentYear = new Date().getFullYear().toString();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [season, setSeason] = useState(currentYear);
  const [prizePoolStr, setPrizePoolStr] = useState("");
  const [pointsStructure, setPointsStructure] = useState(DEFAULT_POINTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addPosition() {
    const nextPos = pointsStructure.length + 1;
    const lastPoints = pointsStructure[pointsStructure.length - 1]?.points ?? 1;
    setPointsStructure(prev => [...prev, { position: nextPos, points: Math.max(1, lastPoints - 1) }]);
  }

  function removePosition(i: number) {
    setPointsStructure(prev => prev.filter((_, idx) => idx !== i));
  }

  function updatePoints(i: number, value: string) {
    setPointsStructure(prev => prev.map((p, idx) => idx === i ? { ...p, points: parseInt(value) || 0 } : p));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!club) return;
    setLoading(true);
    setError("");
    try {
      const seriesId = await createSeries({
        clubId: club._id,
        name,
        description: description || undefined,
        season,
        pointsStructure,
        prizePool: prizePoolStr ? Math.round(parseFloat(prizePoolStr) * 100) : undefined,
        currency: club.currency,
      });
      router.push(`/manage/series/${seriesId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const sym = club.currency === "GBP" ? "£" : club.currency === "EUR" ? "€" : "$";

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Season Series</h1>
          <p className="text-sm text-muted-foreground">{club.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Series details</CardTitle>
            <CardDescription>e.g. Race to Swinley Forest 2026</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Series name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Race to Swinley Forest 2026"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Top points scorer after all 6 events wins a trip to Swinley Forest"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Season year</Label>
                <Input
                  value={season}
                  onChange={e => setSeason(e.target.value)}
                  placeholder={currentYear}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prize pool (optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{sym}</span>
                  <Input
                    type="number"
                    value={prizePoolStr}
                    onChange={e => setPrizePoolStr(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Points structure</CardTitle>
            <CardDescription>Points awarded per finishing position in each competition</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              {POINTS_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setPointsStructure(preset.points)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all font-medium text-muted-foreground"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Points editor */}
            <div className="space-y-2">
              {pointsStructure.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-16 shrink-0">
                    {i + 1 === 1 ? "1st" : i + 1 === 2 ? "2nd" : i + 1 === 3 ? "3rd" : `${i + 1}th`}
                  </span>
                  <Input
                    type="number"
                    value={p.points}
                    onChange={e => updatePoints(i, e.target.value)}
                    min="0"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">pts</span>
                  {pointsStructure.length > 1 && (
                    <button type="button" onClick={() => removePosition(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={addPosition} className="text-muted-foreground mt-1">
                <Plus size={14} className="mr-1.5" />
                Add position
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading || !name} className="w-full" size="lg">
          {loading ? "Creating…" : "Create series"}
        </Button>
      </form>
    </div>
  );
}
