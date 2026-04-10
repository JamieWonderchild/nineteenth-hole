"use client";

import { useState, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Plus, X, Check } from "lucide-react";
import Link from "next/link";

const RESULT_PRESETS = ["1 up", "2&1", "3&2", "4&3", "5&4", "6&5", "7&6", "AS", "halved"];

function MatchRow({
  fixtureId,
  matchNumber,
  homeTeamName,
  awayTeamName,
  existing,
  canEdit,
}: {
  fixtureId: Id<"interclubFixtures">;
  matchNumber: number;
  homeTeamName: string;
  awayTeamName: string;
  existing?: {
    _id: Id<"interclubMatches">;
    homePlayer: string;
    awayPlayer: string;
    result?: string;
    winner?: string;
    homePoints?: number;
    awayPoints?: number;
  };
  canEdit: boolean;
}) {
  const saveMatch = useMutation(api.interclub.saveMatch);
  const deleteMatch = useMutation(api.interclub.deleteMatch);
  const [editing, setEditing] = useState(!existing);
  const [homePlayer, setHomePlayer] = useState(existing?.homePlayer ?? "");
  const [awayPlayer, setAwayPlayer] = useState(existing?.awayPlayer ?? "");
  const [result, setResult] = useState(existing?.result ?? "");
  const [winner, setWinner] = useState(existing?.winner ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!homePlayer.trim() || !awayPlayer.trim()) return;
    setSaving(true);
    try {
      await saveMatch({
        fixtureId,
        matchId: existing?._id,
        matchNumber,
        homePlayer: homePlayer.trim(),
        awayPlayer: awayPlayer.trim(),
        result: result || undefined,
        winner: winner || undefined,
      });
      setEditing(false);
    } finally { setSaving(false); }
  }

  if (!canEdit && !existing) return null;

  if (existing && !editing) {
    return (
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0">
        <span className="text-xs text-gray-400 w-6 text-center font-medium">{matchNumber}</span>
        <div className="flex-1 grid grid-cols-3 gap-2 items-center">
          <p className={`text-sm font-medium truncate ${existing.winner === "home" ? "text-green-700" : "text-gray-900"}`}>
            {existing.winner === "home" && "🏆 "}{existing.homePlayer}
          </p>
          <div className="text-center">
            {existing.result ? (
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">{existing.result}</span>
            ) : (
              <span className="text-xs text-gray-300">vs</span>
            )}
            {existing.winner === "halved" && <span className="ml-1 text-xs text-gray-400">halved</span>}
          </div>
          <p className={`text-sm font-medium truncate text-right ${existing.winner === "away" ? "text-green-700" : "text-gray-900"}`}>
            {existing.winner === "away" && "🏆 "}{existing.awayPlayer}
          </p>
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
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-6 text-center font-medium">{matchNumber}</span>
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{homeTeamName} player</label>
            <input type="text" value={homePlayer} onChange={e => setHomePlayer(e.target.value)}
              placeholder="Name" autoFocus
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{awayTeamName} player</label>
            <input type="text" value={awayPlayer} onChange={e => setAwayPlayer(e.target.value)}
              placeholder="Name"
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
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
            { value: "home", label: homePlayer || homeTeamName },
            { value: "halved", label: "Halved" },
            { value: "away", label: awayPlayer || awayTeamName },
          ].map(opt => (
            <button key={opt.value} onClick={() => setWinner(winner === opt.value ? "" : opt.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors truncate max-w-[120px] ${winner === opt.value ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
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

export default function FixturePage({ params }: { params: Promise<{ leagueId: string; fixtureId: string }> }) {
  const { leagueId, fixtureId } = use(params);
  const { user } = useUser();

  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const isAdmin = activeMembership?.role === "admin";

  const fixture = useQuery(api.interclub.getFixture, { fixtureId: fixtureId as Id<"interclubFixtures"> });
  const updateFixture = useMutation(api.interclub.updateFixture);

  const [addingMatch, setAddingMatch] = useState(false);

  if (!fixture) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  }

  const matches = fixture.matches ?? [];
  const nextMatchNumber = matches.length + 1;
  const homeTotal = matches.reduce((s, m) => s + (m.homePoints ?? 0), 0);
  const awayTotal = matches.reduce((s, m) => s + (m.awayPoints ?? 0), 0);

  const canEdit = isAdmin || true; // TODO: check captain

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
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

      {/* Matches */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Individual matches</h2>
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
            awayTeamName={fixture.awayTeam?.teamName ?? "Away"}
            existing={m}
            canEdit={canEdit}
          />
        ))}

        {addingMatch && (
          <MatchRow
            fixtureId={fixtureId as Id<"interclubFixtures">}
            matchNumber={nextMatchNumber}
            homeTeamName={fixture.homeTeam?.teamName ?? "Home"}
            awayTeamName={fixture.awayTeam?.teamName ?? "Away"}
            canEdit={canEdit}
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
