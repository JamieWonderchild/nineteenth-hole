"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const PRIZE_PRESETS = [
  { label: "Winner takes all", structure: [{ position: 1, percentage: 100 }] },
  { label: "60/30/10", structure: [{ position: 1, percentage: 60 }, { position: 2, percentage: 30 }, { position: 3, percentage: 10 }] },
  { label: "55/30/15", structure: [{ position: 1, percentage: 55 }, { position: 2, percentage: 30 }, { position: 3, percentage: 15 }] },
  { label: "50/30/20", structure: [{ position: 1, percentage: 50 }, { position: 2, percentage: 30 }, { position: 3, percentage: 20 }] },
];

const TOURNAMENT_TYPES = [
  { value: "major", label: "Major (Masters, US Open, The Open, PGA Championship)" },
  { value: "tour", label: "Tour event" },
  { value: "ryder_cup", label: "Ryder Cup" },
  { value: "club_comp", label: "Club competition" },
  { value: "custom", label: "Custom" },
];

const TOURNAMENT_REFS: Record<string, { label: string; ref: string; start: string; end: string }[]> = {
  major: [
    { label: "The Masters 2026", ref: "masters-2026", start: "2026-04-09", end: "2026-04-12" },
    { label: "PGA Championship 2026", ref: "pga-championship-2026", start: "2026-05-21", end: "2026-05-24" },
    { label: "US Open 2026", ref: "us-open-2026", start: "2026-06-18", end: "2026-06-21" },
    { label: "The Open 2026", ref: "the-open-2026", start: "2026-07-16", end: "2026-07-19" },
  ],
};

export default function NewCompetitionPage() {
  const router = useRouter();
  const { user } = useUser();

  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(api.clubs.get, adminMembership ? { clubId: adminMembership.clubId } : "skip");

  const createCompetition = useMutation(api.competitions.create);

  const [name, setName] = useState("");
  const [type, setType] = useState("major");
  const [tournamentRef, setTournamentRef] = useState("masters-2026");
  const [startDate, setStartDate] = useState("2026-04-09");
  const [endDate, setEndDate] = useState("2026-04-12");
  const [entryDeadline, setEntryDeadline] = useState("2026-04-08T23:59");
  const [entryFee, setEntryFee] = useState("2200"); // pence
  const [prizePreset, setPrizePreset] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const slug = slugify(name);
  const currency = club?.currency ?? "GBP";
  const entryFeeDisplay = (parseInt(entryFee) / 100).toFixed(2);

  function handleTypeChange(t: string) {
    setType(t);
    const options = TOURNAMENT_REFS[t];
    if (options?.[0]) {
      setTournamentRef(options[0].ref);
      setStartDate(options[0].start);
      setEndDate(options[0].end);
    } else {
      setTournamentRef("");
    }
  }

  function handleTournamentRefChange(ref: string) {
    setTournamentRef(ref);
    const options = TOURNAMENT_REFS[type];
    const match = options?.find(o => o.ref === ref);
    if (match) {
      setStartDate(match.start);
      setEndDate(match.end);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!club || !user) return;
    setLoading(true);
    setError("");
    try {
      const compId = await createCompetition({
        clubId: club._id,
        name,
        slug,
        type,
        tournamentRef: tournamentRef || undefined,
        startDate,
        endDate,
        entryDeadline: new Date(entryDeadline).toISOString(),
        drawType: "tiered",
        tierCount: 3,
        playersPerTier: 1,
        entryFee: parseInt(entryFee),
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
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-900 text-white px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-green-300 hover:text-white text-sm">← Back</button>
        <h1 className="font-bold">New competition — {club.name}</h1>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            <h2 className="font-semibold text-gray-900">Competition details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Masters 2026 Pool"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {name && <p className="text-xs text-gray-400 mt-1">Slug: <span className="font-mono">{slug}</span></p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={type}
                onChange={e => handleTypeChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {TOURNAMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {TOURNAMENT_REFS[type] && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tournament</label>
                <select
                  value={tournamentRef}
                  onChange={e => handleTournamentRefChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {TOURNAMENT_REFS[type].map(t => (
                    <option key={t.ref} value={t.ref}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entry deadline</label>
              <input
                type="datetime-local"
                value={entryDeadline}
                onChange={e => setEntryDeadline(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            <h2 className="font-semibold text-gray-900">Financials</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entry fee ({currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}
                </span>
                <input
                  type="number"
                  value={entryFeeDisplay}
                  onChange={e => setEntryFee(String(Math.round(parseFloat(e.target.value) * 100)))}
                  min="1"
                  step="0.50"
                  required
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Prize distribution</label>
              <div className="space-y-2">
                {PRIZE_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPrizePreset(i)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${prizePreset === i ? "border-green-500 bg-green-50 text-green-800" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="text-gray-500 ml-2 text-xs">
                      {preset.structure.map(p => `${p.percentage}%`).join(" / ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name}
            className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? "Creating…" : "Create competition →"}
          </button>
        </form>
      </div>
    </div>
  );
}
