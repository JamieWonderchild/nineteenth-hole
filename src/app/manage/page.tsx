"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { formatCurrency } from "@/lib/format";

export default function ManagePage() {
  const router = useRouter();
  const { user } = useUser();

  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const allClubs = useQuery(api.clubs.listAll);

  // Find the club where this user is an admin
  const memberships = useQuery(
    api.clubMembers.listByUser,
    user ? { userId: user.id } : "skip"
  );

  const adminMembership = memberships?.find(m => m.role === "admin");
  const club = useQuery(
    api.clubs.get,
    adminMembership ? { clubId: adminMembership.clubId } : "skip"
  );
  const competitions = useQuery(
    api.competitions.listByClub,
    club ? { clubId: club._id } : "skip"
  );
  const members = useQuery(
    api.clubMembers.listByClub,
    club ? { clubId: club._id } : "skip"
  );
  const pendingMembers = useQuery(
    api.clubMembers.listPending,
    club ? { clubId: club._id } : "skip"
  );
  const approveMember = useMutation(api.clubMembers.approveMember);
  const rejectMember = useMutation(api.clubMembers.rejectMember);

  useEffect(() => {}, [memberships, superAdmin, router]);

  // Super admin with no club of their own → show platform overview
  if (superAdmin && !adminMembership) {
    return <PlatformOverview allClubs={allClubs ?? []} />;
  }

  // Still loading
  if (superAdmin === undefined || memberships === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Signed in but not an admin of any club
  if (!adminMembership) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⛳</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">You're not set up as a club admin</h1>
          <p className="text-gray-500 text-sm">If you're a golf club organiser and want to run pools on Play The Pool, get in touch and we'll get you set up.</p>
          <a href="mailto:hello@playthepool.golf" className="mt-6 inline-block px-5 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-600">
            Get in touch →
          </a>
        </div>
      </div>
    );
  }

  if (!club || !competitions || !members) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const liveCount = competitions.filter(c => c.status === "live").length;
  const openCount = competitions.filter(c => c.status === "open").length;
  const totalPot = competitions.reduce((sum, c) => sum + c.entryFee * 0, 0); // computed from entries

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⛳</span>
          <div>
            <h1 className="font-bold text-lg leading-tight">{club.name}</h1>
            <p className="text-green-300 text-xs">Admin dashboard</p>
          </div>
        </div>
        <Link href={`/${club.slug}`} className="text-sm text-green-300 hover:text-white">
          View club →
        </Link>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Members", value: members.length },
            { label: "Competitions", value: competitions.length },
            { label: "Live", value: liveCount },
            { label: "Open", value: openCount },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-3xl font-bold text-green-800">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Competitions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Competitions</h2>
            <Link
              href="/manage/competitions/new"
              className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
            >
              + New competition
            </Link>
          </div>

          {competitions.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
              <p className="text-gray-400 mb-4">No competitions yet</p>
              <Link href="/manage/competitions/new" className="text-green-700 font-medium hover:underline">
                Create your first pool →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {competitions.map(comp => (
                <Link
                  key={comp._id}
                  href={`/manage/competitions/${comp._id}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors"
                >
                  <div>
                    <div className="font-medium text-gray-900">{comp.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {new Date(comp.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      {formatCurrency(comp.entryFee, comp.currency)} entry
                    </div>
                  </div>
                  <StatusBadge status={comp.status} />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Pending membership requests */}
        {pendingMembers && pendingMembers.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Membership requests
              <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">{pendingMembers.length}</span>
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {pendingMembers.map(m => (
                <div key={m._id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-medium text-gray-900">{m.displayName}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveMember({ memberId: m._id })}
                      className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-500"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectMember({ memberId: m._id })}
                      className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Members leaderboard */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Club leaderboard</h2>
            <Link href="/manage/members" className="text-sm text-green-700 hover:underline">
              Manage members →
            </Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium text-right">Entered</th>
                  <th className="px-5 py-3 font-medium text-right">Won</th>
                  <th className="px-5 py-3 font-medium text-right">Profit/loss</th>
                </tr>
              </thead>
              <tbody>
                {[...members]
                  .sort((a, b) => b.totalWon - a.totalWon)
                  .map((m, i) => (
                    <tr key={m._id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{m.displayName}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{m.totalEntered}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(m.totalWon, club.currency)}
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${m.totalProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {m.totalProfit >= 0 ? "+" : ""}{formatCurrency(m.totalProfit, club.currency)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function PlatformOverview({ allClubs }: { allClubs: Array<{ _id: string; name: string; slug: string; currency: string; plan: string; createdAt: string }> }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-900 text-white px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">⛳</span>
        <div>
          <h1 className="font-bold text-lg leading-tight">Play The Pool</h1>
          <p className="text-green-300 text-xs">Platform overview · Super admin</p>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
          {allClubs.length} club{allClubs.length !== 1 ? "s" : ""} on the platform
        </div>
        <div className="space-y-3">
          {allClubs.map(c => (
            <Link
              key={c._id}
              href={`/manage?club=${c._id}`}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors"
            >
              <div>
                <div className="font-medium text-gray-900">{c.name}</div>
                <div className="text-sm text-gray-400">playthepool.golf/{c.slug}</div>
              </div>
              <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString("en-GB")}</span>
            </Link>
          ))}
        </div>
        <Link href="/onboarding" className="inline-block px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600">
          + Create a club
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-gray-100 text-gray-600" },
    open: { label: "Open", className: "bg-blue-100 text-blue-700" },
    live: { label: "Live", className: "bg-green-100 text-green-700" },
    complete: { label: "Complete", className: "bg-purple-100 text-purple-700" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
