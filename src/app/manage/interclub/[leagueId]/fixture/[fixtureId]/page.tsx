"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Plus, X, Check, Trash2, CheckCircle, XCircle, Clock, Users } from "lucide-react";
import Link from "next/link";

const RESULT_PRESETS = ["1 up", "2&1", "3&2", "4&3", "5&4", "6&5", "7&6", "AS", "halved"];

// ── AvailabilityPanel ──────────────────────────────────────────────────────────

type SquadMemberWithMember = {
  _id: Id<"squadMembers">;
  memberId: Id<"clubMembers">;
  member: { _id: Id<"clubMembers">; displayName: string; handicap?: number } | null;
};

type AvailabilityEntry = {
  memberId: Id<"clubMembers">;
  status: string;
  note?: string;
};

function AvailabilityPanel({
  fixtureId,
  teamId,
  squadMembers,
  availability,
  onMark,
  isAdmin,
}: {
  fixtureId: Id<"interclubFixtures">;
  teamId: Id<"interclubTeams">;
  squadMembers: SquadMemberWithMember[];
  availability: AvailabilityEntry[];
  onMark: (memberId: Id<"clubMembers">, status: "available" | "unavailable" | "tentative") => Promise<void>;
  isAdmin: boolean;
}) {
  const availMap = new Map(availability.map(a => [a.memberId, a.status]));
  const active = squadMembers.filter(s => s.member);

  const available = active.filter(s => availMap.get(s.memberId) === "available");
  const tentative = active.filter(s => availMap.get(s.memberId) === "tentative");
  const unavailable = active.filter(s => availMap.get(s.memberId) === "unavailable");
  const noResponse = active.filter(s => !availMap.has(s.memberId));

  const statusIcon = (status: string | undefined) => {
    if (status === "available") return <CheckCircle size={13} className="text-green-500" />;
    if (status === "tentative") return <Clock size={13} className="text-amber-500" />;
    if (status === "unavailable") return <XCircle size={13} className="text-red-400" />;
    return <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />;
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
        <Users size={13} className="text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Squad Availability</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {available.length} available · {tentative.length} maybe · {unavailable.length} out · {noResponse.length} no response
        </span>
      </div>
      <div className="divide-y divide-border">
        {active.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">No squad members — add players to the squad first.</p>
        ) : (
          [...available, ...tentative, ...noResponse, ...unavailable].map(s => {
            const status = availMap.get(s.memberId);
            return (
              <div key={s._id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  {statusIcon(status)}
                  <div>
                    <p className="text-xs font-medium text-foreground">{s.member?.displayName}</p>
                    {s.member?.handicap != null && <p className="text-[10px] text-muted-foreground">HCP {s.member.handicap}</p>}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    {(["available", "tentative", "unavailable"] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => onMark(s.memberId, st)}
                        className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                          status === st
                            ? st === "available" ? "bg-green-100 border-green-300 text-green-700"
                              : st === "tentative" ? "bg-amber-100 border-amber-300 text-amber-700"
                              : "bg-red-50 border-red-200 text-red-600"
                            : "border-border text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {st === "available" ? "✓ In" : st === "tentative" ? "? Maybe" : "✗ Out"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── PlayerSearchInput ──────────────────────────────────────────────────────────

type AvailableSquadMember = { _id: Id<"clubMembers">; displayName: string; handicap?: number; userId?: string };

function PlayerSearchInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  squadSuggestions,
}: {
  value: string;
  onChange: (name: string, userId?: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  squadSuggestions?: AvailableSquadMember[];
}) {
  const [focused, setFocused] = useState(false);
  const term = value.trim();
  const results = useQuery(
    api.golferProfiles.search,
    focused && term.length >= 2 ? { term } : "skip"
  );

  const filteredSquad = (squadSuggestions ?? [])
    .filter(m => term === "" || m.displayName.toLowerCase().includes(term.toLowerCase()))
    .slice(0, 5);
  const filteredDir = (results ?? [])
    .filter(d => !filteredSquad.some(s => s.userId === d.userId))
    .slice(0, 5);

  const isSearching = focused && term.length >= 2;
  const hasResults = filteredSquad.length > 0 || filteredDir.length > 0;
  const noResults = isSearching && results !== undefined && !hasResults;
  const showDropdown = focused && (hasResults || (term === "" && filteredSquad.length > 0) || noResults);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value, undefined)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
      />
      {showDropdown && (
        <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filteredSquad.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 bg-gray-50 uppercase tracking-wide">Squad</div>
              {filteredSquad.map(m => (
                <button key={m._id} type="button"
                  onMouseDown={e => { e.preventDefault(); onChange(m.displayName, m.userId); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 text-left transition-colors">
                  <span className="font-medium text-gray-900">{m.displayName}</span>
                  {m.handicap != null && <span className="text-gray-400">HCP {m.handicap}</span>}
                </button>
              ))}
            </>
          )}
          {filteredDir.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 bg-gray-50 uppercase tracking-wide">Platform directory</div>
              {filteredDir.map(d => (
                <button key={d._id} type="button"
                  onMouseDown={e => { e.preventDefault(); onChange(d.displayName, d.userId); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 text-left transition-colors">
                  <span className="font-medium text-gray-900">{d.displayName}</span>
                  <div className="flex items-center gap-1.5">
                    {(d as any).handicapIndex != null && <span className="text-gray-400">HCP {(d as any).handicapIndex}</span>}
                    <span className="text-green-600 text-[10px] font-medium">Member</span>
                  </div>
                </button>
              ))}
            </>
          )}
          {noResults && (
            <div className="px-3 py-2.5 text-xs text-gray-400 italic">
              No platform members found — name will be saved as entered
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MatchRow ───────────────────────────────────────────────────────────────────

function MatchRow({
  fixtureId,
  matchNumber,
  homeTeamName,
  homeClubName,
  awayTeamName,
  awayClubName,
  leagueMatchType,
  existing,
  canEdit,
  availableSquadMembers,
}: {
  fixtureId: Id<"interclubFixtures">;
  matchNumber: number;
  homeTeamName: string;
  homeClubName: string;
  awayTeamName: string;
  awayClubName: string;
  leagueMatchType: string; // league default
  existing?: {
    _id: Id<"interclubMatches">;
    matchType?: string;
    homePlayer: string;
    homePlayer2?: string;
    homeUserId?: string;
    homeUserId2?: string;
    awayPlayer: string;
    awayPlayer2?: string;
    awayUserId?: string;
    awayUserId2?: string;
    result?: string;
    winner?: string;
    homePoints?: number;
    awayPoints?: number;
  };
  canEdit: boolean;
  availableSquadMembers?: AvailableSquadMember[];
}) {
  const saveMatch = useMutation(api.interclub.saveMatch);
  const deleteMatch = useMutation(api.interclub.deleteMatch);
  const [editing, setEditing] = useState(!existing);

  // Per-match type: use existing value, fall back to league default (clamped to singles/betterball)
  const resolvedDefault = existing?.matchType ?? (leagueMatchType === "mixed" ? "singles" : leagueMatchType);
  const [matchType, setMatchType] = useState<string>(resolvedDefault);
  const isBetterball = matchType === "betterball";

  const [homePlayer, setHomePlayer] = useState(existing?.homePlayer ?? "");
  const [homePlayer2, setHomePlayer2] = useState(existing?.homePlayer2 ?? "");
  const [homeUserId, setHomeUserId] = useState(existing?.homeUserId);
  const [homeUserId2, setHomeUserId2] = useState(existing?.homeUserId2);
  const [awayPlayer, setAwayPlayer] = useState(existing?.awayPlayer ?? "");
  const [awayPlayer2, setAwayPlayer2] = useState(existing?.awayPlayer2 ?? "");
  const [awayUserId, setAwayUserId] = useState(existing?.awayUserId);
  const [awayUserId2, setAwayUserId2] = useState(existing?.awayUserId2);
  const [result, setResult] = useState(existing?.result ?? "");
  const [winner, setWinner] = useState(existing?.winner ?? "");
  const [saving, setSaving] = useState(false);

  const homeLabel = isBetterball
    ? [homePlayer, homePlayer2].filter(Boolean).join(" & ") || homeClubName
    : homePlayer || homeClubName;
  const awayLabel = isBetterball
    ? [awayPlayer, awayPlayer2].filter(Boolean).join(" & ") || awayClubName
    : awayPlayer || awayClubName;

  async function handleSave() {
    if (!homePlayer.trim() || !awayPlayer.trim()) return;
    setSaving(true);
    try {
      await saveMatch({
        fixtureId,
        matchId: existing?._id,
        matchNumber,
        matchType,
        homePlayer: homePlayer.trim(),
        homePlayer2: isBetterball ? (homePlayer2.trim() || undefined) : undefined,
        homeUserId: homeUserId || undefined,
        homeUserId2: isBetterball ? (homeUserId2 || undefined) : undefined,
        awayPlayer: awayPlayer.trim(),
        awayPlayer2: isBetterball ? (awayPlayer2.trim() || undefined) : undefined,
        awayUserId: awayUserId || undefined,
        awayUserId2: isBetterball ? (awayUserId2 || undefined) : undefined,
        result: result || undefined,
        winner: winner || undefined,
      });
      setEditing(false);
    } finally { setSaving(false); }
  }

  if (!canEdit && !existing) return null;

  if (existing && !editing) {
    const isBB = existing.matchType === "betterball";
    return (
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0">
        <span className="text-xs text-gray-400 w-6 text-center font-medium">{matchNumber}</span>
        <div className="flex-1 grid grid-cols-3 gap-2 items-center">
          <div className={`${existing.winner === "home" ? "text-green-700" : "text-gray-900"}`}>
            <p className="text-sm font-medium truncate">{existing.winner === "home" && "🏆 "}{existing.homePlayer}</p>
            {isBB && existing.homePlayer2 && <p className="text-xs text-gray-400 truncate">{existing.homePlayer2}</p>}
          </div>
          <div className="text-center">
            {existing.result ? (
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">{existing.result}</span>
            ) : (
              <span className="text-xs text-gray-300">vs</span>
            )}
            {existing.winner === "halved" && <span className="ml-1 text-xs text-gray-400">halved</span>}
          </div>
          <div className={`text-right ${existing.winner === "away" ? "text-green-700" : "text-gray-900"}`}>
            <p className="text-sm font-medium truncate">{existing.winner === "away" && "🏆 "}{existing.awayPlayer}</p>
            {isBB && existing.awayPlayer2 && <p className="text-xs text-gray-400 truncate">{existing.awayPlayer2}</p>}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-gray-600 transition-colors">
              <span className="text-xs">Edit</span>
            </button>
            <button onClick={() => { if (confirm("Remove this match?")) deleteMatch({ matchId: existing._id }); }}
              className="text-gray-200 hover:text-red-400 transition-colors">
              <X size={13} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-5 py-4 border-b border-gray-50 last:border-0 space-y-3">
      {/* Match type toggle — only shown for mixed leagues */}
      {leagueMatchType === "mixed" && (
        <div className="flex items-center gap-2 pl-8">
          <span className="text-xs text-gray-400">Type:</span>
          {(["singles", "betterball"] as const).map(t => (
            <button key={t} onClick={() => setMatchType(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${matchType === t ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {t === "betterball" ? "4-ball BB" : "Singles"}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-400 w-6 text-center font-medium mt-2">{matchNumber}</span>
        <div className="flex-1 grid grid-cols-2 gap-3">
          {/* Home side */}
          <div className="space-y-1.5">
            <label className="block text-xs text-gray-400">{homeClubName} {isBetterball ? "pair" : "player"}</label>
            <PlayerSearchInput
              value={homePlayer}
              onChange={(name, uid) => { setHomePlayer(name); setHomeUserId(uid); }}
              placeholder={isBetterball ? "Player 1" : "Name"}
              autoFocus
              squadSuggestions={availableSquadMembers}
            />
            {isBetterball && (
              <PlayerSearchInput
                value={homePlayer2}
                onChange={(name, uid) => { setHomePlayer2(name); setHomeUserId2(uid); }}
                placeholder="Player 2"
                squadSuggestions={availableSquadMembers}
              />
            )}
          </div>
          {/* Away side */}
          <div className="space-y-1.5">
            <label className="block text-xs text-gray-400">{awayClubName} {isBetterball ? "pair" : "player"}</label>
            <PlayerSearchInput
              value={awayPlayer}
              onChange={(name, uid) => { setAwayPlayer(name); setAwayUserId(uid); }}
              placeholder={isBetterball ? "Player 1" : "Name"}
            />
            {isBetterball && (
              <PlayerSearchInput
                value={awayPlayer2}
                onChange={(name, uid) => { setAwayPlayer2(name); setAwayUserId2(uid); }}
                placeholder="Player 2"
              />
            )}
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="flex items-center gap-2 pl-8">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Result</label>
          <div className="flex gap-1 flex-wrap">
            {RESULT_PRESETS.map(p => (
              <button key={p} onClick={() => setResult(p === result ? "" : p)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${result === p ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {p}
              </button>
            ))}
            <input type="text" value={result} onChange={e => setResult(e.target.value)}
              placeholder="custom"
              className="w-20 border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500" />
          </div>
        </div>
      </div>

      {/* Winner */}
      <div className="flex items-center gap-2 pl-8">
        <label className="text-xs text-gray-400">Winner:</label>
        <div className="flex gap-2">
          {[
            { value: "home", label: homeLabel },
            { value: "halved", label: "Halved" },
            { value: "away", label: awayLabel },
          ].map(opt => (
            <button key={opt.value} onClick={() => setWinner(winner === opt.value ? "" : opt.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors truncate max-w-[140px] ${winner === opt.value ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pl-8">
        {existing && <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>}
        <button onClick={handleSave} disabled={saving || !homePlayer.trim() || !awayPlayer.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
          <Check size={12} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FixturePage({ params }: { params: Promise<{ leagueId: string; fixtureId: string }> }) {
  const { leagueId, fixtureId } = use(params);
  const { activeMembership } = useActiveClub();
  const isAdmin = activeMembership?.role === "admin";

  const fixture = useQuery(api.interclub.getFixture, { fixtureId: fixtureId as Id<"interclubFixtures"> });
  const updateFixture = useMutation(api.interclub.updateFixture);
  const deleteFixture = useMutation(api.interclub.deleteFixture);
  const markAvailability = useMutation(api.fixtureAvailability.markAvailability);
  const router = useRouter();

  const [addingMatch, setAddingMatch] = useState(false);

  // Determine which team side belongs to our club
  const myClubId = activeMembership?.clubId;
  const homeTeamClubId = fixture?.homeTeam?.clubId;
  const awayTeamClubId = fixture?.awayTeam?.clubId;
  const ownTeamId: Id<"interclubTeams"> | undefined =
    myClubId && homeTeamClubId && myClubId === homeTeamClubId
      ? (fixture?.homeTeamId as Id<"interclubTeams">)
      : myClubId && awayTeamClubId && myClubId === awayTeamClubId
      ? (fixture?.awayTeamId as Id<"interclubTeams">)
      : undefined;

  // Load squad for our team (skip if we don't know our team yet)
  const squadMembers = useQuery(
    api.squadMembers.listByTeam,
    ownTeamId ? { teamId: ownTeamId } : "skip"
  );

  // Load availability for this fixture
  const availability = useQuery(
    api.fixtureAvailability.listByFixture,
    fixture ? { fixtureId: fixtureId as Id<"interclubFixtures"> } : "skip"
  );

  if (!fixture) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  }

  const matches = fixture.matches ?? [];
  const nextMatchNumber = matches.length + 1;
  const homeTotal = matches.reduce((s, m) => s + (m.homePoints ?? 0), 0);
  const awayTotal = matches.reduce((s, m) => s + (m.awayPoints ?? 0), 0);

  const canEdit = isAdmin || true; // TODO: check captain
  const leagueMatchType = fixture.league?.matchType ?? "singles";

  // Available squad members to pass to MatchRow for home-side suggestions
  const availableSquadMembers: AvailableSquadMember[] = (squadMembers ?? [])
    .filter(s => {
      if (!s.member) return false;
      if (s.status !== "active") return false;
      const avail = (availability ?? []).find(a => a.memberId === s.memberId);
      // include if marked available, or no response yet (don't exclude tentative/unavailable)
      return !avail || avail.status === "available" || avail.status === "tentative";
    })
    .map(s => ({
      _id: s.member!._id,
      displayName: s.member!.displayName,
      handicap: (s.member as any)?.handicap,
      userId: (s.member as any)?.userId,
    }));

  // Handler to mark availability
  async function handleMarkAvailability(memberId: Id<"clubMembers">, status: "available" | "unavailable" | "tentative") {
    if (!ownTeamId) return;
    await markAvailability({
      fixtureId: fixtureId as Id<"interclubFixtures">,
      teamId: ownTeamId,
      memberId,
      status,
    });
  }

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/manage/interclub/${leagueId}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">
            {fixture.homeTeam?.clubName} {fixture.homeTeam?.teamName}
            <span className="text-gray-400 mx-2 font-normal">vs</span>
            {fixture.awayTeam?.clubName} {fixture.awayTeam?.teamName}
          </h1>
          {fixture.date && (
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date(fixture.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {fixture.venue ? ` · ${fixture.venue}` : ""}
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={async () => {
              if (!confirm("Delete this fixture and all its match results?")) return;
              await deleteFixture({ fixtureId: fixtureId as Id<"interclubFixtures"> });
              router.push(`/manage/interclub/${leagueId}`);
            }}
            className="text-gray-300 hover:text-red-500 transition-colors"
            title="Delete fixture"
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>

      {/* Score banner */}
      {matches.some(m => m.winner) && (
        <div className={`rounded-2xl px-8 py-5 text-center ${fixture.status === "complete" ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
          <p className="text-sm text-gray-500 mb-1">
            {fixture.homeTeam?.clubName} {fixture.homeTeam?.teamName} vs {fixture.awayTeam?.clubName} {fixture.awayTeam?.teamName}
          </p>
          <p className="text-4xl font-bold text-gray-900">
            {homeTotal} <span className="text-gray-300 text-2xl">–</span> {awayTotal}
          </p>
          {fixture.status === "complete" && (
            <p className="text-sm font-medium mt-1 text-green-700">
              {homeTotal > awayTotal
                ? `${fixture.homeTeam?.clubName} win!`
                : awayTotal > homeTotal
                ? `${fixture.awayTeam?.clubName} win!`
                : "Match halved"}
            </p>
          )}
        </div>
      )}

      {/* Status controls */}
      {isAdmin && (
        <div className="flex gap-2">
          {(["scheduled", "in_progress", "complete", "postponed"] as const).map(s => (
            <button key={s} onClick={() => updateFixture({ fixtureId: fixtureId as Id<"interclubFixtures">, status: s })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${fixture.status === s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      {/* Availability panel — only shown when we can identify our team */}
      {ownTeamId && (
        <AvailabilityPanel
          fixtureId={fixtureId as Id<"interclubFixtures">}
          teamId={ownTeamId}
          squadMembers={(squadMembers ?? []) as SquadMemberWithMember[]}
          availability={(availability ?? []).map(a => ({ memberId: a.memberId, status: a.status, note: a.note ?? undefined }))}
          onMark={handleMarkAvailability}
          isAdmin={isAdmin}
        />
      )}

      {/* Matches */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            {leagueMatchType === "betterball" ? "4-ball better ball matches" : leagueMatchType === "mixed" ? "Matches" : "Singles matches"}
          </h2>
          {canEdit && (
            <button onClick={() => setAddingMatch(true)}
              className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium">
              <Plus size={13} /> Add match
            </button>
          )}
        </div>

        {matches.length === 0 && !addingMatch && (
          <div className="px-5 py-8 text-center">
            <p className="text-gray-400 text-sm">No match results entered yet</p>
            {canEdit && (
              <button onClick={() => setAddingMatch(true)} className="mt-2 text-sm text-green-600 hover:underline">
                Enter first match
              </button>
            )}
          </div>
        )}

        {matches.sort((a, b) => a.matchNumber - b.matchNumber).map(m => (
          <MatchRow
            key={m._id}
            fixtureId={fixtureId as Id<"interclubFixtures">}
            matchNumber={m.matchNumber}
            homeTeamName={fixture.homeTeam?.teamName ?? "Home"}
            homeClubName={fixture.homeTeam?.clubName ?? "Home"}
            awayTeamName={fixture.awayTeam?.teamName ?? "Away"}
            awayClubName={fixture.awayTeam?.clubName ?? "Away"}
            leagueMatchType={leagueMatchType}
            existing={m}
            canEdit={canEdit}
            availableSquadMembers={ownTeamId && fixture.homeTeamId === ownTeamId ? availableSquadMembers : undefined}
          />
        ))}

        {addingMatch && (
          <MatchRow
            fixtureId={fixtureId as Id<"interclubFixtures">}
            matchNumber={nextMatchNumber}
            homeTeamName={fixture.homeTeam?.teamName ?? "Home"}
            homeClubName={fixture.homeTeam?.clubName ?? "Home"}
            awayTeamName={fixture.awayTeam?.teamName ?? "Away"}
            awayClubName={fixture.awayTeam?.clubName ?? "Away"}
            leagueMatchType={leagueMatchType}
            canEdit={canEdit}
            availableSquadMembers={ownTeamId && fixture.homeTeamId === ownTeamId ? availableSquadMembers : undefined}
          />
        )}
      </div>

      {/* Notes */}
      {isAdmin && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Fixture notes</label>
          <input type="text"
            defaultValue={fixture.notes ?? ""}
            onBlur={e => updateFixture({ fixtureId: fixtureId as Id<"interclubFixtures">, notes: e.target.value || undefined })}
            placeholder="e.g. Match postponed due to weather"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      )}
    </div>
  );
}
