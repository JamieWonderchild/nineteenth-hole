"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trophy, Calendar, DollarSign, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const PRIZE_PRESETS = [
  { label: "Winner takes all", desc: "100% to 1st", structure: [{ position: 1, percentage: 100 }] },
  { label: "60 / 30 / 10", desc: "Split top three", structure: [{ position: 1, percentage: 60 }, { position: 2, percentage: 30 }, { position: 3, percentage: 10 }] },
  { label: "55 / 30 / 15", desc: "Balanced split", structure: [{ position: 1, percentage: 55 }, { position: 2, percentage: 30 }, { position: 3, percentage: 15 }] },
  { label: "50 / 30 / 20", desc: "Wider spread", structure: [{ position: 1, percentage: 50 }, { position: 2, percentage: 30 }, { position: 3, percentage: 20 }] },
];

const TOURNAMENTS = [
  { group: "Majors 2026", items: [
    { label: "The Masters", ref: "masters-2026", start: "2026-04-09", end: "2026-04-12" },
    { label: "PGA Championship", ref: "pga-championship-2026", start: "2026-05-21", end: "2026-05-24" },
    { label: "US Open", ref: "us-open-2026", start: "2026-06-18", end: "2026-06-21" },
    { label: "The Open", ref: "the-open-2026", start: "2026-07-16", end: "2026-07-19" },
  ]},
  { group: "Other", items: [
    { label: "Tour event", ref: "tour", start: "", end: "" },
    { label: "Club competition", ref: "club_comp", start: "", end: "" },
    { label: "Custom", ref: "custom", start: "", end: "" },
  ]},
];

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

export default function NewCompetitionPage() {
  const router = useRouter();
  const { user } = useUser();

  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(api.clubs.get, adminMembership ? { clubId: adminMembership.clubId } : "skip");
  const createCompetition = useMutation(api.competitions.create);

  const [name, setName] = useState("");
  const [tournamentRef, setTournamentRef] = useState("masters-2026");
  const [startDate, setStartDate] = useState("2026-04-09");
  const [endDate, setEndDate] = useState("2026-04-12");
  const [entryDeadline, setEntryDeadline] = useState("2026-04-08T23:59");
  const [entryFeeStr, setEntryFeeStr] = useState("20");
  const [prizePreset, setPrizePreset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currency = club?.currency ?? "GBP";
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const slug = slugify(name);
  const entryFee = Math.round(parseFloat(entryFeeStr || "0") * 100);
  const platformFee = Math.round(entryFee * 0.1);

  function pickTournament(ref: string) {
    setTournamentRef(ref);
    const all = TOURNAMENTS.flatMap(g => g.items);
    const t = all.find(i => i.ref === ref);
    if (t?.start) { setStartDate(t.start); setEndDate(t.end); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!club || !user) return;
    setLoading(true);
    setError("");
    try {
      const isMajor = TOURNAMENTS[0].items.some(t => t.ref === tournamentRef);
      const compId = await createCompetition({
        clubId: club._id,
        name,
        slug,
        type: isMajor ? "major" : tournamentRef === "club_comp" ? "club_comp" : "custom",
        tournamentRef,
        startDate,
        endDate,
        entryDeadline: new Date(entryDeadline).toISOString(),
        drawType: "tiered",
        tierCount: 3,
        playersPerTier: 1,
        entryFee,
        currency,
        prizeStructure: PRIZE_PRESETS[prizePreset].structure,
        createdBy: user.id,
      });
      router.push(`/manage/competitions/${compId}`);
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

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Competition</h1>
          <p className="text-sm text-muted-foreground">{club.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Tournament picker */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10"><Trophy size={16} className="text-primary" /></div>
              <div>
                <CardTitle className="text-base">Tournament</CardTitle>
                <CardDescription>Pick the event you're pooling</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {TOURNAMENTS[0].items.map(t => (
                <button
                  key={t.ref}
                  type="button"
                  onClick={() => pickTournament(t.ref)}
                  className={cn(
                    "text-left px-4 py-3 rounded-lg border text-sm transition-all",
                    tournamentRef === t.ref
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border hover:border-primary/40 hover:bg-accent/50"
                  )}
                >
                  {t.label}
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                    {new Date(t.start).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {new Date(t.end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="comp-name">Pool name</Label>
              <Input
                id="comp-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Masters 2026 Pool"
                required
              />
              {name && (
                <p className="text-xs text-muted-foreground">
                  URL: playthepool.golf/{club.slug}/<span className="font-mono">{slug}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10"><Calendar size={16} className="text-primary" /></div>
              <div>
                <CardTitle className="text-base">Dates</CardTitle>
                <CardDescription>Tournament and entry window</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="start-date">Start date</Label>
                <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date">End date</Label>
                <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Entry deadline</Label>
              <Input id="deadline" type="datetime-local" value={entryDeadline} onChange={e => setEntryDeadline(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Draw runs automatically after this time</p>
            </div>
          </CardContent>
        </Card>

        {/* Entry fee */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign size={16} className="text-primary" /></div>
              <div>
                <CardTitle className="text-base">Entry fee</CardTitle>
                <CardDescription>What goes into the pot per player</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="entry-fee">Amount ({sym})</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{sym}</span>
                <Input
                  id="entry-fee"
                  type="number"
                  value={entryFeeStr}
                  onChange={e => setEntryFeeStr(e.target.value)}
                  min="1"
                  step="1"
                  required
                  className="pl-7"
                />
              </div>
            </div>
            {entryFee > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Entry fee (goes to pot)</span>
                  <span>{sym}{(entryFee / 100).toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Platform fee (10%)</span>
                  <span>{sym}{(platformFee / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1">
                  <span>Members pay</span>
                  <span>{sym}{((entryFee + platformFee) / 100).toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prize distribution */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10"><Users size={16} className="text-primary" /></div>
              <div>
                <CardTitle className="text-base">Prize distribution</CardTitle>
                <CardDescription>How the pot is split at the end</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {PRIZE_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrizePreset(i)}
                  className={cn(
                    "text-left px-4 py-3 rounded-lg border text-sm transition-all",
                    prizePreset === i
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border hover:border-primary/40 hover:bg-accent/50"
                  )}
                >
                  {preset.label}
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">{preset.desc}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading || !name} className="w-full" size="lg">
          {loading ? "Creating…" : "Create competition"}
        </Button>
      </form>
    </div>
  );
}
