"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Search, ChevronLeft, CheckCircle, Trophy, Flag, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Competition = {
  _id: Id<"competitions">;
  name: string;
  scoringFormat?: string;
  courseId?: Id<"courses">;
  roundHoles?: number;
};

type FoundMember = {
  _id: Id<"clubMembers">;
  displayName: string;
  fgcMemberId?: string;
  accountBalance: number;
  avatarUrl?: string;
  handicap?: number;
};

type CourseHole = {
  number: number;
  par: number;
  strokeIndex: number;
};

type HoleScore = { hole: number; gross: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

function holeStableford(gross: number, par: number, si: number, handicap: number): number {
  const shots = Math.floor(handicap / 18) + (si <= handicap % 18 ? 1 : 0);
  return Math.max(0, par - (gross - shots) + 2);
}

const FORMAT_LABEL: Record<string, string> = {
  stableford: "Stableford",
  strokeplay: "Stroke Play",
  betterball: "Betterball",
  matchplay: "Match Play",
};

// ── Sub-screens ───────────────────────────────────────────────────────────────

function CompetitionScreen({
  clubId,
  onSelect,
}: {
  clubId: Id<"clubs">;
  onSelect: (c: Competition) => void;
}) {
  const comps = useQuery(api.competitions.listActiveForClub, { clubId });

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-10 pb-6 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
            <Flag size={20} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Score Entry</h1>
        </div>
        <p className="text-gray-400 text-lg mt-1">Select today's competition</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {!comps ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
          </div>
        ) : comps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Trophy size={40} className="text-gray-700 mb-4" />
            <p className="text-gray-400 text-xl">No competitions open today</p>
            <p className="text-gray-600 mt-2">Ask a member of staff for help</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {comps.map(c => (
              <button
                key={c._id}
                onClick={() => onSelect(c as Competition)}
                className="text-left p-6 rounded-2xl bg-gray-800 border-2 border-gray-700 hover:border-green-500 active:scale-95 transition-all"
              >
                <p className="text-xl font-bold text-white leading-tight">{c.name}</p>
                <p className="text-green-400 mt-2 font-medium">
                  {FORMAT_LABEL[c.scoringFormat ?? ""] ?? c.scoringFormat ?? "Club competition"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberScreen({
  clubId,
  onSelect,
  onBack,
}: {
  clubId: Id<"clubs">;
  onSelect: (m: FoundMember) => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useQuery(
    api.memberAccounts.searchMembers,
    search.trim().length >= 2 ? { clubId, search } : "skip"
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 pt-10 pb-6 shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={32} />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-white">Who are you?</h2>
          <p className="text-gray-400 mt-1">Search by name or membership number</p>
        </div>
      </div>

      {/* Search */}
      <div className="px-8 pb-6 shrink-0">
        <div className="relative">
          <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Start typing your name…"
            className="w-full bg-gray-800 border-2 border-gray-700 focus:border-green-500 rounded-2xl pl-14 pr-5 py-5 text-white text-xl placeholder-gray-600 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-3">
        {results === undefined && search.trim().length >= 2 && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-green-600 border-t-transparent rounded-full" />
          </div>
        )}
        {results?.map(m => (
          <button
            key={m._id}
            onClick={() => onSelect(m as FoundMember)}
            className="w-full flex items-center gap-5 p-5 bg-gray-800 rounded-2xl border-2 border-gray-700 hover:border-green-500 active:scale-[0.98] transition-all text-left"
          >
            <div className="w-14 h-14 rounded-full bg-green-900 flex items-center justify-center text-xl font-bold text-green-300 shrink-0">
              {m.displayName[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold text-white truncate">{m.displayName}</p>
              {m.fgcMemberId && (
                <p className="text-gray-400 mt-0.5">#{m.fgcMemberId}</p>
              )}
            </div>
          </button>
        ))}
        {results?.length === 0 && search.trim().length >= 2 && (
          <p className="text-gray-500 text-center py-8 text-lg">No members found</p>
        )}
      </div>
    </div>
  );
}

function HoleScreen({
  competition,
  member,
  courseHoles,
  onSubmit,
  onBack,
}: {
  competition: Competition;
  member: FoundMember;
  courseHoles: CourseHole[];
  onSubmit: (scores: HoleScore[]) => void;
  onBack: () => void;
}) {
  const totalHoles = competition.roundHoles ?? 18;
  const [scores, setScores] = useState<number[]>(() =>
    Array.from({ length: totalHoles }, (_, i) => {
      const h = courseHoles.find(ch => ch.number === i + 1);
      return h ? h.par : 4;
    })
  );
  const [activeHole, setActiveHole] = useState(0); // 0-indexed

  function change(idx: number, delta: number) {
    setScores(prev => {
      const next = [...prev];
      next[idx] = Math.max(1, next[idx] + delta);
      return next;
    });
  }

  const gross = scores.reduce((s, v) => s + v, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 pt-6 pb-4 shrink-0 border-b border-gray-800">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={28} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-lg truncate">{member.displayName}</p>
          <p className="text-gray-400 text-sm truncate">{competition.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold text-white">{gross}</p>
          <p className="text-gray-400 text-xs">Gross</p>
        </div>
      </div>

      {/* Hole grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))" }}>
          {Array.from({ length: totalHoles }).map((_, i) => {
            const courseHole = courseHoles.find(ch => ch.number === i + 1);
            const par = courseHole?.par ?? 4;
            const score = scores[i];
            const diff = score - par;
            const isActive = activeHole === i;

            return (
              <button
                key={i}
                onClick={() => setActiveHole(i)}
                className={`rounded-2xl p-3 border-2 transition-all ${
                  isActive
                    ? "border-green-500 bg-gray-700"
                    : "border-gray-700 bg-gray-800 hover:border-gray-600"
                }`}
              >
                <p className="text-gray-400 text-xs font-medium">H{i + 1}</p>
                {courseHole && (
                  <p className="text-gray-600 text-xs">P{courseHole.par}</p>
                )}
                <p className={`text-2xl font-bold mt-1 ${
                  diff < -1 ? "text-yellow-400" :
                  diff === -1 ? "text-red-400" :
                  diff === 0 ? "text-green-400" :
                  diff === 1 ? "text-gray-300" :
                  "text-gray-500"
                }`}>
                  {score}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active hole controls */}
      <div className="shrink-0 border-t border-gray-800 bg-gray-900 px-6 py-4">
        {(() => {
          const courseHole = courseHoles.find(ch => ch.number === activeHole + 1);
          const par = courseHole?.par ?? 4;
          const score = scores[activeHole];
          return (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-lg">Hole {activeHole + 1}</p>
                {courseHole && (
                  <p className="text-gray-400 text-sm">Par {par} · SI {courseHole.strokeIndex}</p>
                )}
              </div>
              <div className="flex items-center gap-6">
                <button
                  onClick={() => change(activeHole, -1)}
                  className="w-16 h-16 rounded-full bg-gray-700 text-white text-3xl font-bold flex items-center justify-center active:bg-gray-600 hover:bg-gray-600 transition-colors"
                >
                  −
                </button>
                <span className="text-4xl font-bold text-white w-12 text-center">{score}</span>
                <button
                  onClick={() => change(activeHole, 1)}
                  className="w-16 h-16 rounded-full bg-gray-700 text-white text-3xl font-bold flex items-center justify-center active:bg-gray-600 hover:bg-gray-600 transition-colors"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => {
                  if (activeHole < totalHoles - 1) {
                    setActiveHole(activeHole + 1);
                  }
                }}
                className={`px-5 py-3 rounded-xl font-bold text-sm transition-colors ${
                  activeHole < totalHoles - 1
                    ? "bg-gray-700 text-white hover:bg-gray-600"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                Next →
              </button>
            </div>
          );
        })()}
      </div>

      {/* Submit button */}
      <div className="shrink-0 px-6 pb-6 pt-3">
        <button
          onClick={() => onSubmit(scores.map((gross, i) => ({ hole: i + 1, gross })))}
          className="w-full py-5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-xl font-bold rounded-2xl transition-colors"
        >
          Submit Scorecard ({gross} gross)
        </button>
      </div>
    </div>
  );
}

function ReviewScreen({
  competition,
  member,
  holeScores,
  courseHoles,
  handicap,
  onConfirm,
  onBack,
  saving,
  error,
}: {
  competition: Competition;
  member: FoundMember;
  holeScores: HoleScore[];
  courseHoles: CourseHole[];
  handicap: number;
  onConfirm: () => void;
  onBack: () => void;
  saving: boolean;
  error: string;
}) {
  const gross = holeScores.reduce((s, h) => s + h.gross, 0);
  const net = gross - Math.round(handicap);
  const stableford = courseHoles.length > 0
    ? holeScores.reduce((sum, hs) => {
        const h = courseHoles.find(ch => ch.number === hs.hole);
        if (!h) return sum;
        return sum + holeStableford(hs.gross, h.par, h.strokeIndex, handicap);
      }, 0)
    : undefined;

  return (
    <div className="flex flex-col h-full items-center justify-center px-8 py-10 gap-6">
      <div className="w-full max-w-md bg-gray-800 rounded-3xl p-8 space-y-6">
        <div className="text-center">
          <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Review & Submit</p>
          <p className="text-2xl font-bold text-white">{member.displayName}</p>
          <p className="text-gray-400 mt-1">{competition.name}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-3xl font-bold text-white">{gross}</p>
            <p className="text-gray-400 text-xs mt-1">Gross</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-3xl font-bold text-white">{net}</p>
            <p className="text-gray-400 text-xs mt-1">Net</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-3xl font-bold text-green-400">
              {stableford !== undefined ? stableford : "—"}
            </p>
            <p className="text-gray-400 text-xs mt-1">Points</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-gray-900 rounded-2xl px-4 py-3">
          <p className="text-gray-400 text-sm flex-1">Handicap</p>
          <p className="text-white font-bold">{handicap}</p>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>

      <div className="w-full max-w-md flex gap-4">
        <button
          onClick={onBack}
          disabled={saving}
          className="flex-1 py-5 bg-gray-700 hover:bg-gray-600 text-white text-lg font-bold rounded-2xl transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onConfirm}
          disabled={saving}
          className="flex-[2] py-5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xl font-bold rounded-2xl transition-colors"
        >
          {saving ? "Submitting…" : "Confirm Score"}
        </button>
      </div>
    </div>
  );
}

function DoneScreen({ member, onReset }: { member: FoundMember; onReset: () => void }) {
  useEffect(() => {
    const t = setTimeout(onReset, 5000);
    return () => clearTimeout(t);
  }, [onReset]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
      <CheckCircle size={80} className="text-green-400" />
      <div className="text-center">
        <p className="text-4xl font-bold text-white">Score submitted!</p>
        <p className="text-xl text-gray-400 mt-3">Well played, {member.displayName.split(" ")[0]}</p>
      </div>
      <p className="text-gray-600 mt-4">Returning to home screen in 5 seconds…</p>
      <button
        onClick={onReset}
        className="mt-2 px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-2xl transition-colors"
      >
        Done
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KioskScoresPage() {
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");

  const [stage, setStage] = useState<"competition" | "member" | "holes" | "review" | "done">("competition");
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [member, setMember] = useState<FoundMember | null>(null);
  const [holeScores, setHoleScores] = useState<HoleScore[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const course = useQuery(
    api.courses.get,
    competition?.courseId ? { courseId: competition.courseId } : "skip"
  );

  const courseHoles: CourseHole[] = (course?.holes ?? []) as CourseHole[];

  // Handicap comes directly from the search result (added to searchMembers)
  const handicap = member?.handicap ?? 0;

  const submitScore = useMutation(api.scoring.submitScoreHoleByHole);

  function reset() {
    setStage("competition");
    setCompetition(null);
    setMember(null);
    setHoleScores([]);
    setError("");
  }

  async function handleConfirm() {
    if (!club || !competition || !member) return;
    setSaving(true);
    setError("");
    try {
      await submitScore({
        competitionId: competition._id,
        clubId: club._id,
        memberId: member._id,
        holeScores,
      });
      setStage("done");
    } catch (e: any) {
      setError(e.message ?? "Error submitting score");
    } finally {
      setSaving(false);
    }
  }

  if (!club) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-10 w-10 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {stage === "competition" && (
        <CompetitionScreen clubId={club._id} onSelect={c => { setCompetition(c); setStage("member"); }} />
      )}
      {stage === "member" && (
        <MemberScreen
          clubId={club._id}
          onSelect={m => { setMember(m); setStage("holes"); }}
          onBack={() => setStage("competition")}
        />
      )}
      {stage === "holes" && competition && member && (
        <HoleScreen
          competition={competition}
          member={member}
          courseHoles={courseHoles}
          onSubmit={scores => { setHoleScores(scores); setStage("review"); }}
          onBack={() => setStage("member")}
        />
      )}
      {stage === "review" && competition && member && (
        <ReviewScreen
          competition={competition}
          member={member}
          holeScores={holeScores}
          courseHoles={courseHoles}
          handicap={handicap}
          onConfirm={handleConfirm}
          onBack={() => setStage("holes")}
          saving={saving}
          error={error}
        />
      )}
      {stage === "done" && member && (
        <DoneScreen member={member} onReset={reset} />
      )}
    </div>
  );
}
