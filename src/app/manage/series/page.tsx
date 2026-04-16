"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Id } from "convex/_generated/dataModel";

function NewSeriesModal({
  open,
  onClose,
  clubId,
  clubCurrency,
}: {
  open: boolean;
  onClose: () => void;
  clubId: Id<"clubs">;
  clubCurrency: string;
}) {
  const createSeries = useMutation(api.series.create);
  const currentYear = new Date().getFullYear().toString();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [season, setSeason] = useState(currentYear);
  const [prizePoolStr, setPrizePoolStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sym = clubCurrency === "GBP" ? "£" : clubCurrency === "EUR" ? "€" : "$";

  function resetAndClose() {
    setName("");
    setDescription("");
    setSeason(currentYear);
    setPrizePoolStr("");
    setError("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await createSeries({
        clubId,
        name: name.trim(),
        description: description.trim() || undefined,
        season,
        pointsStructure: [],
        prizePool: prizePoolStr ? Math.round(parseFloat(prizePoolStr) * 100) : undefined,
        currency: clubCurrency,
      });
      resetAndClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) resetAndClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy size={16} className="text-green-700" />
            New Season Series
          </DialogTitle>
          <DialogDescription>
            Create a cumulative series across multiple competitions
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="series-name">Series name</Label>
            <Input
              id="series-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Race to Swinley Forest 2026"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="series-description">Description (optional)</Label>
            <Input
              id="series-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Top points scorer after all 6 events wins a trip to Swinley Forest"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="series-season">Season year</Label>
              <Input
                id="series-season"
                value={season}
                onChange={e => setSeason(e.target.value)}
                placeholder={currentYear}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="series-prize">Prize pool (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{sym}</span>
                <Input
                  id="series-prize"
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

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={resetAndClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating…" : "Create series"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SeriesListPage() {
  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const { activeMembership, club } = useActiveClub();
  const isAdmin = activeMembership?.role === "admin" || superAdmin === true;
  const seriesList = useQuery(api.series.listByClub, club ? { clubId: club._id } : "skip");
  const [modalOpen, setModalOpen] = useState(false);

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Trophy size={22} className="text-green-700" />
            Season Series
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Cumulative competitions — like the Race to Swinley Forest
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
          >
            <Plus size={16} />
            New series
          </button>
        )}
      </div>

      <NewSeriesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clubId={club._id}
        clubCurrency={club.currency}
      />

      {seriesList === undefined ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : seriesList.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-gray-500 mb-4">No season series yet</p>
          {isAdmin && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-green-700 font-medium hover:underline"
            >
              Create your first series →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {seriesList.map(s => (
            <Link
              key={s._id}
              href={`/manage/series/${s._id}`}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900">{s.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    s.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {s.status === "active" ? "Active" : "Complete"}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Season {s.season}
                  {s.prizePool && ` · ${(s.prizePool / 100).toFixed(0)} ${s.currency} prize pool`}
                </p>
              </div>
              <span className="text-sm text-green-700 font-medium">{isAdmin ? "Manage →" : "View →"}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
