"use client";

import { useState } from "react";
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
  const memberships = useQuery(
    api.clubMembers.listByUser,
    user ? { userId: user.id } : "skip"
  );
  const activeMembership = memberships?.find(m => m.status === "active");
  const pendingMembership = memberships?.find(m => m.status === "pending");
  const isAdmin = activeMembership?.role === "admin" || superAdmin === true;
  const club = useQuery(
    api.clubs.get,
    activeMembership ? { clubId: activeMembership.clubId } : "skip"
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
    (club && isAdmin) ? { clubId: club._id } : "skip"
  );
  const approveMember = useMutation(api.clubMembers.approveMember);
  const rejectMember = useMutation(api.clubMembers.rejectMember);
  const generateImportToken = useMutation(api.clubs.generateImportToken);

  const [copied, setCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

  // Super admin with no club → redirect to platform overview
  useEffect(() => {
    if (superAdmin && !activeMembership && memberships !== undefined) {
      router.push("/manage/platform");
    }
  }, [superAdmin, activeMembership, memberships, router]);

  if (superAdmin === undefined || memberships === undefined) {
    return <Spinner />;
  }

  if (!activeMembership) {
    if (pendingMembership) {
      return (
        <div className="flex items-center justify-center h-full min-h-[60vh] px-4">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Membership pending</h1>
            <p className="text-gray-500 text-sm">
              Your request to join has been received. An admin will approve you shortly.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh] px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⛳</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">No club assigned</h1>
          <p className="text-gray-500 text-sm">
            If you run a golf club and want to use Play The Pool, get in touch and we'll get you set up.
          </p>
          <a
            href="mailto:hello@playthepool.golf"
            className="mt-6 inline-block px-5 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-600"
          >
            Get in touch →
          </a>
        </div>
      </div>
    );
  }

  if (!club || !competitions || !members) return <Spinner />;

  const liveCount = competitions.filter(c => c.status === "live").length;
  const openCount = competitions.filter(c => c.status === "open").length;
  const activeComps = competitions.filter(c => c.status !== "complete");

  const inviteUrl = typeof window !== "undefined"
    ? `https://${window.location.hostname}/${club.slug}`
    : `https://playthepool.golf/${club.slug}`;

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCopyToken() {
    if (!club?.importToken) return;
    navigator.clipboard.writeText(club.importToken).then(() => {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    });
  }

  async function handleGenerateToken() {
    if (!club) return;
    setGeneratingToken(true);
    try {
      await generateImportToken({ clubId: club._id });
    } finally {
      setGeneratingToken(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{isAdmin ? "Admin dashboard" : "Member dashboard"}</p>
        </div>
        {isAdmin && (
          <Link
            href="/manage/competitions/new"
            className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
          >
            + New competition
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Members", value: members.length },
          { label: "Competitions", value: competitions.length },
          { label: "Live", value: liveCount },
          { label: "Open for entries", value: openCount },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="text-3xl font-bold text-green-800">{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Invite members — admin only */}
      {isAdmin && <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Invite members</h2>
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
          <p className="text-sm text-gray-500 mb-3">
            Share this link with your members so they can find and enter your competitions.
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 font-mono overflow-x-auto whitespace-nowrap">
              {inviteUrl}
            </code>
            <button
              onClick={handleCopyLink}
              className="shrink-0 px-4 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>
      </section>}

      {/* Pending membership requests */}
      {pendingMembers && pendingMembers.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            Membership requests
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
              {pendingMembers.length}
            </span>
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

      {/* Active competitions */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Active Competitions</h2>
        {activeComps.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
            <p className="text-gray-400 mb-3">No active competitions</p>
            {isAdmin && (
              <Link href="/manage/competitions/new" className="text-green-700 font-medium hover:underline text-sm">
                Create your first pool →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {activeComps.map(comp => (
              <Link
                key={comp._id}
                href={isAdmin ? `/manage/competitions/${comp._id}` : `/${club.slug}/${comp.slug}`}
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

      {/* Data Import — super admin only */}
      {superAdmin && <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Data import</h2>
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3">
          <p className="text-sm text-gray-500">
            Give this token to your results scraper. It can only push results for{" "}
            <span className="font-medium text-gray-700">{club.name}</span> — it cannot
            access any other data. Regenerate it at any time to revoke the old one.
          </p>
          {club.importToken ? (
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 font-mono overflow-x-auto whitespace-nowrap">
                {club.importToken}
              </code>
              <button
                onClick={handleCopyToken}
                className="shrink-0 px-4 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
              >
                {tokenCopied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleGenerateToken}
                disabled={generatingToken}
                className="shrink-0 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Regenerate
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateToken}
              disabled={generatingToken}
              className="px-4 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {generatingToken ? "Generating…" : "Generate import token"}
            </button>
          )}
        </div>
      </section>}

      {/* Club leaderboard */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Club leaderboard</h2>
          <Link href="/manage/members" className="text-sm text-green-700 hover:underline">
            All members →
          </Link>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-xl px-5 py-4">
            No members yet — they'll appear once people enter a competition.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium text-right">Entered</th>
                  <th className="px-5 py-3 font-medium text-right">Won</th>
                  <th className="px-5 py-3 font-medium text-right">P/L</th>
                </tr>
              </thead>
              <tbody>
                {[...members].sort((a, b) => b.totalWon - a.totalWon).map((m, i) => (
                  <tr key={m._id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
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
        )}
      </section>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
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
