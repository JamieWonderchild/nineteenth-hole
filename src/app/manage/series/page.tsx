"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { Plus, Trophy } from "lucide-react";

export default function SeriesListPage() {
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(api.clubs.get, adminMembership ? { clubId: adminMembership.clubId } : "skip");
  const seriesList = useQuery(api.series.listByClub, club ? { clubId: club._id } : "skip");

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Trophy size={22} className="text-green-700" />
            Season Series
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Cumulative competitions — like the Race to Swinley Forest
          </p>
        </div>
        <Link
          href="/manage/series/new"
          className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
        >
          <Plus size={16} />
          New series
        </Link>
      </div>

      {seriesList === undefined ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : seriesList.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-gray-500 mb-4">No season series yet</p>
          <Link href="/manage/series/new" className="text-green-700 font-medium hover:underline">
            Create your first series →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {seriesList.map(s => (
            <Link
              key={s._id}
              href={`/manage/series/${s._id}`}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900">{s.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    s.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {s.status === "active" ? "Active" : "Complete"}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Season {s.season}
                  {s.prizePool && ` · ${(s.prizePool / 100).toFixed(0)} ${s.currency} prize pool`}
                </p>
              </div>
              <span className="text-sm text-green-700 font-medium">Manage →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
