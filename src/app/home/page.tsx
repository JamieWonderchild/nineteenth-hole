"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { Plus, Trophy, ChevronRight, Zap } from "lucide-react";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    live: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-500",
    complete: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function HomePage() {
  const { user } = useUser();

  const pools = useQuery(api.competitions.listPlatformActive);
  const memberships = useQuery(
    api.clubMembers.listByUser,
    user ? { userId: user.id } : "skip"
  );
  const activeMembership = memberships?.find(m => m.status === "active");
  const club = useQuery(
    api.clubs.get,
    activeMembership ? { clubId: activeMembership.clubId } : "skip"
  );
  const clubComps = useQuery(
    api.competitions.listByClub,
    club ? { clubId: club._id } : "skip"
  );
  const myGames = useQuery(
    api.quickGames.listByUser,
    user ? { userId: user.id } : "skip"
  );

  const activeClubComps = clubComps?.filter(c => c.status !== "complete").slice(0, 3) ?? [];
  const recentGames = myGames?.slice(0, 3) ?? [];

  return (
    <div className="space-y-8">
      {/* Tour Pools */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Trophy size={18} className="text-green-700" />
            Tour Pools
          </h2>
          <Link href="/pools" className="text-sm text-green-700 hover:underline font-medium">
            All pools →
          </Link>
        </div>

        {pools === undefined ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : pools.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">No active pools right now — check back soon.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pools.map(pool => {
              const sym = pool.currency === "GBP" ? "£" : pool.currency === "EUR" ? "€" : "$";
              const total = (pool.entryFee + Math.round(pool.entryFee * 0.1));
              return (
                <Link
                  key={pool._id}
                  href={`/pools/${pool.slug}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors group"
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="font-semibold text-gray-900">{pool.name}</span>
                      <StatusPill status={pool.status} />
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(pool.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {" – "}
                      {new Date(pool.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      {sym}{(pool.entryFee / 100).toFixed(0)} entry
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {pool.status === "open" && (
                      <span className="px-4 py-1.5 bg-green-700 text-white text-sm font-medium rounded-lg group-hover:bg-green-600 transition-colors">
                        Enter {sym}{(total / 100).toFixed(0)}
                      </span>
                    )}
                    {pool.status === "live" && (
                      <span className="text-sm text-green-700 font-medium">View →</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Games */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Zap size={18} className="text-amber-500" />
            Quick Games
          </h2>
          {recentGames.length > 0 && (
            <Link href="/games" className="text-sm text-green-700 hover:underline font-medium">
              All games →
            </Link>
          )}
        </div>

        <Link
          href="/games/new"
          className="flex items-center justify-center gap-2.5 bg-white border-2 border-dashed border-gray-300 rounded-xl px-5 py-5 hover:border-green-400 hover:bg-green-50/30 transition-colors group w-full mb-3"
        >
          <Plus size={18} className="text-green-700" />
          <span className="font-medium text-gray-700 group-hover:text-green-800">
            Start a game with friends
          </span>
          <span className="text-sm text-gray-400">Stableford · Betterball · Nassau · Skins</span>
        </Link>

        {recentGames.length > 0 && (
          <div className="space-y-2">
            {recentGames.map(game => (
              <Link
                key={game._id}
                href={`/games/${game._id}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3.5 hover:border-green-400 transition-colors"
              >
                <div>
                  <span className="font-medium text-gray-900">{game.name}</span>
                  <p className="text-sm text-gray-500">
                    {game.type.charAt(0).toUpperCase() + game.type.slice(1)}
                    {" · "}
                    {game.players.length} players
                    {" · "}
                    {new Date(game.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {game.status === "complete" && game.result ? (
                    <span className="text-sm text-gray-500 max-w-[160px] text-right truncate">
                      {game.result.summary}
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      In progress
                    </span>
                  )}
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Club section */}
      {club && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {club.name}
            </h2>
            {activeMembership?.role === "admin" && (
              <Link href="/manage" className="text-sm text-green-700 hover:underline font-medium">
                Manage →
              </Link>
            )}
          </div>

          {activeClubComps.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <p className="text-sm text-gray-400">No active club competitions.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeClubComps.map(comp => (
                <Link
                  key={comp._id}
                  href={`/${club.slug}/${comp.slug}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3.5 hover:border-green-400 transition-colors"
                >
                  <div>
                    <span className="font-medium text-gray-900">{comp.name}</span>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(comp.entryFee, comp.currency)} entry
                      {" · "}
                      {new Date(comp.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <StatusPill status={comp.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* No club — invite CTA */}
      {memberships !== undefined && !activeMembership && (
        <section className="bg-green-50 border border-green-200 rounded-xl px-5 py-5">
          <h3 className="font-semibold text-green-900 mb-1">Join a golf club</h3>
          <p className="text-sm text-green-700 mb-3">
            Get access to club competitions, season series, and a leaderboard with your friends.
            Ask your club admin to invite you, or get in touch if your club isn&apos;t on the platform yet.
          </p>
          <a
            href="mailto:hello@playthepool.golf"
            className="text-sm font-medium text-green-700 hover:text-green-600 underline"
          >
            Get your club set up →
          </a>
        </section>
      )}
    </div>
  );
}
