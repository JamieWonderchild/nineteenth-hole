"use client";

import { useState, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Plus, X, Calendar, Shield } from "lucide-react";
import Link from "next/link";

type Team = {
  _id: Id<"interclubTeams">;
  teamName: string;
  clubName: string;
  handicapMin?: number;
  handicapMax?: number;
  captainUserId?: string;
};

function AddTeamModal({
  leagueId,
  clubId,
  clubName,
  team,
  onClose,
}: {
  leagueId: Id<"interclubLeagues">;
  clubId: Id<"clubs">;
  clubName: string;
  team?: Team;
  onClose: () => void;
}) {
  const saveTeam = useMutation(api.interclub.saveTeam);
  const members = useQuery(api.clubMembers.listByClub, { clubId });
  const [form, setForm] = useState({
    teamName: team?.teamName ?? "",
    handicapMin: team?.handicapMin?.toString() ?? "",
    handicapMax: team?.handicapMax?.toString() ?? "",
    captainUserId: team?.captainUserId ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.teamName.trim()) return;
    setSaving(true);
    try {
      await saveTeam({
        leagueId,
        teamId: team?._id,
        clubId,
        clubName,
        teamName: form.teamName.trim(),
        handicapMin: form.handicapMin ? parseFloat(form.handicapMin) : undefined,
        handicapMax: form.handicapMax ? parseFloat(form.handicapMax) : undefined,
        captainUserId: form.captainUserId || undefined,
      });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{team ? "Edit team" : "Add team"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Team name *</label>
            <input type="text" value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))}
              placeholder="e.g. Sabres, Tigers, Foxes"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min handicap</label>
              <input type="number" value={form.handicapMin} onChange={e => setForm(f => ({ ...f, handicapMin: e.target.value }))}
                placeholder="0" step="0.1" min="-5"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max handicap</label>
              <input type="number" value={form.handicapMax} onChange={e => setForm(f => ({ ...f, handicapMax: e.target.value }))}
                placeholder="12" step="0.1" max="54"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Team captain / league rep</label>
            <select value={form.captainUserId} onChange={e => setForm(f => ({ ...f, captainUserId: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">None assigned</option>
              {(members ?? []).map(m => (
                <option key={m._id} value={m.userId}>{m.displayName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.teamName.trim()}
            className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewFixtureModal({
  leagueId,
  teams,
  myTeamId,
  onClose,
}: {
  leagueId: Id<"interclubLeagues">;
  teams: Team[];
  myTeamId?: Id<"interclubTeams">;
  onClose: () => void;
}) {
  const createFixture = useMutation(api.interclub.createFixture);
  const [homeTeamId, setHomeTeamId] = useState<string>(myTeamId ?? "");
  const [awayTeamId, setAwayTeamId] = useState<string>("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!homeTeamId || !awayTeamId) return;
    setSaving(true);
    try {
      await createFixture({
        leagueId,
        homeTeamId: homeTeamId as Id<"interclubTeams">,
        awayTeamId: awayTeamId as Id<"interclubTeams">,
        date: date || undefined,
        venue: venue.trim() || undefined,
      });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Schedule fixture</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Home team *</label>
            <select value={homeTeamId} onChange={e => setHomeTeamId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Select team</option>
              {teams.map(t => <option key={t._id} value={t._id}>{t.clubName} {t.teamName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Away team *</label>
            <select value={awayTeamId} onChange={e => setAwayTeamId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">Select team</option>
              {teams.filter(t => t._id !== homeTeamId).map(t => (
                <option key={t._id} value={t._id}>{t.clubName} {t.teamName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Venue</label>
              <input type="text" value={venue} onChange={e => setVenue(e.target.value)}
                placeholder="e.g. Home"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSave} disabled={saving || !homeTeamId || !awayTeamId}
            className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
            {saving ? "Saving…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-gray-100 text-gray-500",
  in_progress: "bg-amber-100 text-amber-700",
  complete: "bg-green-100 text-green-700",
  postponed: "bg-red-100 text-red-500",
};

export default function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = use(params);
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const isAdmin = activeMembership?.role === "admin";
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");

  const league = useQuery(api.interclub.getLeague, { leagueId: leagueId as Id<"interclubLeagues"> });
  const teams = useQuery(api.interclub.listTeams, { leagueId: leagueId as Id<"interclubLeagues"> });
  const fixtures = useQuery(api.interclub.listFixtures, { leagueId: leagueId as Id<"interclubLeagues"> });
  const table = useQuery(api.interclub.standings, { leagueId: leagueId as Id<"interclubLeagues"> });

  const [tab, setTab] = useState<"fixtures" | "table" | "teams">("fixtures");
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showNewFixture, setShowNewFixture] = useState(false);

  if (!league || !teams || !fixtures || !table) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  }

  const myTeam = club ? teams.find(t => t.clubId === club._id) : undefined;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/manage/interclub" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{league.name}</h1>
          <p className="text-sm text-gray-500">{league.season}{league.county ? ` · ${league.county}` : ""}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {tab === "fixtures" && (
              <button onClick={() => setShowNewFixture(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl">
                <Plus size={14} /> Fixture
              </button>
            )}
            {tab === "teams" && club && (
              <button onClick={() => setShowAddTeam(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl">
                <Plus size={14} /> Team
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["fixtures", "table", "teams"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Fixtures */}
      {tab === "fixtures" && (
        fixtures.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
            <Calendar size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No fixtures scheduled yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {fixtures.map(f => (
              <Link key={f._id} href={`/manage/interclub/${leagueId}/fixture/${f._id}`}
                className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-300 hover:shadow-sm transition-all">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">
                    {f.homeTeam?.clubName} {f.homeTeam?.teamName}
                    <span className="text-gray-400 mx-2">vs</span>
                    {f.awayTeam?.clubName} {f.awayTeam?.teamName}
                  </p>
                  {f.date && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(f.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      {f.venue ? ` · ${f.venue}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {f.status === "complete" && f.homePoints != null && (
                    <span className="font-bold text-gray-900 text-sm">
                      {f.homePoints} – {f.awayPoints}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[f.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {f.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )
      )}

      {/* League table */}
      {tab === "table" && (
        table.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
            <p className="text-gray-400 text-sm">No results to show yet</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium text-left w-8">Pos</th>
                  <th className="px-5 py-3 font-medium text-left">Team</th>
                  <th className="px-3 py-3 font-medium text-center">P</th>
                  <th className="px-3 py-3 font-medium text-center">W</th>
                  <th className="px-3 py-3 font-medium text-center">D</th>
                  <th className="px-3 py-3 font-medium text-center">L</th>
                  <th className="px-3 py-3 font-medium text-center hidden sm:table-cell">MP+</th>
                  <th className="px-3 py-3 font-medium text-center hidden sm:table-cell">MP-</th>
                  <th className="px-5 py-3 font-medium text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {table.map(row => (
                  <tr key={row.teamId} className={`border-b border-gray-50 last:border-0 ${myTeam?._id === row.teamId ? "bg-green-50/50" : ""}`}>
                    <td className="px-5 py-3 text-center text-gray-500 font-medium">{row.position}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900">{row.clubName}</p>
                      <p className="text-xs text-gray-400">{row.teamName}</p>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600">{row.played}</td>
                    <td className="px-3 py-3 text-center text-gray-600">{row.won}</td>
                    <td className="px-3 py-3 text-center text-gray-600">{row.drawn}</td>
                    <td className="px-3 py-3 text-center text-gray-600">{row.lost}</td>
                    <td className="px-3 py-3 text-center text-gray-400 hidden sm:table-cell">{row.matchPointsFor}</td>
                    <td className="px-3 py-3 text-center text-gray-400 hidden sm:table-cell">{row.matchPointsAgainst}</td>
                    <td className="px-5 py-3 text-right font-bold text-green-800">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Teams */}
      {tab === "teams" && (
        teams.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
            <Shield size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No teams registered yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teams.map(team => (
              <div key={team._id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
                <p className="font-semibold text-gray-900">{team.teamName}</p>
                <p className="text-sm text-gray-500">{team.clubName}</p>
                {(team.handicapMin != null || team.handicapMax != null) && (
                  <p className="text-xs text-gray-400 mt-1">
                    Handicap {team.handicapMin ?? "—"} – {team.handicapMax ?? "—"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {showAddTeam && club && (
        <AddTeamModal
          leagueId={leagueId as Id<"interclubLeagues">}
          clubId={club._id}
          clubName={club.name}
          onClose={() => setShowAddTeam(false)}
        />
      )}
      {showNewFixture && (
        <NewFixtureModal
          leagueId={leagueId as Id<"interclubLeagues">}
          teams={teams}
          myTeamId={myTeam?._id}
          onClose={() => setShowNewFixture(false)}
        />
      )}
    </div>
  );
}
