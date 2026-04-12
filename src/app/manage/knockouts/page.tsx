"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import Link from "next/link";
import { Plus, Trophy, ChevronRight } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500",
  active: "bg-green-100 text-green-700",
  complete: "bg-purple-100 text-purple-700",
};

export default function KnockoutsPage() {
  const { activeMembership, club } = useActiveClub();
  const tournaments = useQuery(api.knockouts.listByClub, club ? { clubId: club._id } : "skip");

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knockouts</h1>
          <p className="text-gray-500 text-sm mt-0.5">Match play brackets for {club.name}</p>
        </div>
        {activeMembership?.role === "admin" && (
          <Link
            href="/manage/knockouts/new"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus size={15} />
            New knockout
          </Link>
        )}
      </div>

      {!tournaments || tournaments.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-14 text-center">
          <Trophy size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No knockout tournaments yet</p>
          <p className="text-gray-400 text-sm mt-1">Create one to run a club championship or cup draw</p>
          {activeMembership?.role === "admin" && (
            <Link href="/manage/knockouts/new" className="mt-4 inline-block text-green-700 font-medium text-sm hover:underline">
              Create your first knockout →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {tournaments.map(t => (
            <Link
              key={t._id}
              href={`/manage/knockouts/${t._id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Round {t.currentRound} of {t.totalRounds} · {t.format === "single_elimination" ? "Single elimination" : t.format}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[t.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                </span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
