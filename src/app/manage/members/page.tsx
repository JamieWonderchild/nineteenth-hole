"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "convex/_generated/api";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clubMembersApi = api.clubMembers as any;
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { Pencil, Check, X } from "lucide-react";

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
  const deleteMember = useMutation(api.clubMembers.deleteMember);
  const listNonMembers = useAction(clubMembersApi.listNonMembers);
  const addMemberById = useAction(clubMembersApi.addMemberById);

  const setHandicap = useMutation(api.scoring.setHandicap);
  const setRole = useMutation(api.clubMembers.setRole);
  const [nonMembers, setNonMembers] = useState<Array<{ userId: string; displayName: string; email: string }> | null>(null);
  const [nonMembersLoading, setNonMembersLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [handicapEdit, setHandicapEdit] = useState<{ id: Id<"clubMembers">; value: string } | null>(null);

  async function handleLoadNonMembers() {
    if (!club) return;
    setNonMembersLoading(true);
    try {
      const result = await listNonMembers({ clubId: club._id });
      setNonMembers(result as Array<{ userId: string; displayName: string; email: string }>);
    } finally {
      setNonMembersLoading(false);
    }
  }

  async function handleAddMember(userId: string, displayName: string, role: "member" | "admin" = "member") {
    if (!club) return;
    setAddingId(userId);
    try {
      await addMemberById({ userId, clubId: club._id as Id<"clubs">, displayName, role });
      setNonMembers(prev => prev?.filter(u => u.userId !== userId) ?? null);
    } finally {
      setAddingId(null);
    }
  }

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

      {/* Super admin: add registered users to the club */}
      {superAdmin && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Add registered users</h2>
            {nonMembers === null && (
              <button
                onClick={handleLoadNonMembers}
                disabled={nonMembersLoading}
                className="text-sm text-green-700 font-medium hover:underline disabled:opacity-60"
              >
                {nonMembersLoading ? "Loading…" : "Show users not in club →"}
              </button>
            )}
            {nonMembers !== null && (
              <button onClick={() => setNonMembers(null)} className="text-sm text-gray-400 hover:text-gray-600">
                Hide
              </button>
            )}
          </div>

          {nonMembers !== null && (
            nonMembers.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl px-5 py-4">
                All registered users are already members of this club.
              </p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {nonMembers.map(u => (
                  <div key={u.userId} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.displayName}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddMember(u.userId, u.displayName, "member")}
                        disabled={addingId === u.userId}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-500 transition-colors disabled:opacity-60"
                      >
                        {addingId === u.userId ? "Adding…" : "Add as member"}
                      </button>
                      <button
                        onClick={() => handleAddMember(u.userId, u.displayName, "admin")}
                        disabled={addingId === u.userId}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-60"
                      >
                        Add as admin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
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
                  <th className="px-5 py-3 font-medium text-right hidden sm:table-cell">Entered</th>
                  <th className="px-5 py-3 font-medium text-right hidden sm:table-cell">Won</th>
                  <th className="px-5 py-3 font-medium text-right hidden md:table-cell">P/L</th>
                  {isAdmin && <th className="px-5 py-3 font-medium text-right">Hcp</th>}
                  <th className="px-5 py-3 font-medium text-right">Role</th>
                  {superAdmin && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody>
                {[...members].sort((a, b) => b.totalWon - a.totalWon).map((m, i) => (
                  <tr key={m._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{m.displayName}</td>
                    <td className="px-5 py-3.5 text-right text-gray-600 hidden sm:table-cell">{m.totalEntered}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-gray-900 hidden sm:table-cell">{formatCurrency(m.totalWon, club.currency)}</td>
                    <td className={`px-5 py-3.5 text-right font-medium hidden md:table-cell ${m.totalProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {m.totalProfit >= 0 ? "+" : ""}{formatCurrency(m.totalProfit, club.currency)}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-right">
                        {handicapEdit !== null && handicapEdit.id === m._id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={handicapEdit.value}
                              onChange={e => setHandicapEdit({ id: m._id, value: e.target.value })}
                              step="0.1" min="-5" max="54"
                              className="w-16 border border-gray-300 rounded-lg px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                              autoFocus
                            />
                            <button
                              onClick={async () => {
                                const hcp = parseFloat(handicapEdit.value);
                                await setHandicap({ memberId: m._id, handicap: isNaN(hcp) ? undefined : hcp });
                                setHandicapEdit(null);
                              }}
                              className="text-green-600 hover:text-green-700"
                            ><Check size={13} /></button>
                            <button onClick={() => setHandicapEdit(null)} className="text-gray-400 hover:text-gray-600">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setHandicapEdit({ id: m._id, value: m.handicap?.toString() ?? "" })}
                            className="flex items-center justify-end gap-1 text-gray-600 hover:text-gray-900 ml-auto"
                          >
                            <span className="text-xs font-medium">{m.handicap != null ? m.handicap : "—"}</span>
                            <Pencil size={11} className="text-gray-300" />
                          </button>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3.5 text-right">
                      {isAdmin ? (
                        <select
                          value={m.role}
                          onChange={e => setRole({ memberId: m._id, role: e.target.value })}
                          className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-0.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500"
                        >
                          <option value="member">member</option>
                          <option value="staff">staff</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.role === "admin" ? "bg-green-100 text-green-700" : m.role === "staff" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                          {m.role}
                        </span>
                      )}
                    </td>
                    {superAdmin && (
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${m.displayName} from the club? This cannot be undone.`)) {
                              deleteMember({ memberId: m._id });
                            }
                          }}
                          className="text-gray-300 hover:text-red-500 transition-colors text-xs font-medium"
                          title="Delete member"
                        >
                          ✕
                        </button>
                      </td>
                    )}
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
