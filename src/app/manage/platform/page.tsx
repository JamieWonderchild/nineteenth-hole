"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PlatformPage() {
  const router = useRouter();
  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const allClubs = useQuery(api.clubs.listAll, superAdmin === true ? {} : "skip");
  const orphans = useQuery(api.clubMembers.listOrphans, superAdmin === true ? {} : "skip");
  const assignToClub = useMutation(api.clubMembers.assignToClub);

  const [assigning, setAssigning] = useState<string | null>(null); // userId being assigned

  useEffect(() => {
    if (superAdmin === false) router.push("/manage");
  }, [superAdmin, router]);

  if (!allClubs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  async function handleAssign(userId: string, displayName: string, clubId: string) {
    setAssigning(userId);
    try {
      await assignToClub({ userId, displayName, clubId: clubId as Id<"clubs"> });
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Clubs</h1>
          <p className="text-gray-500 text-sm mt-0.5">{allClubs.length} club{allClubs.length !== 1 ? "s" : ""} on the platform</p>
        </div>
        <Link
          href="/onboarding"
          className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
        >
          + Create Club
        </Link>
      </div>

      {allClubs.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <p className="text-gray-400 mb-3">No clubs yet</p>
          <Link href="/onboarding" className="text-green-700 font-medium hover:underline text-sm">
            Create the first club →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {allClubs.map(c => (
            <div
              key={c._id}
              className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">{c.name}</p>
                <p className="text-sm text-gray-400 mt-0.5">playthepool.golf/{c.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <Link href={`/${c.slug}`} className="text-sm text-green-700 hover:underline">
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Orphan users */}
      {orphans && orphans.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Unassigned users</h2>
          <p className="text-sm text-gray-500 mb-3">
            These users have entered competitions but don't belong to any club.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {orphans.map(u => (
              <div key={u.userId} className="flex items-center justify-between px-5 py-3 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.displayName}</p>
                  <p className="text-xs text-gray-400 font-mono truncate">{u.userId}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{u.entryCount} entr{u.entryCount === 1 ? "y" : "ies"}</p>
                </div>
                <select
                  defaultValue=""
                  disabled={assigning === u.userId}
                  onChange={e => {
                    if (e.target.value) handleAssign(u.userId, u.displayName, e.target.value);
                  }}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 shrink-0 disabled:opacity-50"
                >
                  <option value="" disabled>Assign to club…</option>
                  {allClubs.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
