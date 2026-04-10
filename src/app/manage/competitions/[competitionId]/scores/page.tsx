"use client";

import { useState, use } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Plus, Pencil, X, Trophy, Medal } from "lucide-react";
import Link from "next/link";

const FORMAT_LABELS: Record<string, string> = {
  stableford: "Stableford",
  strokeplay: "Stroke play",
  betterball: "Betterball",
  matchplay: "Match play",
  custom: "Custom",
};

type Member = { _id: Id<"clubMembers">; displayName: string; userId: string; handicap?: number };
type Score = {
  _id: Id<"competitionScores">;
  displayName: string;
  handicap: number;
  grossScore?: number;
  netScore?: number;
  stablefordPoints?: number;
  countback?: string;
  notes?: string;
  position?: number;
};

function ScoreModal({
  clubId,
  competitionId,
  format,
  members,
  score,
  onClose,
}: {
  clubId: Id<"clubs">;
  competitionId: Id<"competitions">;
  format: string;
  members: Member[];
  score?: Score;
  onClose: () => void;
}) {
  const submitScore = useMutation(api.scoring.submitScore);
  const updateScore = useMutation(api.scoring.updateScore);

  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [manualName, setManualName] = useState(score?.displayName ?? "");
  const [useManual, setUseManual] = useState(!score?._id || true);
  const [handicap, setHandicap] = useState(score?.handicap?.toString() ?? "");
  const [grossScore, setGrossScore] = useState(score?.grossScore?.toString() ?? "");
  const [stablefordPoints, setStablefordPoints] = useState(score?.stablefordPoints?.toString() ?? "");
  const [countback, setCountback] = useState(score?.countback ?? "");
  const [notes, setNotes] = useState(score?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const isStableford = format === "stableford";

  const filteredMembers = members.filter(m =>
    m.displayName.toLowerCase().includes(memberSearch.toLowerCase())
  );

  function handleSelectMember(member: Member) {
    setManualName(member.displayName);
    setSelectedMemberId(member.userId);
    if (member.handicap != null) setHandicap(member.handicap.toString());
    setMemberSearch("");
  }

  async function handleSave() {
    const hcp = parseFloat(handicap);
    if (!manualName.trim() || isNaN(hcp)) return;
    setSaving(true);
    try {
      if (score) {
        await updateScore({
          scoreId: score._id,
          handicap: hcp,
          grossScore: grossScore ? parseInt(grossScore) : undefined,
          stablefordPoints: stablefordPoints ? parseInt(stablefordPoints) : undefined,
          countback: countback || undefined,
          notes: notes || undefined,
        });
      } else {
        await submitScore({
          competitionId,
          clubId,
          userId: selectedMemberId || undefined,
          displayName: manualName.trim(),
          handicap: hcp,
          grossScore: grossScore ? parseInt(grossScore) : undefined,
          stablefordPoints: stablefordPoints ? parseInt(stablefordPoints) : undefined,
          countback: countback || undefined,
          notes: notes || undefined,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{score ? "Edit score" : "Add score"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Member picker or manual entry */}
          {!score && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Member (or type name below)</label>
              <input
                type="text"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {memberSearch && filteredMembers.length > 0 && (
                <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filteredMembers.slice(0, 8).map(m => (
                    <button
                      key={m._id}
                      onClick={() => handleSelectMember(m)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>{m.displayName}</span>
                      {m.handicap != null && <span className="text-xs text-gray-400">Hcp {m.handicap}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {score ? "Name" : "Name *"}
            </label>
            <input
              type="text"
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              placeholder="Full name"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Handicap *</label>
              <input
                type="number"
                value={handicap}
                onChange={e => setHandicap(e.target.value)}
                placeholder="e.g. 14.2"
                step="0.1" min="-5" max="54"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Gross score</label>
              <input
                type="number"
                value={grossScore}
                onChange={e => setGrossScore(e.target.value)}
                placeholder="e.g. 82"
                min="40" max="150"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {isStableford && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Stableford points</label>
                <input
                  type="number"
                  value={stablefordPoints}
                  onChange={e => setStablefordPoints(e.target.value)}
                  placeholder="e.g. 36"
                  min="0" max="72"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Countback</label>
              <input
                type="text"
                value={countback}
                onChange={e => setCountback(e.target.value)}
                placeholder="e.g. 20 back 9"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Net score preview */}
          {grossScore && handicap && (
            <p className="text-xs text-gray-400">
              Net score: <strong className="text-gray-700">{parseInt(grossScore) - Math.round(parseFloat(handicap))}</strong>
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !manualName.trim() || !handicap}
            className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? "Saving…" : score ? "Update" : "Add score"}
          </button>
        </div>
      </div>
    </div>
  );
}

const POSITION_STYLES = [
  "text-amber-500",   // 1st
  "text-gray-400",    // 2nd
  "text-amber-700",   // 3rd
];

function positionLabel(pos: number) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return pos;
}

export default function CompetitionScoresPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = use(params);
  const { user } = useUser();

  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const isAdmin = activeMembership?.role === "admin";
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");

  const competition = useQuery(api.competitions.get, {
    competitionId: competitionId as Id<"competitions">,
  });
  const leaderboard = useQuery(api.scoring.leaderboard, {
    competitionId: competitionId as Id<"competitions">,
  });
  const members = useQuery(
    api.clubMembers.listByClub,
    club ? { clubId: club._id } : "skip"
  ) as Member[] | undefined;
  const deleteScore = useMutation(api.scoring.deleteScore);

  const [showModal, setShowModal] = useState(false);
  const [editScore, setEditScore] = useState<Score | undefined>();

  if (!competition || !leaderboard || !club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const format = competition.scoringFormat ?? "stableford";
  const isStableford = format === "stableford";

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/manage/competitions/${competitionId}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{competition.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {FORMAT_LABELS[format] ?? format} · {leaderboard.length} score{leaderboard.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditScore(undefined); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus size={15} /> Add score
          </button>
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Trophy size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No scores entered yet</p>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-sm text-green-600 hover:underline"
            >
              Add the first score
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium w-10">Pos</th>
                <th className="px-5 py-3 font-medium">Player</th>
                <th className="px-5 py-3 font-medium text-right">Hcp</th>
                {isStableford ? (
                  <th className="px-5 py-3 font-medium text-right">Points</th>
                ) : (
                  <>
                    <th className="px-5 py-3 font-medium text-right hidden sm:table-cell">Gross</th>
                    <th className="px-5 py-3 font-medium text-right">Net</th>
                  </>
                )}
                {isAdmin && <th className="px-5 py-3 w-16" />}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((score, idx) => {
                const pos = score.position ?? idx + 1;
                const isTied = idx > 0 && leaderboard[idx - 1].position === pos;
                return (
                  <tr key={score._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 text-center font-bold">
                      {pos <= 3 ? (
                        <span className="text-lg">{positionLabel(pos)}</span>
                      ) : (
                        <span className="text-gray-500 text-sm">{isTied ? "=" : ""}{pos}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{score.displayName}</p>
                      {score.countback && <p className="text-xs text-gray-400">{score.countback}</p>}
                      {score.notes && <p className="text-xs text-gray-400 italic">{score.notes}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-right text-gray-500">{score.handicap}</td>
                    {isStableford ? (
                      <td className="px-5 py-3.5 text-right font-bold text-gray-900">
                        {score.stablefordPoints ?? "—"}
                      </td>
                    ) : (
                      <>
                        <td className="px-5 py-3.5 text-right text-gray-500 hidden sm:table-cell">
                          {score.grossScore ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-gray-900">
                          {score.netScore ?? "—"}
                        </td>
                      </>
                    )}
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditScore(score as Score); setShowModal(true); }}
                            className="text-gray-300 hover:text-gray-600 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Remove ${score.displayName}?`)) deleteScore({ scoreId: score._id }); }}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ScoreModal
          clubId={club._id}
          competitionId={competitionId as Id<"competitions">}
          format={format}
          members={(members ?? []) as Member[]}
          score={editScore}
          onClose={() => { setShowModal(false); setEditScore(undefined); }}
        />
      )}
    </div>
  );
}
