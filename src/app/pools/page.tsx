"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";

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

export default function PoolsPage() {
  const pools = useQuery(api.competitions.listPlatform);

  const active = pools?.filter(p => p.status === "open" || p.status === "live") ?? [];
  const completed = pools?.filter(p => p.status === "complete") ?? [];
  const draft = pools?.filter(p => p.status === "draft") ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tour Pools</h1>
        <p className="text-gray-500 text-sm mt-1">Platform-wide sweepstakes for professional golf tournaments.</p>
      </div>
        {pools === undefined ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Open &amp; Live</h2>
                <div className="space-y-2">
                  {active.map(pool => <PoolCard key={pool._id} pool={pool} />)}
                </div>
              </section>
            )}

            {draft.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Coming Soon</h2>
                <div className="space-y-2">
                  {draft.map(pool => <PoolCard key={pool._id} pool={pool} />)}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Completed</h2>
                <div className="space-y-2">
                  {completed.map(pool => <PoolCard key={pool._id} pool={pool} />)}
                </div>
              </section>
            )}

            {pools.length === 0 && (
              <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
                <div className="text-4xl mb-3">🏌️</div>
                <p className="text-gray-500">No pools yet — check back before the next major.</p>
              </div>
            )}
          </>
        )}
    </div>
  );
}

function PoolCard({ pool }: { pool: { _id: string; name: string; slug: string; status: string; startDate: string; endDate: string; entryFee: number; currency: string; entryDeadline: string; type: string } }) {
  const sym = pool.currency === "GBP" ? "£" : pool.currency === "EUR" ? "€" : "$";
  const totalWithFee = pool.entryFee + Math.round(pool.entryFee * 0.1);
  const deadlinePassed = new Date(pool.entryDeadline) < new Date();

  return (
    <Link
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
          {pool.entryFee > 0 && ` · ${sym}${(pool.entryFee / 100).toFixed(0)} entry`}
        </p>
        {pool.status === "open" && !deadlinePassed && (
          <p className="text-xs text-amber-600 mt-0.5">
            Entries close {new Date(pool.entryDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      <div>
        {pool.status === "open" && (
          <span className="px-4 py-1.5 bg-green-700 text-white text-sm font-medium rounded-lg group-hover:bg-green-600 transition-colors">
            Enter {pool.entryFee > 0 ? `${sym}${(totalWithFee / 100).toFixed(0)}` : "free"}
          </span>
        )}
        {(pool.status === "live" || pool.status === "complete") && (
          <span className="text-sm text-green-700 font-medium">View →</span>
        )}
      </div>
    </Link>
  );
}
