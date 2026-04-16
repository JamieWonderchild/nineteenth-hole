"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Globe, Trophy, Users, DollarSign, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Constants ────────────────────────────────────────────────────────────────

const COMP_TYPES = [
  {
    id: "pick",
    icon: "🏌️",
    label: "Pick Your Team",
    desc: "Each person picks 5 golfers + 1 reserve. Scored by accumulated prize money. Perfect for the Masters.",
  },
  {
    id: "sweep",
    icon: "🎰",
    label: "Club Sweep",
    desc: "Members draw a professional golfer randomly. Best player wins the pot. Works great for any major.",
  },
  {
    id: "event",
    icon: "⛳",
    label: "Club Event",
    desc: "Formal club competition — stroke play, stableford, betterball. Admin enters member scores manually.",
  },
];

const SWEEP_TOURNAMENTS = [
  { label: "The Masters", ref: "masters-2026", start: "2026-04-10", end: "2026-04-13" },
  { label: "PGA Championship", ref: "pga-championship-2026", start: "2026-05-21", end: "2026-05-24" },
  { label: "US Open", ref: "us-open-2026", start: "2026-06-18", end: "2026-06-21" },
  { label: "The Open", ref: "the-open-2026", start: "2026-07-16", end: "2026-07-19" },
  { label: "Ryder Cup", ref: "ryder-cup-2026", start: "2026-09-25", end: "2026-09-27" },
  { label: "Other tour event", ref: "tour", start: "", end: "" },
  { label: "Custom", ref: "custom", start: "", end: "" },
];

const EVENT_FORMATS = [
  { id: "strokeplay", label: "Stroke play", desc: "Lowest gross score wins" },
  { id: "stableford", label: "Stableford", desc: "Points system, highest wins" },
  { id: "betterball", label: "Betterball", desc: "Pairs — best ball counts" },
  { id: "matchplay", label: "Match play", desc: "Hole-by-hole scoring" },
  { id: "custom", label: "Custom", desc: "Define your own format" },
];

const PRIZE_PRESETS = [
  { label: "Winner takes all", structure: [{ position: 1, percentage: 100 }] },
  { label: "60 / 30 / 10", structure: [{ position: 1, percentage: 60 }, { position: 2, percentage: 30 }, { position: 3, percentage: 10 }] },
  { label: "55 / 30 / 15", structure: [{ position: 1, percentage: 55 }, { position: 2, percentage: 30 }, { position: 3, percentage: 15 }] },
  { label: "50 / 30 / 20", structure: [{ position: 1, percentage: 50 }, { position: 2, percentage: 30 }, { position: 3, percentage: 20 }] },
];

const CURRENCY_SYM: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };

