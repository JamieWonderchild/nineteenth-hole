"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Flag,
  MapPin,
  Calendar,
  Users,
  Cloud,
  FileText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STANDARD_PARS = [4,4,4,3,5,4,3,4,5,4,3,5,4,4,5,3,4,4];
const STANDARD_SI   = [1,7,11,15,3,13,17,5,9,8,16,4,12,6,2,18,10,14];

function stablefordPoints(score: number, par: number, si: number, playingHcp: number) {
  const shots = Math.floor(playingHcp / 18) + (si <= (playingHcp % 18) ? 1 : 0);
  return Math.max(0, par + shots - score + 2);
}

function diffColour(diff: number | null) {
  if (diff === null) return "text-gray-400";
  if (diff <= -2) return "text-purple-600";
  if (diff === -1) return "text-green-600";
  if (diff === 0)  return "text-gray-600";
  if (diff === 1)  return "text-blue-600";
  if (diff === 2)  return "text-orange-500";
  return "text-red-600";
}

function diffLabel(diff: number | null) {
  if (diff === null) return "";
  if (diff <= -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0)  return "Par";
  if (diff === 1)  return "Bogey";
  if (diff === 2)  return "Double";
  return `+${diff}`;
}

function diffBg(diff: number | null) {
  if (diff === null) return "bg-gray-50";
  if (diff <= -2) return "bg-purple-50 font-bold ring-1 ring-purple-300";
  if (diff === -1) return "bg-green-50 ring-1 ring-green-300";
  if (diff === 0)  return "bg-gray-50";
  if (diff === 1)  return "bg-blue-50";
  if (diff === 2)  return "bg-orange-50";
  return "bg-red-50";
}

const CONDITIONS: Record<string, string> = {
  dry: "☀️ Dry",
  overcast: "🌤 Overcast",
  wet: "🌧 Wet",
  windy: "💨 Windy",
};

// ── Nine table ────────────────────────────────────────────────────────────────

