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
import { ArrowLeft, Globe, Calendar, DollarSign, Users } from "lucide-react";
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
  { group: "2026 Majors", items: [
    { label: "The Masters", ref: "masters-2026", start: "2026-04-09", end: "2026-04-12", slug: "masters-2026" },
    { label: "PGA Championship", ref: "pga-championship-2026", start: "2026-05-21", end: "2026-05-24", slug: "pga-championship-2026" },
    { label: "US Open", ref: "us-open-2026", start: "2026-06-18", end: "2026-06-21", slug: "us-open-2026" },
    { label: "The Open", ref: "the-open-2026", start: "2026-07-16", end: "2026-07-19", slug: "the-open-2026" },
  ]},
  { group: "Other", items: [
    { label: "Ryder Cup 2026", ref: "ryder-cup-2026", start: "2026-09-25", end: "2026-09-27", slug: "ryder-cup-2026" },
    { label: "Custom event", ref: "custom", start: "", end: "", slug: "" },
  ]},
];

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

export default function NewPlatformPoolPage() {
  const router = useRouter();
  const { user } = useUser();
  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const createPool = useMutation(api.competitions.createPlatformPool);

  const [name, setName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [description, setDescription] = useState("");
  const [tournamentRef, setTournamentRef] = useState("masters-2026");
  const [startDate, setStartDate] = useState("2026-04-09");
  const [endDate, setEndDate] = useState("2026-04-12");
  const [entryDeadline, setEntryDeadline] = useState("2026-04-08T23:59");
  const [currency, setCurrency] = useState("GBP");
  const [entryFeeStr, setEntryFeeStr] = useState("20");
  const [prizePreset, setPrizePreset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const autoSlug = slugify(name) || (TOURNAMENTS.flatMap(g => g.items).find(t => t.ref === tournamentRef)?.slug ?? "");
  const slug = customSlug || autoSlug;
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
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const isMajor = TOURNAMENTS[0].items.some(t => t.ref === tournamentRef);
      const fallbackName = TOURNAMENTS.flatMap(g => g.items).find(t => t.ref === tournamentRef)?.label ?? "Pool";
      const compId = await createPool({
        name: name || fallbackName,
        slug,
        description: description || undefined,
        type: isMajor ? "major" : tournamentRef === "ryder-cup-2026" ? "ryder_cup" : "custom",
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
      router.push(`/manage/pools/${compId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (superAdmin === false) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Super admin only</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Globe size={18} className="text-green-600" />
            New Platform Pool
          </h1>
          <p className="text-sm text-muted-foreground">Open to all users on the platform</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Tournament picker */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10"><Globe size={16} className="text-primary" /></div>
              <div>
                <CardTitle className="text-base">Tournament</CardTitle>
                <CardDescription>Which event is this pool for?</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {TOURNAMENTS.map(group => (
              <div key={group.group}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.group}</p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map(t => (
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
                      {t.start && (
                        <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                          {new Date(t.start).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {new Date(t.end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="space-y-3 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <Label>Pool name</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Masters 2026 Pool"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Pick your players before first tee Thursday"
                />
              </div>
              <div className="space-y-1.5">
                <Label>URL slug</Label>
                <Input
                  value={customSlug}
                  onChange={e => setCustomSlug(e.target.value)}
                  placeholder={autoSlug}
                />
                <p className="text-xs text-muted-foreground">
                  Pool URL: playthepool.golf/pools/<span className="font-mono">{slug}</span>
                </p>
              </div>
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
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[{ id: "GBP", sym: "£" }, { id: "EUR", sym: "€" }, { id: "USD", sym: "$" }].map(c => (
                <button key={c.id} type="button"
                  onClick={() => setCurrency(c.id)}
                  className={cn("py-2 rounded-lg border text-sm font-medium transition-all",
                    currency === c.id ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"
                  )}>
                  {c.sym} {c.id}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Entry deadline</Label>
              <Input type="datetime-local" value={entryDeadline} onChange={e => setEntryDeadline(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Draw runs after this — set to just before first tee</p>
            </div>
          </CardContent>
        </Card>

        {/* Entry fee */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign size={16} className="text-primary" /></div>
              <CardTitle className="text-base">Entry fee</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount ({sym})</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{sym}</span>
                <Input
                  type="number"
                  value={entryFeeStr}
                  onChange={e => setEntryFeeStr(e.target.value)}
                  min="0"
                  step="1"
                  className="pl-7"
                />
              </div>
            </div>
            {entryFee > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Entry fee (to pot)</span>
                  <span>{sym}{(entryFee / 100).toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Platform fee (10%)</span>
                  <span>{sym}{(platformFee / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1 mt-1">
                  <span>Users pay</span>
                  <span>{sym}{((entryFee + platformFee) / 100).toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prize structure */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10"><Users size={16} className="text-primary" /></div>
              <CardTitle className="text-base">Prize distribution</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {PRIZE_PRESETS.map((preset, i) => (
                <button key={i} type="button" onClick={() => setPrizePreset(i)}
                  className={cn("text-left px-4 py-3 rounded-lg border text-sm transition-all",
                    prizePreset === i ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-primary/40 hover:bg-accent/50"
                  )}>
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

        <Button type="submit" disabled={loading || !slug} className="w-full" size="lg">
          {loading ? "Creating…" : "Create platform pool"}
        </Button>
      </form>
    </div>
  );
}
