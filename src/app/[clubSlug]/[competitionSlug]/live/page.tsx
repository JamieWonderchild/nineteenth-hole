"use client";

import { useEffect, useState, use } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { formatCurrency } from "@/lib/format";
import { Maximize2, Minimize2, Tv2 } from "lucide-react";

const MEDAL = ["🥇", "🥈", "🥉"];

function scoreLabel(score: number) {
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function LiveLeaderboardPage({
  params,
}: {
  params: Promise<{ clubSlug: string; competitionSlug: string }>;
}) {
  const { clubSlug, competitionSlug } = use(params);
  const [fullscreen, setFullscreen] = useState(false);
  const [tick, setTick] = useState(0);

  const club = useQuery(api.clubs.getBySlug, { slug: clubSlug });
  const competition = useQuery(
    api.competitions.getBySlug,
    club ? { clubId: club._id, slug: competitionSlug } : "skip"
  );
  const entries = useQuery(
    api.entries.listByCompetition,
    competition ? { competitionId: competition._id } : "skip"
  );

  // Pulse tick for live indicator
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const isLoading = club === undefined || competition === undefined || entries === undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-green-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!club || !competition) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center text-green-400">
        <p className="text-xl">Competition not found</p>
      </div>
    );
  }

  const paidEntries = (entries ?? []).filter(e => e.paidAt);
  const sorted = [...paidEntries].sort(
    (a, b) => (a.leaderboardPosition ?? 999) - (b.leaderboardPosition ?? 999)
  );

  const pot = paidEntries.length * competition.entryFee;
  const prizes = competition.prizeStructure.map(p => ({
    position: p.position,
    amount: Math.floor(pot * p.percentage / 100),
  }));

  const isLive = competition.status === "live";
  const isPickFormat = competition.drawType === "pick";

  return (
    <div className="min-h-screen bg-green-950 text-white flex flex-col select-none">

      {/* Header */}
      <header className="shrink-0 px-8 pt-6 pb-4 border-b border-green-800/60">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Tv2 size={18} className="text-green-400" />
              <span className="text-green-400 text-sm font-medium tracking-wide uppercase">
                {club.name}
              </span>
              {isLive && (
                <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-red-600 text-white ${tick % 2 === 0 ? "opacity-100" : "opacity-70"} transition-opacity`}>
                  ● LIVE
                </span>
              )}
              {competition.status === "complete" && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-700 text-purple-100">
                  FINAL
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
              {competition.name}
            </h1>
            <p className="text-green-300 mt-1 text-base">
              {new Date(competition.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              {competition.entryFee > 0 && (
                <span className="ml-3 text-green-400 font-semibold">
                  {formatCurrency(pot, competition.currency)} pot · {paidEntries.length} entries
                </span>
              )}
            </p>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-green-400 hover:text-white hover:bg-green-800/50 transition-colors"
            title={fullscreen ? "Exit fullscreen" : "Go fullscreen"}
          >
            {fullscreen ? <Minimize2 size={22} /> : <Maximize2 size={22} />}
          </button>
        </div>
      </header>

      {/* Prize strip */}
      {prizes.length > 0 && pot > 0 && (
        <div className="shrink-0 flex gap-0 border-b border-green-800/60">
          {prizes.map((p, i) => (
            <div
              key={p.position}
              className={`flex-1 text-center py-3 border-r border-green-800/40 last:border-r-0 ${
                i === 0 ? "bg-amber-900/30" : i === 1 ? "bg-slate-700/30" : i === 2 ? "bg-amber-800/20" : "bg-green-900/20"
              }`}
            >
              <div className="text-xs text-green-400 uppercase tracking-wider mb-0.5">
                {ordinal(p.position)} place
              </div>
              <div className={`font-bold text-lg ${i === 0 ? "text-amber-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-green-300"}`}>
                {formatCurrency(p.amount, competition.currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      <div className="flex-1 overflow-hidden px-4 sm:px-8 py-4">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-green-600">
            <p className="text-2xl">No entries yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-full overflow-y-auto scrollbar-hide">
            {sorted.map((entry, i) => {
              const pos = entry.leaderboardPosition ?? i + 1;
              const prize = prizes.find(p => p.position === pos);
              const isTop3 = i < 3;

              return (
                <div
                  key={entry._id}
                  className={`flex items-center gap-4 rounded-xl px-5 py-4 transition-all ${
                    i === 0
                      ? "bg-amber-900/40 border border-amber-600/40"
                      : i === 1
                      ? "bg-slate-700/40 border border-slate-500/30"
                      : i === 2
                      ? "bg-amber-900/20 border border-amber-800/30"
                      : "bg-green-900/30 border border-green-800/20"
                  }`}
                >
                  {/* Position */}
                  <div className="w-12 text-center shrink-0">
                    {isTop3 ? (
                      <span className="text-2xl">{MEDAL[i]}</span>
                    ) : (
                      <span className="text-xl font-bold text-green-500">{i + 1}</span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${
                      i === 0 ? "text-2xl text-amber-200" :
                      i === 1 ? "text-2xl text-slate-200" :
                      i === 2 ? "text-xl text-amber-400" :
                      "text-xl text-white"
                    }`}>
                      {entry.displayName}
                    </p>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-right">
                    {isPickFormat ? (
                      entry.totalPrizeMoney !== undefined ? (
                        <span className="text-xl font-bold text-green-300">
                          ${(entry.totalPrizeMoney / 100).toLocaleString("en-US")}
                        </span>
                      ) : (
                        <span className="text-green-600 text-lg">—</span>
                      )
                    ) : entry.bestPlayerScore !== undefined ? (
                      <span className={`text-2xl font-bold ${
                        entry.bestPlayerScore < 0 ? "text-green-400" :
                        entry.bestPlayerScore > 0 ? "text-red-400" :
                        "text-white"
                      }`}>
                        {scoreLabel(entry.bestPlayerScore)}
                      </span>
                    ) : (
                      <span className="text-green-600 text-lg">—</span>
                    )}
                    {prize && prize.amount > 0 && (
                      <p className={`text-sm font-semibold mt-0.5 ${
                        i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : "text-amber-600"
                      }`}>
                        {formatCurrency(prize.amount, competition.currency)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="shrink-0 py-3 px-8 border-t border-green-800/60 flex items-center justify-between">
        <span className="text-green-700 text-xs">
          nineteenth.golf · {club.name}
        </span>
        <span className="text-green-700 text-xs">
          {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </footer>
    </div>
  );
}
