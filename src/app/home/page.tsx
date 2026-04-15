"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { Trophy, TrendingDown, TrendingUp, Flag, Users, ChevronRight, Smartphone, Plus } from "lucide-react";

function HandicapCard({ userId }: { userId: string }) {
  const profile = useQuery(api.golferProfiles.get, { userId });
  const history = useQuery(api.handicap.getHistory, { userId, limit: 2 });

  const index = profile?.handicapIndex;
  const latest = history?.[0];
  const direction = latest?.direction ?? "same";

  return (
    <div className="bg-green-600 rounded-2xl p-6 text-white">
      <p className="text-green-200 text-sm font-medium uppercase tracking-widest mb-1">
        Handicap Index
      </p>
      <div className="flex items-end gap-3">
        <span className="text-7xl font-bold leading-none">
          {index !== null && index !== undefined ? index.toFixed(1) : "–"}
        </span>
        {latest && direction !== "same" && (
          <div className={`flex items-center gap-1 mb-2 ${direction === "down" ? "text-green-300" : "text-red-300"}`}>
            {direction === "down" ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
            <span className="text-lg font-semibold">
              {Math.abs(latest.change).toFixed(1)}
            </span>
          </div>
        )}
      </div>
      {index === null || index === undefined ? (
        <p className="text-green-300 text-sm mt-2">
          Log 3 rounds to get your WHS handicap index
        </p>
      ) : (
        <p className="text-green-300 text-sm mt-2">
          WHS Handicap Index · Updated automatically
        </p>
      )}
    </div>
  );
}

function RoundCard({ round }: {
  round: {
    _id: string;
    date: string;
    courseNameFreetext?: string;
    golfClubId?: string;
    tees: string;
    grossScore: number;
    netScore?: number;
    stablefordPoints?: number;
    differential?: number;
    isCountingRound: boolean;
  }
}) {
  const date = new Date(round.date).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });

  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-gray-900">
            {round.courseNameFreetext ?? "Unknown course"}
          </span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
            {round.tees}
          </span>
          {!round.isCountingRound && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              Non-counting
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {date}
          {" · "}
          Gross {round.grossScore}
          {round.netScore !== undefined && ` · Net ${round.netScore}`}
          {round.stablefordPoints !== undefined && ` · ${round.stablefordPoints} pts`}
        </p>
      </div>
      {round.differential !== undefined && (
        <span className="text-sm font-medium text-gray-600 shrink-0">
          Diff {round.differential > 0 ? "+" : ""}{round.differential.toFixed(1)}
        </span>
      )}
    </div>
  );
}

function StatsCard({ userId }: { userId: string }) {
  const stats = useQuery(api.rounds.getStats, { userId });

  if (!stats) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="font-semibold text-gray-900 mb-4">My Stats</h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalRounds}</p>
          <p className="text-xs text-gray-500 mt-0.5">Rounds</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.avgGross}</p>
          <p className="text-xs text-gray-500 mt-0.5">Avg Score</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.bestGross}</p>
          <p className="text-xs text-gray-500 mt-0.5">Best Round</p>
        </div>
        {stats.girPct !== null && (
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.girPct}%</p>
            <p className="text-xs text-gray-500 mt-0.5">GIR</p>
          </div>
        )}
        {stats.fairwayPct !== null && (
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.fairwayPct}%</p>
            <p className="text-xs text-gray-500 mt-0.5">Fairways</p>
          </div>
        )}
        {stats.avgPutts !== null && (
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.avgPutts}</p>
            <p className="text-xs text-gray-500 mt-0.5">Avg Putts</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IndividualHomePage() {
  const { user } = useUser();
  const rounds = useQuery(api.rounds.list, user ? { userId: user.id, limit: 5 } : "skip");
  const activeCompetitions = useQuery(api.competitions.listPlatformActive);
  const myClubs = useQuery(api.clubMembers.myActiveClubs);

  if (!user) return null;

  const firstName = user.firstName ?? "Golfer";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Handicap card */}
          <HandicapCard userId={user.id} />

          {/* Active competitions */}
          {activeCompetitions && activeCompetitions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Trophy size={16} className="text-amber-500" />
                  Open Competitions
                </h2>
                <Link href="/pools" className="text-sm text-green-700 hover:text-green-800 font-medium">
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {activeCompetitions.slice(0, 2).map(comp => (
                  <Link
                    key={comp._id}
                    href={`/pools/${comp.slug}`}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{comp.name}</p>
                      <p className="text-sm text-gray-500">
                        Entry: £{(comp.entryFee / 100).toFixed(0)}
                        {" · "}
                        Deadline: {new Date(comp.entryDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recent rounds */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Flag size={16} className="text-green-700" />
                Recent Rounds
              </h2>
              <Link
                href="/rounds/new"
                className="flex items-center gap-1 text-sm text-green-700 hover:text-green-800 font-medium"
              >
                <Plus size={14} />
                Log a Round
              </Link>
            </div>
            {rounds === undefined ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : rounds.length === 0 ? (
              <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-xl">
                <div className="text-4xl mb-3">⛳</div>
                <p className="text-gray-500 mb-2">No rounds logged yet</p>
                <Link
                  href="/rounds/new"
                  className="inline-block mt-2 text-sm text-white bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg font-medium"
                >
                  Log your first round →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {rounds.map(round => (
                  <RoundCard key={round._id} round={round} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Stats */}
          {user && <StatsCard userId={user.id} />}

          {/* Club membership */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users size={16} className="text-green-700" />
              My Clubs
            </h3>
            {myClubs === undefined ? (
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
            ) : myClubs.length === 0 ? (
              <div>
                <p className="text-sm text-gray-500 mb-3">
                  Not a member of any clubs on The 19th Hole yet.
                </p>
                <Link
                  href="/manage"
                  className="text-sm font-medium text-green-700 hover:text-green-800"
                >
                  Join or invite your club →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {myClubs.map(({ club, membership }) => (
                  <Link
                    key={membership._id}
                    href={`/${club.slug}`}
                    className="flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-green-700">
                        {club.name}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{membership.role}</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-400" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link href="/games" className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-700">
                <span>⚡</span> Quick Games
              </Link>
              <Link href="/pools" className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-700">
                <span>🏆</span> Tour Pools
              </Link>
              <Link href="/messages" className="flex items-center gap-2 text-sm text-gray-700 hover:text-green-700">
                <span>💬</span> Messages
              </Link>
            </div>
          </div>

          {/* App download prompt */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Smartphone size={20} className="text-green-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800 text-sm">Get the mobile app</p>
                <p className="text-green-700 text-xs mt-1">
                  Log rounds on the course, track your handicap, and score with friends in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
