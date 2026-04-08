"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { use } from "react";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    live: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-400",
    complete: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function ClubPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { user } = useUser();

  const club = useQuery(api.clubs.getBySlug, { slug: clubSlug });
  const competitions = useQuery(
    api.competitions.listByClub,
    club ? { clubId: club._id } : "skip"
  );
  const membership = useQuery(
    api.clubMembers.getByClubAndUser,
    club && user ? { clubId: club._id, userId: user.id } : "skip"
  );
  const ensureMember = null; // not imported — member joins via competition entry

  void ensureMember;

  if (club === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">⛳</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Club not found</h1>
          <p className="text-gray-500 text-sm">This club doesn&apos;t exist or may have moved.</p>
        </div>
      </div>
    );
  }

  const sym = club.currency === "GBP" ? "£" : club.currency === "EUR" ? "€" : "$";
  const activeComps = (competitions ?? []).filter(c => c.status !== "complete");
  const pastComps = (competitions ?? []).filter(c => c.status === "complete");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg">⛳</div>
                <span className="text-green-300 text-sm font-medium">Play The Pool</span>
              </div>
              <h1 className="text-2xl font-bold mt-2">{club.name}</h1>
              <p className="text-green-300 text-sm mt-1">
                {activeComps.length > 0
                  ? `${activeComps.length} active competition${activeComps.length !== 1 ? "s" : ""}`
                  : "No active competitions right now"}
              </p>
            </div>
            {membership?.status === "active" && membership.role === "admin" && (
              <Link
                href="/manage"
                className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                Manage club
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Active competitions */}
        {activeComps.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Active Competitions</h2>
            <div className="space-y-2">
              {activeComps.map(comp => (
                <Link
                  key={comp._id}
                  href={`/${clubSlug}/${comp.slug}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors group"
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="font-semibold text-gray-900">{comp.name}</span>
                      <StatusPill status={comp.status} />
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(comp.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {" – "}
                      {new Date(comp.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {comp.entryFee > 0 && ` · ${sym}${(comp.entryFee / 100).toFixed(0)} entry`}
                    </p>
                    {comp.status === "open" && new Date(comp.entryDeadline) > new Date() && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Entries close {new Date(comp.entryDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {comp.status === "open" && (
                      <span className="px-3 py-1.5 bg-green-700 text-white text-xs font-medium rounded-lg group-hover:bg-green-600 transition-colors">
                        Enter {formatCurrency(comp.entryFee + Math.round(comp.entryFee * 0.1), comp.currency)}
                      </span>
                    )}
                    {comp.status === "live" && (
                      <span className="text-sm text-green-700 font-medium">View →</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* No active competitions */}
        {activeComps.length === 0 && (
          <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-xl">
            <div className="text-4xl mb-3">⛳</div>
            <p className="text-gray-500">No active competitions right now.</p>
            <p className="text-gray-400 text-sm mt-1">Check back soon — new pools are added before each major.</p>
          </div>
        )}

        {/* Past competitions */}
        {pastComps.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Past Competitions</h2>
            <div className="space-y-2">
              {pastComps.slice(0, 5).map(comp => (
                <Link
                  key={comp._id}
                  href={`/${clubSlug}/${comp.slug}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3.5 hover:border-gray-300 transition-colors"
                >
                  <div>
                    <span className="font-medium text-gray-700">{comp.name}</span>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {new Date(comp.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <StatusPill status={comp.status} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
