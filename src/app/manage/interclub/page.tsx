"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Plus, X, Trophy, Users } from "lucide-react";
import Link from "next/link";

function NewLeagueModal({ onClose }: { onClose: () => void }) {
  const createLeague = useMutation(api.interclub.createLeague);
  const [form, setForm] = useState({
    name: "",
    county: "",
    season: "2025-26",
    format: "matchplay",
    matchType: "singles",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createLeague({
        name: form.name.trim(),
        county: form.county.trim() || undefined,
        season: form.season.trim(),
        format: form.format,
        matchType: form.matchType,
        description: form.description.trim() || undefined,
      });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New league</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">League name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Middlesex County League"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">County</label>
              <input type="text" value={form.county} onChange={e => setForm(f => ({ ...f, county: e.target.value }))}
                placeholder="Middlesex"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Season</label>
              <input type="text" value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
                placeholder="2025-26"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Format</label>
            <select value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="matchplay">Match play</option>
              <option value="stableford">Stableford</option>
              <option value="strokeplay">Stroke play</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Match type</label>
            <select value={form.matchType} onChange={e => setForm(f => ({ ...f, matchType: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="singles">Singles</option>
              <option value="betterball">4-ball better ball (pairs)</option>
              <option value="mixed">Mixed — varies per fixture</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
            {saving ? "Creating…" : "Create league"}
          </button>
        </div>
      </div>
    </div>
  );
}

const FORMAT_LABELS: Record<string, string> = {
  matchplay: "Match play",
  stableford: "Stableford",
  strokeplay: "Stroke play",
};

export default function InterclubPage() {
  const { user } = useUser();
  void user;
  const leagues = useQuery(api.interclub.listLeagues);
  const [showNew, setShowNew] = useState(false);

  if (leagues === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interclub</h1>
          <p className="text-gray-500 text-sm mt-0.5">County leagues and interclub competitions</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={15} /> New league
        </button>
      </div>

      {leagues.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Trophy size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No leagues set up yet</p>
          <button onClick={() => setShowNew(true)} className="mt-2 text-sm text-green-600 hover:underline">
            Create your first league
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map(league => (
            <Link
              key={league._id}
              href={`/manage/interclub/${league._id}`}
              className="block bg-white border border-gray-200 rounded-xl px-6 py-4 hover:border-green-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-semibold text-gray-900">{league.name}</h2>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {league.season}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[league.county, FORMAT_LABELS[league.format] ?? league.format].filter(Boolean).join(" · ")}
                  </p>
                  {league.description && <p className="text-xs text-gray-400 mt-1">{league.description}</p>}
                </div>
                <Users size={20} className="text-gray-300 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNew && <NewLeagueModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
