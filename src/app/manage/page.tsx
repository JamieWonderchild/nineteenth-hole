"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { Trophy, Users, CalendarDays, TrendingUp, Star, ArrowRight, Zap, ChevronRight, Send, Mail } from "lucide-react";

export default function ManagePage() {
  const router = useRouter();
  const { user } = useUser();

  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const memberships = useQuery(
    api.clubMembers.listByUser,
    user ? { userId: user.id } : "skip"
  );
  const { activeMembership, club } = useActiveClub();
  const pendingMembership = memberships?.find(m => m.status === "pending");
  const isAdmin = activeMembership?.role === "admin" || superAdmin === true;
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
  const todayRevenue = useQuery(
    api.pos.salesSummary,
    (club && isAdmin) ? { clubId: club._id, date: new Date().toISOString().slice(0, 10) } : "skip"
  );
  const golferProfile = useQuery(
    api.golferProfiles.get,
    (!activeMembership && user) ? { userId: user.id } : "skip"
  );
  const upsertGolferProfile = useMutation(api.golferProfiles.upsert);
  const recentGames = useQuery(
    api.quickGames.listByUser,
    (!activeMembership && user) ? { userId: user.id } : "skip"
  );
  const approveMember = useMutation(api.clubMembers.approveMember);
  const rejectMember = useMutation(api.clubMembers.rejectMember);
  const generateImportToken = useMutation(api.clubs.generateImportToken);

  const [copied, setCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

  useEffect(() => {
    if (superAdmin && !activeMembership && memberships !== undefined) {
      router.push("/manage/platform");
    }
  }, [superAdmin, activeMembership, memberships, router]);

  if (superAdmin === undefined || memberships === undefined) return <Spinner />;

  if (!activeMembership) {
    if (pendingMembership) {
      return (
        <div className="flex items-center justify-center h-full min-h-[60vh] px-4">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Membership pending</h1>
            <p className="text-gray-500 text-sm">Your request to join has been received. An admin will approve you shortly.</p>
          </div>
        </div>
      );
    }
    return (
      <GolferDashboard
        user={user}
        profile={golferProfile ?? null}
        recentGames={recentGames ?? []}
        onSaveProfile={(handicap, homeClub) =>
          upsertGolferProfile({
            displayName: user?.fullName ?? user?.username ?? "Golfer",
            handicapIndex: handicap,
            homeClub,
          })
        }
      />
    );
  }

  if (!club || !competitions || !members) return <Spinner />;

  const inviteUrl = typeof window !== "undefined"
    ? `https://${window.location.hostname}/${club.slug}`
    : `https://the19thhole.golf/${club.slug}`;

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  function handleCopyToken() {
    if (!club?.importToken) return;
    navigator.clipboard.writeText(club.importToken).then(() => { setTokenCopied(true); setTimeout(() => setTokenCopied(false), 2000); });
  }
  async function handleGenerateToken() {
    if (!club) return;
    setGeneratingToken(true);
    try { await generateImportToken({ clubId: club._id }); } finally { setGeneratingToken(false); }
  }

  return isAdmin
    ? <AdminDashboard
        club={club}
        competitions={competitions}
        members={members}
        pendingMembers={pendingMembers ?? []}
        todayRevenuePence={todayRevenue?.totalRevenue ?? 0}
        inviteUrl={inviteUrl}
        copied={copied}
        onCopyLink={handleCopyLink}
        tokenCopied={tokenCopied}
        onCopyToken={handleCopyToken}
        generatingToken={generatingToken}
        onGenerateToken={handleGenerateToken}
        superAdmin={superAdmin ?? false}
        onApprove={(id) => approveMember({ memberId: id as any })}
        onReject={(id) => rejectMember({ memberId: id as any })}
      />
    : <MemberDashboard
        club={club}
        membership={activeMembership}
        competitions={competitions}
        members={members}
        userId={user?.id ?? ""}
        inviteUrl={inviteUrl}
        copied={copied}
        onCopyLink={handleCopyLink}
      />;
}

// ── Golfer Dashboard (no club affiliation) ─────────────────────────────────────

type GolferProfile = { handicapIndex?: number; homeClub?: string } | null;
type QuickGame = { _id: string; name: string; type: string; status: string; date: string; players: { id: string; name: string }[]; stakePerPlayer: number; currency: string; result?: { summary: string } | null };

function GolferDashboard({
  user, profile, recentGames, onSaveProfile,
}: {
  user: { fullName?: string | null; firstName?: string | null } | null | undefined;
  profile: GolferProfile;
  recentGames: QuickGame[];
  onSaveProfile: (handicap: number | undefined, homeClub: string) => Promise<unknown>;
}) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [handicapStr, setHandicapStr] = useState(profile?.handicapIndex?.toString() ?? "");
  const [homeClub, setHomeClub] = useState(profile?.homeClub ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const hcp = handicapStr ? parseFloat(handicapStr) : undefined;
      await onSaveProfile(hcp, homeClub);
      setEditingProfile(false);
    } finally {
      setSaving(false);
    }
  }

  const activeGames = recentGames.filter(g => g.status !== "complete").slice(0, 3);
  const completedGames = recentGames.filter(g => g.status === "complete").slice(0, 3);
  const hasProfile = profile && (profile.handicapIndex != null || profile.homeClub);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Hero — handicap + greeting */}
      <div className="bg-gradient-to-br from-green-800 to-green-950 rounded-2xl px-6 py-7 flex items-center justify-between gap-4">
        <div>
          <p className="text-green-300 text-sm font-medium mb-0.5">
            {user?.firstName ? `Welcome back, ${user.firstName}` : "Welcome back"}
          </p>
          <h1 className="text-2xl font-bold text-white">
            {profile?.homeClub || "Your dashboard"}
          </h1>
          {!hasProfile && (
            <button
              onClick={() => setEditingProfile(true)}
              className="mt-3 text-xs text-green-300 underline underline-offset-2"
            >
              Set your handicap
            </button>
          )}
        </div>
        {profile?.handicapIndex != null ? (
          <div className="text-center shrink-0">
            <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/20 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white leading-none">{profile.handicapIndex.toFixed(1)}</span>
              <span className="text-green-300 text-[10px] font-medium mt-0.5 uppercase tracking-wide">HCP</span>
            </div>
            <button onClick={() => setEditingProfile(true)} className="text-[11px] text-green-400 mt-1.5 hover:underline">
              Edit
            </button>
          </div>
        ) : (
          <div className="text-center shrink-0">
            <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setEditingProfile(true)}>
              <span className="text-white/40 text-2xl font-black leading-none">?</span>
              <span className="text-green-400/60 text-[10px] font-medium mt-0.5 uppercase tracking-wide">HCP</span>
            </div>
          </div>
        )}
      </div>

      {/* Profile edit form */}
      {(editingProfile || (!hasProfile && !editingProfile)) && (
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            {hasProfile ? "Update your profile" : "Quick setup — takes 10 seconds"}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Handicap index</label>
                <input
                  type="number"
                  value={handicapStr}
                  onChange={e => setHandicapStr(e.target.value)}
                  placeholder="e.g. 14.2"
                  step="0.1" min="-5" max="54"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Home club</label>
                <input
                  type="text"
                  value={homeClub}
                  onChange={e => setHomeClub(e.target.value)}
                  placeholder="e.g. Finchley Golf Club"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {hasProfile && (
                <button type="button" onClick={() => setEditingProfile(false)} className="text-sm text-gray-400 hover:text-gray-600">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/games?new=1"
            className="flex items-center gap-3 bg-green-700 hover:bg-green-600 text-white rounded-xl px-5 py-4 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm">New game</div>
              <div className="text-green-200 text-xs">Stableford, nassau &amp; more</div>
            </div>
          </Link>
          <Link
            href="/games"
            className="flex items-center gap-3 bg-white border border-gray-200 hover:border-green-400 rounded-xl px-5 py-4 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Star size={18} className="text-gray-500" />
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-900">My games</div>
              <div className="text-gray-400 text-xs">{recentGames.length > 0 ? `${recentGames.length} game${recentGames.length !== 1 ? "s" : ""}` : "No games yet"}</div>
            </div>
          </Link>
          <Link
            href="/pools"
            className="flex items-center gap-3 bg-white border border-gray-200 hover:border-green-400 rounded-xl px-5 py-4 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center shrink-0">
              <Trophy size={18} className="text-yellow-500" />
            </div>
            <div>
              <div className="font-semibold text-sm text-gray-900">Tour pools</div>
              <div className="text-gray-400 text-xs">Masters, The Open &amp; more</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent games */}
      {recentGames.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recent games</h2>
            <Link href="/games" className="text-sm text-green-700 hover:underline">All games →</Link>
          </div>
          <div className="space-y-2">
            {[...activeGames, ...completedGames].map(game => {
              const sym = game.currency === "GBP" ? "£" : game.currency === "EUR" ? "€" : "$";
              return (
                <Link
                  key={game._id}
                  href={`/games/${game._id}`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors"
                >
                  <div>
                    <div className="font-medium text-gray-900">{game.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {game.type.charAt(0).toUpperCase() + game.type.slice(1)}
                      {" · "}{game.players.length} players
                      {game.stakePerPlayer > 0 && ` · ${sym}${(game.stakePerPlayer / 100).toFixed(0)}/player`}
                      {" · "}{new Date(game.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                    {game.result?.summary && (
                      <p className="text-sm text-green-700 font-medium mt-0.5">{game.result.summary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${game.status === "complete" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                      {game.status === "complete" ? "Done" : "Active"}
                    </span>
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Invite club CTA */}
      <div className="bg-gray-900 rounded-xl px-6 py-5">
        <h3 className="font-semibold text-white mb-1">Is your club on The 19th Hole?</h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          If your club uses our platform, you can join and access competitions, interclub results, tee time booking, and more. Ask your club secretary or admin to invite you.
        </p>
        <p className="text-gray-400 text-sm mt-2">
          Not on the platform yet?{" "}
          <a href="mailto:hello@the19thhole.golf?subject=Club enquiry" className="text-green-400 hover:underline">
            Let us know
          </a>{" "}
          and we&apos;ll reach out to your club.
        </p>
      </div>
    </div>
  );
}

// ── Admin Dashboard ────────────────────────────────────────────────────────────

type Competition = { _id: string; name: string; status: string; startDate: string; entryFee: number; currency: string; slug: string };
type Member = { _id: string; displayName: string; totalWon: number; totalEntered: number; totalProfit: number };
type ClubMember = { _id: string; displayName: string };
type Club = { _id: string; name: string; slug: string; currency: string; importToken?: string };
type Membership = { role: string; totalEntered: number; totalWon: number; totalProfit: number; bestFinish?: number; handicap?: number; displayName: string };

function AdminDashboard({
  club, competitions, members, pendingMembers, todayRevenuePence,
  inviteUrl, copied, onCopyLink, tokenCopied, onCopyToken,
  generatingToken, onGenerateToken, superAdmin, onApprove, onReject,
}: {
  club: Club; competitions: Competition[]; members: Member[]; pendingMembers: ClubMember[];
  todayRevenuePence: number; inviteUrl: string; copied: boolean; onCopyLink: () => void;
  tokenCopied: boolean; onCopyToken: () => void; generatingToken: boolean;
  onGenerateToken: () => void; superAdmin: boolean;
  onApprove: (id: string) => void; onReject: (id: string) => void;
}) {
  const liveCount = competitions.filter(c => c.status === "live").length;
  const activeComps = competitions.filter(c => c.status !== "complete" && c.status !== "draft");

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">Admin dashboard</p>
        </div>
        <Link
          href="/manage/competitions/new"
          className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
        >
          + New competition
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <Users size={18} className="text-blue-600" />, label: "Members", value: members.length, bg: "bg-blue-50" },
          { icon: <CalendarDays size={18} className="text-green-600" />, label: "Active comps", value: activeComps.length, bg: "bg-green-50" },
          { icon: <TrendingUp size={18} className="text-orange-600" />, label: "Live now", value: liveCount, bg: "bg-orange-50" },
          { icon: <Trophy size={18} className="text-purple-600" />, label: "POS today", value: formatCurrency(todayRevenuePence, club.currency), bg: "bg-purple-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>{s.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending requests */}
      {pendingMembers.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            Membership requests
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">{pendingMembers.length}</span>
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {pendingMembers.map((m: ClubMember) => (
              <div key={m._id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium text-gray-900">{m.displayName}</span>
                <div className="flex gap-2">
                  <button onClick={() => onApprove(m._id)} className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-500">Approve</button>
                  <button onClick={() => onReject(m._id)} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active competitions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Active competitions</h2>
          <Link href="/manage/competitions/new" className="text-sm text-green-700 hover:underline">+ New</Link>
        </div>
        {activeComps.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
            <p className="text-gray-400 mb-3">No active competitions</p>
            <Link href="/manage/competitions/new" className="text-green-700 font-medium hover:underline text-sm">Create your first →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {activeComps.map(comp => (
              <Link
                key={comp._id}
                href={`/manage/competitions/${comp._id}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors"
              >
                <div>
                  <div className="font-medium text-gray-900">{comp.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {new Date(comp.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}{formatCurrency(comp.entryFee, comp.currency)} entry
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={comp.status} />
                  <ArrowRight size={16} className="text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick links row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: "/manage/members", label: "Manage members", desc: `${members.length} active` },
          { href: "/manage/tee-times", label: "Tee times", desc: "Book & manage slots" },
          { href: "/manage/pos", label: "Bar & pro shop", desc: "Point of sale" },
        ].map(l => (
          <Link key={l.href} href={l.href} className="bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 text-sm">{l.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{l.desc}</div>
            </div>
            <ArrowRight size={16} className="text-gray-400" />
          </Link>
        ))}
      </div>

      {/* Invite members */}
      <InviteSection clubId={club._id} inviteUrl={inviteUrl} copied={copied} onCopyLink={onCopyLink} />

      {/* Data import — super admin only */}
      {superAdmin && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Data import token</h2>
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3">
            <p className="text-sm text-gray-500">Give this token to your results scraper.</p>
            {club.importToken ? (
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 font-mono overflow-x-auto whitespace-nowrap">{club.importToken}</code>
                <button onClick={onCopyToken} className="shrink-0 px-4 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors">{tokenCopied ? "Copied!" : "Copy"}</button>
                <button onClick={onGenerateToken} disabled={generatingToken} className="shrink-0 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">Regenerate</button>
              </div>
            ) : (
              <button onClick={onGenerateToken} disabled={generatingToken} className="px-4 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50">
                {generatingToken ? "Generating…" : "Generate import token"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Club leaderboard */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Club leaderboard</h2>
          <Link href="/manage/members" className="text-sm text-green-700 hover:underline">All members →</Link>
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
                {[...members].sort((a, b) => b.totalWon - a.totalWon).slice(0, 10).map((m, i) => (
                  <tr key={m._id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{m.displayName}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{m.totalEntered}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(m.totalWon, club.currency)}</td>
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

// ── Member Dashboard ───────────────────────────────────────────────────────────

function MemberDashboard({
  club, membership, competitions, members, userId, inviteUrl, copied, onCopyLink,
}: {
  club: Club; membership: Membership; competitions: Competition[]; members: Member[];
  userId: string; inviteUrl: string; copied: boolean; onCopyLink: () => void;
}) {
  const openComps = competitions.filter(c => c.status === "open" || c.status === "live");
  const sortedMembers = [...members].sort((a, b) => b.totalWon - a.totalWon);
  const myPosition = sortedMembers.findIndex(m => "userId" in m ? (m as any).userId === userId : false) + 1;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {membership.displayName.split(" ")[0]}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{club.name}</p>
        </div>
        {membership.handicap != null && (
          <div className="text-center bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-green-800">{membership.handicap.toFixed(1)}</div>
            <div className="text-xs text-green-600 mt-0.5">Handicap</div>
          </div>
        )}
      </div>

      {/* My stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <CalendarDays size={18} className="text-blue-600" />, label: "Entered", value: membership.totalEntered, bg: "bg-blue-50" },
          { icon: <Star size={18} className="text-yellow-600" />, label: "Best finish", value: membership.bestFinish ? `${membership.bestFinish}${ordinal(membership.bestFinish)}` : "—", bg: "bg-yellow-50" },
          { icon: <Trophy size={18} className="text-green-600" />, label: "Total won", value: formatCurrency(membership.totalWon, club.currency), bg: "bg-green-50" },
          {
            icon: <TrendingUp size={18} className={membership.totalProfit >= 0 ? "text-green-600" : "text-red-500"} />,
            label: "P/L",
            value: (membership.totalProfit >= 0 ? "+" : "") + formatCurrency(membership.totalProfit, club.currency),
            bg: membership.totalProfit >= 0 ? "bg-green-50" : "bg-red-50",
          },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>{s.icon}</div>
            <div className="text-xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Open competitions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Competitions</h2>
        </div>
        {openComps.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
            <p className="text-gray-400">No competitions open right now — check back soon.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {openComps.map(comp => (
              <Link
                key={comp._id}
                href={`/${club.slug}/${comp.slug}`}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors"
              >
                <div>
                  <div className="font-medium text-gray-900">{comp.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {new Date(comp.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}{formatCurrency(comp.entryFee, comp.currency)} entry
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={comp.status} />
                  <ArrowRight size={16} className="text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Club leaderboard */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Club leaderboard</h2>
          {myPosition > 5 && (
            <span className="text-sm text-gray-500">You're {myPosition > 0 ? `#${myPosition}` : "unranked"}</span>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {sortedMembers.slice(0, 5).length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No results yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium text-right">Won</th>
                  <th className="px-5 py-3 font-medium text-right">P/L</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.slice(0, 5).map((m, i) => {
                  const isMe = (m as any).userId === userId;
                  return (
                    <tr key={m._id} className={`border-b border-gray-50 last:border-0 ${isMe ? "bg-green-50" : ""}`}>
                      <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {m.displayName}{isMe && <span className="ml-2 text-xs text-green-600 font-normal">you</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(m.totalWon, club.currency)}</td>
                      <td className={`px-5 py-3 text-right font-medium ${m.totalProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {m.totalProfit >= 0 ? "+" : ""}{formatCurrency(m.totalProfit, club.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/manage/tee-times" className="bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900 text-sm">Book a tee time</div>
            <div className="text-xs text-gray-500 mt-0.5">View available slots</div>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </Link>
        <Link href="/manage/directory" className="bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900 text-sm">Member directory</div>
            <div className="text-xs text-gray-500 mt-0.5">Find & message members</div>
          </div>
          <ArrowRight size={16} className="text-gray-400" />
        </Link>
      </div>
    </div>
  );
}

// ── Invite Section ─────────────────────────────────────────────────────────────

function InviteSection({
  clubId, inviteUrl, copied, onCopyLink,
}: {
  clubId: string;
  inviteUrl: string;
  copied: boolean;
  onCopyLink: () => void;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const sendInvite = useAction(api.invites.send);
  const pendingInvites = useQuery(api.invites.listByClub, { clubId: clubId as any });

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setErr(null);
    try {
      await sendInvite({ clubId: clubId as any, email: email.trim() });
      setSent(email.trim());
      setEmail("");
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Failed to send invite");
    } finally {
      setSending(false);
    }
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 mb-3">Invite members</h2>
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">

        {/* Email invite */}
        <div className="px-5 py-4">
          <p className="text-sm text-gray-500 mb-3">Send a personal invitation — the link is one-time use and expires in 7 days.</p>
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="member@email.com"
              required
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              <Send size={14} />
              {sending ? "Sending…" : "Send invite"}
            </button>
          </form>
          {sent && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
              <span>✓</span> Invite sent to {sent}
            </p>
          )}
          {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
        </div>

        {/* Pending invites */}
        {pendingInvites && pendingInvites.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Pending invites</p>
            <div className="space-y-1.5">
              {pendingInvites.map(inv => (
                <div key={inv._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-gray-400" />
                    <span className="text-sm text-gray-700">{inv.email}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    Expires {new Date(inv.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Public link — secondary option */}
        <div className="px-5 py-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Public join link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs text-gray-500 font-mono overflow-x-auto whitespace-nowrap">{inviteUrl}</code>
            <button onClick={onCopyLink} className="shrink-0 px-3 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Anyone with this link can request to join — requires admin approval.</p>
        </div>
      </div>
    </section>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  return <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