// ── Wizard steps ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: "type", label: "Format" },
  { id: "details", label: "Details" },
  { id: "money", label: "Entry & prizes" },
  { id: "review", label: "Review" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewCompetitionPage() {
  const router = useRouter();
  const { user } = useUser();

  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(api.clubs.get, adminMembership ? { clubId: adminMembership.clubId } : "skip");
  const courses = useQuery(api.courses.listByClub, club ? { clubId: club._id } : "skip");
  const createCompetition = useMutation(api.competitions.create);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [compType, setCompType] = useState<"pick" | "sweep" | "event">("pick");

  // Step 2 — Sweep
  const [tournamentRef, setTournamentRef] = useState("pga-championship-2026");
  const [sweepName, setSweepName] = useState("");
  const [sweepStart, setSweepStart] = useState("2026-05-21");
  const [sweepEnd, setSweepEnd] = useState("2026-05-24");

  // Step 2 — Event
  const [eventName, setEventName] = useState("");
  const [eventFormat, setEventFormat] = useState("stableford");
  const [eventStartDate, setEventStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventEndDate, setEventEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [roundHoles, setRoundHoles] = useState<9 | 18>(18);

  // Step 3 — Money & dates
  const [entryFeeStr, setEntryFeeStr] = useState("10");
  const [entryDeadline, setEntryDeadline] = useState("");
  const [prizePreset, setPrizePreset] = useState(0);
  const [paymentCollection, setPaymentCollection] = useState<"stripe" | "cash">("cash");

  // Submission
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Derived ─────────────────────────────────────────────────────────────────
  const sym = CURRENCY_SYM[club?.currency ?? "GBP"] ?? "£";
  const entryFee = Math.round(parseFloat(entryFeeStr || "0") * 100);
  const platformFee = Math.round(entryFee * 0.1);

  const name = compType === "event"
    ? eventName
    : (sweepName || (SWEEP_TOURNAMENTS.find(t => t.ref === tournamentRef)?.label ?? ""));
  const slug = slugify(name);
  const startDate = compType === "event" ? eventStartDate : sweepStart;
  const endDate = compType === "event" ? eventEndDate : sweepEnd;
  const displayDeadline = entryDeadline
    ? new Date(entryDeadline).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

  // Loading / access guard
  if (memberships === undefined || superAdmin === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!adminMembership) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-muted-foreground">You need to be a club admin to create competitions.</p>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  function canAdvance(): boolean {
    if (step === 0) return true;
    if (step === 1) {
      if (compType === "event") return eventName.trim().length > 0 && !!eventStartDate && !!eventEndDate;
      // sweep or pick — need tournament dates + a name source
      return (sweepName.trim().length > 0 || !!SWEEP_TOURNAMENTS.find(t => t.ref === tournamentRef)?.label) && sweepStart.length > 0 && sweepEnd.length > 0;
    }
    if (step === 2) return entryFee >= 0 && !!entryDeadline && (compType === "event" || sweepStart.length > 0);
    return true;
  }

  async function handleCreate() {
    if (!club || !user) return;
    setLoading(true);
    setError("");
    try {
      const isMajorRef = ["masters-2026", "pga-championship-2026", "us-open-2026", "the-open-2026", "ryder-cup-2026"].includes(tournamentRef);
      const today = new Date().toISOString().split("T")[0];
      const compId = await createCompetition({
        clubId: club._id,
        name,
        slug,
        type: compType === "event" ? "club_comp" : (isMajorRef ? "major" : "tour"),
        tournamentRef: compType !== "event" ? tournamentRef : undefined,
        startDate: compType === "event" ? eventStartDate : sweepStart,
        endDate: compType === "event" ? eventEndDate : sweepEnd,
        entryDeadline: new Date(entryDeadline || (compType === "event" ? eventStartDate : sweepStart)).toISOString(),
        drawType: compType === "pick" ? "pick" : compType === "sweep" ? "tiered" : "random",
        tierCount: compType === "sweep" ? 3 : 0,
        playersPerTier: compType === "sweep" ? 1 : 0,
        pickCount: compType === "pick" ? 5 : undefined,
        reserveCount: compType === "pick" ? 1 : undefined,
        entryFee,
        currency: club.currency,
        prizeStructure: PRIZE_PRESETS[prizePreset].structure,
        paymentCollection,
        scoringFormat: compType === "event" ? eventFormat : undefined,
        courseId: (compType === "event" && selectedCourseId) ? selectedCourseId as any : undefined,
        roundHoles: compType === "event" ? roundHoles : undefined,
        createdBy: user.id,
      });
      router.push(`/manage/competitions/${compId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-8">

      {/* Back + title */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Competition</h1>
          <p className="text-sm text-muted-foreground">{club.name}</p>
        </div>
      </div>

      {/* Super admin banner */}
      {superAdmin && (
        <div className="mb-6 flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Globe size={16} className="text-green-700" />
            <span className="text-sm font-medium text-green-900">Platform-wide pools</span>
            <span className="text-sm text-green-700">(Masters, US Open, The Open — open to all users)</span>
          </div>
          <Link href="/manage/pools/new" className="text-sm font-semibold text-green-700 hover:text-green-600 whitespace-nowrap">
            Create pool →
          </Link>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-10">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                i < step ? "bg-primary border-primary text-primary-foreground" :
                i === step ? "border-primary text-primary" :
                "border-muted text-muted-foreground"
              )}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={cn("text-xs mt-1.5 font-medium",
                i === step ? "text-foreground" : "text-muted-foreground"
              )}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-0.5 flex-1 -mt-5", i < step ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Format ── */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">What are you running?</h2>
            <p className="text-sm text-muted-foreground">
              Choose the type of competition for {club.name}.
            </p>
          </div>

          <div className="space-y-3">
            {COMP_TYPES.map(ct => (
              <button
                key={ct.id}
                type="button"
                onClick={() => setCompType(ct.id as "pick" | "sweep" | "event")}
                className={cn(
                  "w-full text-left px-5 py-4 rounded-xl border-2 transition-all",
                  compType === ct.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-accent/30"
                )}
              >
                <div className="flex items-start gap-4">
                  <span className="text-2xl mt-0.5">{ct.icon}</span>
                  <div>
                    <p className={cn("font-semibold", compType === ct.id ? "text-primary" : "text-foreground")}>
                      {ct.label}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">{ct.desc}</p>
                  </div>
                  <div className={cn(
                    "ml-auto w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center",
                    compType === ct.id ? "border-primary bg-primary" : "border-muted"
                  )}>
                    {compType === ct.id && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {compType === "pick" && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
              <strong>Pick Your Team:</strong> each member picks 5 golfers + 1 reserve. Most accumulated prize money on Sunday night wins the pot. Multiple teams per person allowed — £20 a team.
            </div>
          )}
          {compType === "sweep" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
              <strong>Club sweep:</strong> members draw a pro golfer, ESPN scores update automatically. Works for any tour event your club wants to pool on.
            </div>
          )}
          {compType === "event" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <strong>Club event:</strong> you enter member scores manually after the round. Perfect for your monthly medal, the Ward, or any club competition.
            </div>
          )}

          <Button className="w-full" size="lg" onClick={() => setStep(1)}>
            Continue <ArrowRight size={16} className="ml-1.5" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Details — Pick Your Team ── */}
      {step === 1 && compType === "pick" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Which tournament?</h2>
            <p className="text-sm text-muted-foreground">
              Members will pick 5 golfers from this field. Scored by prize money earned on Sunday.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {SWEEP_TOURNAMENTS.map(t => (
              <button
                key={t.ref}
                type="button"
                onClick={() => {
                  setTournamentRef(t.ref);
                  if (t.start) { setSweepStart(t.start); setSweepEnd(t.end); }
                }}
                className={cn(
                  "text-left px-4 py-3 rounded-xl border transition-all",
                  tournamentRef === t.ref
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:border-primary/40 hover:bg-accent/40"
                )}
              >
                <p className="text-sm font-medium">{t.label}</p>
                {t.start && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(t.start).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {" – "}
                    {new Date(t.end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-4 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label>Pool name</Label>
              <Input
                value={sweepName}
                onChange={e => setSweepName(e.target.value)}
                placeholder={SWEEP_TOURNAMENTS.find(t => t.ref === tournamentRef)?.label ?? "Pool name"}
              />
            </div>
            {(!["masters-2026", "pga-championship-2026", "us-open-2026", "the-open-2026", "ryder-cup-2026"].includes(tournamentRef)) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input type="date" value={sweepStart} onChange={e => setSweepStart(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input type="date" value={sweepEnd} onChange={e => setSweepEnd(e.target.value)} required />
                </div>
              </div>
            )}
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
            You&apos;ll load the player field from the manage page after creating. Members pick their team when entries open.
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Back</Button>
            <Button className="flex-1" onClick={() => setStep(2)} disabled={!canAdvance()}>
              Continue <ArrowRight size={16} className="ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Details ── */}
      {step === 1 && compType === "sweep" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Which tournament?</h2>
            <p className="text-sm text-muted-foreground">
              Pick the event your club is pooling on. Scores sync automatically from ESPN.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {SWEEP_TOURNAMENTS.map(t => (
              <button
                key={t.ref}
                type="button"
                onClick={() => {
                  setTournamentRef(t.ref);
                  if (t.start) { setSweepStart(t.start); setSweepEnd(t.end); }
                }}
                className={cn(
                  "text-left px-4 py-3 rounded-xl border transition-all",
                  tournamentRef === t.ref
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:border-primary/40 hover:bg-accent/40"
                )}
              >
                <p className="text-sm font-medium">{t.label}</p>
                {t.start && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(t.start).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {" – "}
                    {new Date(t.end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-4 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label>Pool name</Label>
              <Input
                value={sweepName}
                onChange={e => setSweepName(e.target.value)}
                placeholder={SWEEP_TOURNAMENTS.find(t => t.ref === tournamentRef)?.label ?? "Pool name"}
              />
            </div>
            {(!["pga-championship-2026", "us-open-2026", "the-open-2026", "ryder-cup-2026"].includes(tournamentRef)) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input type="date" value={sweepStart} onChange={e => setSweepStart(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input type="date" value={sweepEnd} onChange={e => setSweepEnd(e.target.value)} required />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Back</Button>
            <Button className="flex-1" onClick={() => setStep(2)} disabled={!canAdvance()}>
              Continue <ArrowRight size={16} className="ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {step === 1 && compType === "event" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Competition details</h2>
            <p className="text-sm text-muted-foreground">Name it, pick the date, and choose the scoring format.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Competition name</Label>
            <Input
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              placeholder="e.g. The Ward 2026, April Medal, Club Championship"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date of round</Label>
              <Input type="date" value={eventStartDate} onChange={e => { setEventStartDate(e.target.value); setEventEndDate(e.target.value); }} required />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" value={eventEndDate} min={eventStartDate} onChange={e => setEventEndDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Format</Label>
            <div className="space-y-2">
              {EVENT_FORMATS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setEventFormat(f.id)}
                  className={cn(
                    "w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border transition-all",
                    eventFormat === f.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-accent/30"
                  )}
                >
                  <div>
                    <p className={cn("text-sm font-medium", eventFormat === f.id ? "text-primary" : "text-foreground")}>
                      {f.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 shrink-0",
                    eventFormat === f.id ? "border-primary bg-primary" : "border-muted"
                  )} />
                </button>
              ))}
            </div>
          </div>

          {/* Course selection */}
          {courses && courses.length > 0 && (
            <div className="space-y-2">
              <Label>Course <span className="text-muted-foreground font-normal">(optional — enables auto stableford calc)</span></Label>
              <div className="grid gap-2">
                {[{ _id: "", name: "None" }, ...courses].map(c => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => setSelectedCourseId(c._id)}
                    className={cn(
                      "text-left flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-all",
                      selectedCourseId === c._id
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border hover:border-primary/30"
                    )}
                  >
                    {c.name}
                    {selectedCourseId === c._id && <div className="w-3 h-3 rounded-full bg-primary" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Round holes */}
          <div className="flex items-center gap-3">
            <Label className="shrink-0">Round</Label>
            {([18, 9] as const).map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setRoundHoles(h)}
                className={cn(
                  "px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                  roundHoles === h ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                )}
              >
                {h} holes
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>Back</Button>
            <Button className="flex-1" onClick={() => setStep(2)} disabled={!canAdvance()}>
              Continue <ArrowRight size={16} className="ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Money ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Entry fee & prizes</h2>
            <p className="text-sm text-muted-foreground">Set how much it costs to enter and how the pot splits.</p>
          </div>

          {/* Entry deadline */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-muted-foreground" />
              <Label>Entry deadline</Label>
            </div>
            <Input
              type="datetime-local"
              value={entryDeadline}
              onChange={e => setEntryDeadline(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {compType === "sweep" ? "Draw runs automatically after this." : "When entries close."}
            </p>
          </div>

          {/* Entry fee */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <DollarSign size={15} className="text-muted-foreground" />
              <Label>Entry fee ({sym})</Label>
            </div>
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
            {entryFee > 0 && paymentCollection === "stripe" && (
              <div className="rounded-lg bg-muted px-3 py-2 text-sm space-y-1 mt-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Entry fee (goes to pot)</span>
                  <span>{sym}{(entryFee / 100).toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Platform fee (10%)</span>
                  <span>{sym}{(platformFee / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1">
                  <span>Members pay</span>
                  <span>{sym}{((entryFee + platformFee) / 100).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Payment collection */}
          {entryFee > 0 && (
            <div className="space-y-1.5">
              <Label>How do you collect payment?</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "cash", label: "Cash / offline", desc: "Members register interest. You mark them as paid manually." },
                  { id: "stripe", label: "Online (Stripe)", desc: "Members pay instantly via card. Money goes to your Stripe account." },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentCollection(opt.id)}
                    className={cn(
                      "text-left px-4 py-3 rounded-xl border transition-all",
                      paymentCollection === opt.id
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border hover:border-primary/40 hover:bg-accent/40"
                    )}
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground font-normal mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prize structure */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-muted-foreground" />
              <Label>Prize split</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRIZE_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrizePreset(i)}
                  className={cn(
                    "text-left px-4 py-3 rounded-xl border text-sm transition-all",
                    prizePreset === i
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border hover:border-primary/40 hover:bg-accent/40"
                  )}
                >
                  {preset.label}
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                    {preset.structure.map(p => `${p.position}st ${p.percentage}%`).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
            <Button className="flex-1" onClick={() => setStep(3)} disabled={!canAdvance()}>
              Review <ArrowRight size={16} className="ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Review ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Review & create</h2>
            <p className="text-sm text-muted-foreground">Confirm the details before going live.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {[
              { icon: <Trophy size={15} />, label: "Competition", value: name || "—" },
              { icon: <Trophy size={15} />, label: "Type", value: compType === "pick" ? `Pick Your Team · ${SWEEP_TOURNAMENTS.find(t => t.ref === tournamentRef)?.label ?? tournamentRef}` : compType === "sweep" ? `Club Sweep · ${SWEEP_TOURNAMENTS.find(t => t.ref === tournamentRef)?.label ?? tournamentRef}` : `Club Event · ${EVENT_FORMATS.find(f => f.id === eventFormat)?.label ?? eventFormat}` },
              ...(compType === "pick" ? [
                { icon: <Trophy size={15} />, label: "Format", value: "5 picks + 1 reserve · most prize money wins" },
                { icon: <Calendar size={15} />, label: "Dates", value: `${new Date(sweepStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(sweepEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` },
              ] : []),
              ...(compType === "sweep" ? [{ icon: <Calendar size={15} />, label: "Dates", value: `${new Date(sweepStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(sweepEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` }] : []),
              { icon: <Calendar size={15} />, label: "Entry deadline", value: displayDeadline },
              { icon: <DollarSign size={15} />, label: "Entry fee", value: entryFee > 0 ? `${sym}${(entryFee / 100).toFixed(0)} · ${paymentCollection === "cash" ? "cash collection" : `+ ${sym}${(platformFee / 100).toFixed(2)} fee online`}` : "Free" },
              { icon: <Users size={15} />, label: "Prize split", value: PRIZE_PRESETS[prizePreset].label },
              { icon: <Globe size={15} />, label: "URL", value: `/${club.slug}/${slug}` },
            ].map(row => (
              <div key={row.label} className="flex items-start gap-3 px-5 py-3">
                <span className="text-muted-foreground mt-0.5 shrink-0">{row.icon}</span>
                <span className="text-sm text-muted-foreground w-32 shrink-0">{row.label}</span>
                <span className="text-sm font-medium text-foreground">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Competition will be created as <strong>Draft</strong>. Open it for entries from the management page when you&apos;re ready.
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
            <Button className="flex-1" size="lg" onClick={handleCreate} disabled={loading || !name || !slug}>
              {loading ? "Creating…" : "Create competition"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
