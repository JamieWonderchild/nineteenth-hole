"use client";

import { useState, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Plus, X, Calendar, Shield, Search, MapPin, PlusCircle, Pencil, Check, Settings } from "lucide-react";
import Link from "next/link";

type Team = {
  _id: Id<"interclubTeams">;
  teamName: string;
  clubName: string;
  handicapMin?: number;
  handicapMax?: number;
  captainUserId?: string;
};

type GolfClub = { _id: Id<"golfClubs">; name: string; county: string; postcode?: string };

function AddTeamModal({
  leagueId,
  leagueCounty,
  ownClubId,
  ownClubName,
  team,
  onClose,
}: {
  leagueId: Id<"interclubLeagues">;
  leagueCounty?: string;
  ownClubId: Id<"clubs">;
  ownClubName: string;
  team?: Team;
  onClose: () => void;
}) {
  const saveTeam = useMutation(api.interclub.saveTeam);
  const createGolfClub = useMutation(api.golfClubs.create);
  const members = useQuery(api.clubMembers.listByClub, { clubId: ownClubId });

  // "own" = adding a team for my club, "opponent" = adding another club
  const [side, setSide] = useState<"own" | "opponent">(team ? "own" : "own");
  const [opponentSearch, setOpponentSearch] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState<GolfClub | null>(null);

  const directoryResults = useQuery(
    api.golfClubs.search,
    opponentSearch.length >= 2 ? { term: opponentSearch, county: leagueCounty } : "skip"
  ) as GolfClub[] | undefined;

  const [form, setForm] = useState({
    teamName: team?.teamName ?? "",
    handicapMin: team?.handicapMin?.toString() ?? "",
    handicapMax: team?.handicapMax?.toString() ?? "",
    captainUserId: team?.captainUserId ?? "",
  });
  const [saving, setSaving] = useState(false);

  const resolvedClubName = side === "own" ? ownClubName : (selectedOpponent?.name ?? "");

  async function handleAddNewClub() {
    if (!opponentSearch.trim()) return;
    setSaving(true);
    try {
      const golfClubId = await createGolfClub({
        name: opponentSearch.trim(),
        county: leagueCounty ?? "Unknown",
      });
      setSelectedOpponent({ _id: golfClubId as Id<"golfClubs">, name: opponentSearch.trim(), county: leagueCounty ?? "Unknown" });
    } finally { setSaving(false); }
  }

  async function handleSave() {
    if (!form.teamName.trim()) return;
    if (side === "opponent" && !selectedOpponent) return;
    setSaving(true);
    try {
      await saveTeam({
        leagueId,
        teamId: team?._id,
        clubId: side === "own" ? ownClubId : undefined,
        golfClubId: selectedOpponent?._id,
        clubName: resolvedClubName,
        teamName: form.teamName.trim(),
        handicapMin: form.handicapMin ? parseFloat(form.handicapMin) : undefined,
        handicapMax: form.handicapMax ? parseFloat(form.handicapMax) : undefined,
        captainUserId: side === "own" ? (form.captainUserId || undefined) : undefined,
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

          {/* Side toggle — only show when adding new */}
          {!team && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(["own", "opponent"] as const).map(s => (
                <button key={s} onClick={() => setSide(s)}
                  className={`flex-1 py-2 font-medium transition-colors ${side === s ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                  {s === "own" ? "My club" : "Opposition"}
                </button>
              ))}
            </div>
          )}

          {/* Club identification */}
          {side === "own" ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
              <Shield size={14} className="text-green-600 shrink-0" />
              <span className="text-sm font-medium text-green-800">{ownClubName}</span>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">
                Opposition club {leagueCounty ? `(${leagueCounty})` : ""}
              </label>
              {selectedOpponent ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <MapPin size={14} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedOpponent.name}</p>
                    <p className="text-xs text-gray-400">{selectedOpponent.county}{selectedOpponent.postcode ? ` · ${selectedOpponent.postcode}` : ""}</p>
                  </div>
                  <button onClick={() => { setSelectedOpponent(null); setOpponentSearch(""); }}
                    className="text-gray-300 hover:text-gray-500"><X size={13} /></button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={opponentSearch} onChange={e => setOpponentSearch(e.target.value)}
                      placeholder="Search clubs…" autoFocus
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  {opponentSearch.length >= 2 && directoryResults !== undefined && (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-40 overflow-y-auto">
                      {directoryResults.map(club => (
                        <button key={club._id} onClick={() => setSelectedOpponent(club)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-green-50 text-left transition-colors">
                          <MapPin size={12} className="text-gray-300 shrink-0" />
                          <div>
                            <p className="text-sm text-gray-900">{club.name}</p>
                            <p className="text-xs text-gray-400">{club.postcode}</p>
                          </div>
                        </button>
                      ))}
                      <button onClick={handleAddNewClub} disabled={saving}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-green-50 text-left transition-colors text-green-700">
                        <PlusCircle size={12} className="shrink-0" />
                        <p className="text-sm font-medium">Add &ldquo;{opponentSearch.trim()}&rdquo; as new club</p>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Team name *</label>
            <input type="text" value={form.teamName} onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))}
              placeholder="e.g. Sabres, A Team, 1st XI"
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

          {side === "own" && (
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
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSave}
            disabled={saving || !form.teamName.trim() || (side === "opponent" && !selectedOpponent)}
            className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

type FixtureData = {
  _id: Id<"interclubFixtures">;
  status: string;
  date?: string;
  venue?: string;
  homePoints?: number;
  awayPoints?: number;
  homeTeam?: { clubName: string; teamName: string } | null;
  awayTeam?: { clubName: string; teamName: string } | null;
};

function FixtureCard({ fixture: f, leagueId, isAdmin }: { fixture: FixtureData; leagueId: string; isAdmin: boolean }) {
  const updateFixture = useMutation(api.interclub.updateFixture);
  const [scoring, setScoring] = useState(false);
  const [home, setHome] = useState(f.homePoints?.toString() ?? "");
  const [away, setAway] = useState(f.awayPoints?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSaveScore(e: React.FormEvent) {
    e.preventDefault();
    const hp = parseFloat(home);
    const ap = parseFloat(away);
    if (isNaN(hp) || isNaN(ap)) return;
    setSaving(true);
    try {
      await updateFixture({ fixtureId: f._id, homePoints: hp, awayPoints: ap });
      setScoring(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-300 hover:shadow-sm transition-all">
      <div className="flex items-center gap-4">
        <Link href={`/manage/interclub/${leagueId}/fixture/${f._id}`} className="flex-1 min-w-0">
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
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          {f.status === "complete" && f.homePoints != null ? (
            <span className="font-bold text-gray-900 text-sm tabular-nums">{f.homePoints} – {f.awayPoints}</span>
          ) : null}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[f.status] ?? "bg-gray-100 text-gray-500"}`}>
            {f.status.replace("_", " ")}
          </span>
          {isAdmin && (
            <button onClick={() => { setHome(f.homePoints?.toString() ?? ""); setAway(f.awayPoints?.toString() ?? ""); setScoring(s => !s); }}
              className="text-gray-300 hover:text-green-600 transition-colors" title="Set score">
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      {scoring && (
        <form onSubmit={handleSaveScore} className="mt-3 flex items-center gap-2 pl-0">
          <span className="text-xs text-gray-400">Score:</span>
          <input type="number" value={home} onChange={e => setHome(e.target.value)}
            min="0" step="0.5" placeholder="0" autoFocus
            className="w-14 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-green-500" />
          <span className="text-gray-400 text-sm font-bold">–</span>
          <input type="number" value={away} onChange={e => setAway(e.target.value)}
            min="0" step="0.5" placeholder="0"
            className="w-14 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-green-500" />
          <button type="submit" disabled={saving}
            className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg">
            <Check size={11} /> {saving ? "…" : "Save"}
          </button>
          <button type="button" onClick={() => setScoring(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </form>
      )}
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

  const updateLeague = useMutation(api.interclub.updateLeague);
  const [tab, setTab] = useState<"fixtures" | "table" | "teams">("fixtures");
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showNewFixture, setShowNewFixture] = useState(false);
  const [editingLeague, setEditingLeague] = useState(false);
  const [leagueForm, setLeagueForm] = useState({
    matchType: league?.matchType ?? "singles",
    handicapMin: league?.handicapMin?.toString() ?? "",
    handicapMax: league?.handicapMax?.toString() ?? "",
  });

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
          <p className="text-sm text-gray-500">
            {league.season}{league.county ? ` · ${league.county}` : ""}
            {league.matchType && league.matchType !== "singles" ? ` · ${league.matchType === "betterball" ? "4-ball BB" : "Mixed"}` : ""}
            {league.handicapMin != null ? ` · HCP ${league.handicapMin}+` : ""}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => { setLeagueForm({ matchType: league.matchType ?? "singles", handicapMin: league.handicapMin?.toString() ?? "", handicapMax: league.handicapMax?.toString() ?? "" }); setEditingLeague(e => !e); }}
              className="p-2 text-gray-400 hover:text-gray-700 transition-colors" title="League settings">
              <Settings size={16} />
            </button>
            {tab === "fixtures" && teams.length >= 2 && (
              <button onClick={() => setShowNewFixture(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl">
                <Plus size={14} /> Fixture
              </button>
            )}
            {(tab === "teams" || (tab === "fixtures" && teams.length < 2)) && club && (
              <button onClick={() => { setTab("teams"); setShowAddTeam(true); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl">
                <Plus size={14} /> Team
              </button>
            )}
          </div>
        )}
      </div>

      {/* League settings panel */}
      {editingLeague && isAdmin && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">League settings</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Match type</label>
              <select value={leagueForm.matchType} onChange={e => setLeagueForm(f => ({ ...f, matchType: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="singles">Singles</option>
                <option value="betterball">4-ball better ball</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min handicap</label>
              <input type="number" value={leagueForm.handicapMin} onChange={e => setLeagueForm(f => ({ ...f, handicapMin: e.target.value }))}
                placeholder="e.g. 5.5" step="0.1"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Max handicap</label>
              <input type="number" value={leagueForm.handicapMax} onChange={e => setLeagueForm(f => ({ ...f, handicapMax: e.target.value }))}
                placeholder="none"  step="0.1"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditingLeague(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
            <button onClick={async () => {
              await updateLeague({
                leagueId: leagueId as Id<"interclubLeagues">,
                matchType: leagueForm.matchType,
                handicapMin: leagueForm.handicapMin ? parseFloat(leagueForm.handicapMin) : undefined,
                handicapMax: leagueForm.handicapMax ? parseFloat(leagueForm.handicapMax) : undefined,
              });
              setEditingLeague(false);
            }} className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg">
              <Check size={13} /> Save
            </button>
          </div>
        </div>
      )}

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
        teams.length < 2 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
            <Shield size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">Add teams first</p>
            <p className="text-gray-400 text-xs mt-1">You need at least 2 teams before you can schedule fixtures</p>
            {isAdmin && club && (
              <button onClick={() => { setTab("teams"); setShowAddTeam(true); }}
                className="mt-4 text-sm text-green-600 hover:underline font-medium">
                Add a team →
              </button>
            )}
          </div>
        ) : fixtures.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
            <Calendar size={28} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No fixtures scheduled yet</p>
            {isAdmin && (
              <button onClick={() => setShowNewFixture(true)} className="mt-2 text-sm text-green-600 hover:underline">
                Schedule the first fixture
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {fixtures.map(f => (
              <FixtureCard key={f._id} fixture={f} leagueId={leagueId} isAdmin={isAdmin} />
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
          leagueCounty={league.county}
          ownClubId={club._id}
          ownClubName={club.name}
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