function NineTable({
  holes,
  playingHcp,
  label,
}: {
  holes: { number: number; par: number; si: number; score: number | null }[];
  playingHcp: number;
  label: string;
}) {
  const scored = holes.filter(h => h.score !== null);
  const gross = scored.reduce((a, h) => a + (h.score ?? 0), 0);
  const par   = holes.reduce((a, h) => a + h.par, 0);
  const pts   = scored.reduce((a, h) => a + stablefordPoints(h.score ?? h.par, h.par, h.si, playingHcp), 0);

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-gray-400 font-medium">
              <td className="py-1.5 pr-3 text-left">Hole</td>
              {holes.map(h => (
                <td key={h.number} className="py-1.5 text-center w-9">{h.number}</td>
              ))}
              <td className="py-1.5 pl-3 text-center">Out</td>
            </tr>
            <tr className="text-xs text-gray-400">
              <td className="pr-3">Par</td>
              {holes.map(h => (
                <td key={h.number} className="text-center text-gray-500">{h.par}</td>
              ))}
              <td className="pl-3 text-center text-gray-500 font-medium">{par}</td>
            </tr>
            <tr className="text-xs text-gray-400">
              <td className="pr-3">SI</td>
              {holes.map(h => (
                <td key={h.number} className="text-center text-gray-400">{h.si}</td>
              ))}
              <td className="pl-3 text-center text-gray-400">–</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-3 py-2 font-medium text-gray-700 text-xs">Score</td>
              {holes.map(h => {
                const diff = h.score !== null ? h.score - h.par : null;
                return (
                  <td key={h.number} className="text-center py-1">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${diffBg(diff)} ${diffColour(diff)}`}>
                      {h.score ?? "–"}
                    </span>
                  </td>
                );
              })}
              <td className="pl-3 text-center font-bold text-gray-900">
                {scored.length > 0 ? gross : "–"}
              </td>
            </tr>
            <tr className="text-xs text-gray-400">
              <td className="pr-3 pt-1">Pts</td>
              {holes.map(h => {
                const pts = h.score !== null
                  ? stablefordPoints(h.score, h.par, h.si, playingHcp)
                  : null;
                return (
                  <td key={h.number} className="text-center pt-1">
                    <span className={pts !== null && pts >= 3 ? "text-green-600 font-semibold" : ""}>
                      {pts ?? "–"}
                    </span>
                  </td>
                );
              })}
              <td className="pl-3 text-center text-gray-600 font-medium">{pts}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const round = useQuery(api.rounds.get, id ? { roundId: id as any } : "skip");

  if (round === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!round) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Round not found.</p>
        <Link href="/home" className="text-green-700 text-sm mt-2 inline-block">← Back to home</Link>
      </div>
    );
  }

  const hasHoleScores = round.holeScores && round.holeScores.length > 0;

  // Build 18-hole array from saved scores or empty
  const holeData = Array.from({ length: 18 }, (_, i) => {
    const saved = hasHoleScores
      ? round.holeScores!.find((h: any) => h.hole === i + 1)
      : null;
    return {
      number: i + 1,
      par:   saved?.par  ?? STANDARD_PARS[i],
      si:    saved?.strokeIndex ?? STANDARD_SI[i],
      score: saved?.score ?? null,
    };
  });

  const front9 = holeData.slice(0, 9);
  const back9  = holeData.slice(9, 18);

  const playingHcp = 0; // no handicap context available at this level; pts still display

  const coursePar = holeData.reduce((a, h) => a + h.par, 0);
  const scoreToPar = round.grossScore - coursePar;
  const scoredHoles = holeData.filter(h => h.score !== null).length;

  const formattedDate = new Date(round.date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      {/* Header */}
      <div className="bg-green-600 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-green-200 text-xs font-medium uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Flag size={12} />
              Round
            </p>
            <h1 className="text-2xl font-bold leading-snug">
              {round.courseNameFreetext ?? "Golf Course"}
            </h1>
            <p className="text-green-300 text-sm mt-1 flex items-center gap-1.5">
              <Calendar size={13} />
              {formattedDate}
            </p>
          </div>

          {/* Score cluster */}
          <div className="text-right shrink-0">
            <p className="text-5xl font-bold leading-none">{round.grossScore}</p>
            <p className="text-green-300 text-sm mt-1">
              {scoreToPar === 0 ? "Par" : scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-4 border-t border-white/10 text-sm">
          <div>
            <p className="text-green-300 text-xs">Tees</p>
            <p className="text-white font-semibold capitalize">{round.tees ?? "–"}</p>
          </div>
          {round.courseRating && (
            <div>
              <p className="text-green-300 text-xs">CR / Slope</p>
              <p className="text-white font-semibold">{round.courseRating} / {round.slopeRating ?? "–"}</p>
            </div>
          )}
          {round.differential !== undefined && round.differential !== null && (
            <div>
              <p className="text-green-300 text-xs">Differential</p>
              <p className="text-white font-semibold">
                {round.differential > 0 ? "+" : ""}{round.differential.toFixed(1)}
              </p>
            </div>
          )}
          {round.stablefordPoints !== undefined && (
            <div>
              <p className="text-green-300 text-xs">Stableford</p>
              <p className="text-white font-semibold">{round.stablefordPoints} pts</p>
            </div>
          )}
          {!round.isCountingRound && (
            <div>
              <span className="inline-block text-xs bg-amber-400/20 text-amber-200 px-2 py-1 rounded-full">
                Non-counting
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Hole-by-hole scorecard */}
      {hasHoleScores ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-6">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Flag size={15} className="text-green-700" />
            Scorecard
          </h2>
          <NineTable holes={front9} playingHcp={playingHcp} label="Front 9" />
          <hr className="border-gray-100" />
          <NineTable holes={back9}  playingHcp={playingHcp} label="Back 9" />

          {/* Summary row */}
          <div className="flex flex-wrap gap-6 pt-2 border-t border-gray-100 text-sm">
            {(["Eagle", "Birdie", "Par", "Bogey", "Double", "Worse"] as const).map(label => {
              const count = holeData.filter(h => {
                if (h.score === null) return false;
                const d = h.score - h.par;
                if (label === "Eagle")  return d <= -2;
                if (label === "Birdie") return d === -1;
                if (label === "Par")    return d === 0;
                if (label === "Bogey")  return d === 1;
                if (label === "Double") return d === 2;
                return d > 2;
              }).length;
              if (count === 0) return null;
              const colours: Record<string, string> = {
                Eagle: "text-purple-600", Birdie: "text-green-600", Par: "text-gray-600",
                Bogey: "text-blue-600", Double: "text-orange-500", Worse: "text-red-600",
              };
              return (
                <div key={label} className="text-center">
                  <p className={`text-xl font-bold ${colours[label]}`}>{count}</p>
                  <p className="text-xs text-gray-400">{label}{count !== 1 ? "s" : ""}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center text-gray-400 text-sm">
          Hole-by-hole scores not recorded for this round.
        </div>
      )}

      {/* Details */}
      {(round.playedWith?.length || round.conditions || round.notes) && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Details</h2>
          {(round.playedWith?.length ?? 0) > 0 && (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <Users size={15} className="text-gray-400 mt-0.5 shrink-0" />
              <span>Played with {round.playedWith!.join(", ")}</span>
            </div>
          )}
          {round.conditions && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Cloud size={15} className="text-gray-400 shrink-0" />
              <span>{CONDITIONS[round.conditions] ?? round.conditions}</span>
            </div>
          )}
          {round.notes && (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <FileText size={15} className="text-gray-400 mt-0.5 shrink-0" />
              <p className="whitespace-pre-wrap">{round.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
