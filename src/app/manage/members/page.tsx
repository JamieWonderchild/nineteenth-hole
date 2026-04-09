"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { formatCurrency } from "@/lib/format";

export default function MembersPage() {
  const { user } = useUser();

  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const isAdmin = activeMembership?.role === "admin" || superAdmin === true;
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");
  const members = useQuery(api.clubMembers.listByClub, club ? { clubId: club._id } : "skip");
  const pending = useQuery(api.clubMembers.listPending, (club && isAdmin) ? { clubId: club._id } : "skip");
  const approveMember = useMutation(api.clubMembers.approveMember);
  const rejectMember = useMutation(api.clubMembers.rejectMember);

  if (!club || !members) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <p className="text-gray-500 text-sm mt-0.5">{members.length} active member{members.length !== 1 ? "s" : ""} at {club.name}</p>
      </div>

      {/* Pending requests — admin only */}
      {isAdmin && pending && pending.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            Pending requests
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">{pending.length}</span>
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {pending.map(m => (
              <div key={m._id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.displayName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Requested {new Date(m.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMember({ memberId: m._id })}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-500 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => rejectMember({ memberId: m._id })}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active members */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Active members</h2>
        {members.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
            <p className="text-gray-400 text-sm">No active members yet. They appear once someone enters a competition and is approved.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500 text-xs">
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium text-right">Entered</th>
                  <th className="px-5 py-3 font-medium text-right">Won</th>
                  <th className="px-5 py-3 font-medium text-right">P/L</th>
                  <th className="px-5 py-3 font-medium text-right">Role</th>
                </tr>
              </thead>
              <tbody>
                {[...members].sort((a, b) => b.totalWon - a.totalWon).map((m, i) => (
                  <tr key={m._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{m.displayName}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600">{m.totalEntered}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-gray-900">{formatCurrency(m.totalWon, club.currency)}</td>
                    <td className={`px-5 py-3.5 text-right font-medium ${m.totalProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {m.totalProfit >= 0 ? "+" : ""}{formatCurrency(m.totalProfit, club.currency)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.role === "admin" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {m.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
