"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import { Check, X, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewKnockoutPage() {
  const { user } = useUser();
  const router = useRouter();
  const { activeMembership, club } = useActiveClub();
  const members = useQuery(api.clubMembers.listByClub, club ? { clubId: club._id } : "skip");
  const createKnockout = useMutation(api.knockouts.create);

  const [name, setName] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [seeds, setSeeds] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = (members ?? []).filter(m =>
    m.displayName.toLowerCase().includes(search.toLowerCase())
  );

  function toggleMember(userId: string) {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(userId)) { next.delete(userId); } else { next.add(userId); }
      return next;
    });
  }

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(selected.size, 2))));
  const byes = bracketSize - selected.size;

  async function handleCreate() {
    if (!user || !club || !name.trim() || selected.size < 2) return;
    setCreating(true);
    setError(null);
    try {
      const entrants = (members ?? [])
        .filter(m => selected.has(m.userId))
        .map(m => ({
          userId: m.userId,
          displayName: m.displayName,
          seed: seeded ? seeds[m.userId] : undefined,
        }));

      const id = await createKnockout({
        clubId: club._id,
        name: name.trim(),
        seeded,
        entrants,
        createdBy: user.id,
      });
      router.push(`/manage/knockouts/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
      setCreating(false);
    }
  }

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/manage/knockouts" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New knockout</h1>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tournament name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Club Championship 2026, Captain's Cup"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Seeded toggle */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4">
        <div>
          <p className="font-medium text-gray-900 text-sm">Seeded draw</p>
          <p className="text-xs text-gray-500 mt-0.5">Assign seeds to control who plays who in early rounds</p>
        </div>
        <button
          onClick={() => setSeeded(s => !s)}
          className={`relative w-10 rounded-full transition-colors cursor-pointer ${seeded ? "bg-green-600" : "bg-gray-300"}`}
          style={{ height: "22px", width: "40px" }}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${seeded ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {/* Member selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Select entrants <span className="text-gray-400 font-normal">({selected.size} selected)</span>
          </label>
          {selected.size >= 2 && (
            <span className="text-xs text-gray-500">
              {bracketSize}-player bracket{byes > 0 ? ` · ${byes} bye${byes !== 1 ? "s" : ""}` : ""}
            </span>
          )}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search members…"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
        />
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {filtered.map(m => {
            const isSelected = selected.has(m.userId);
            return (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <button
                  onClick={() => toggleMember(m.userId)}
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-green-600 border-green-600" : "border-gray-300"}`}
                >
                  {isSelected && <Check size={12} className="text-white" />}
                </button>
                <span className="flex-1 text-sm font-medium text-gray-900">{m.displayName}</span>
                {seeded && isSelected && (
                  <input
                    type="number"
                    min={1}
                    max={selected.size}
                    placeholder="Seed"
                    value={seeds[m.userId] ?? ""}
                    onChange={e => setSeeds(s => ({ ...s, [m.userId]: parseInt(e.target.value) }))}
                    onClick={e => e.stopPropagation()}
                    className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <X size={14} /> {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link href="/manage/knockouts" className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </Link>
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim() || selected.size < 2}
          className="px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {creating ? "Creating…" : `Create draw (${selected.size} players)`}
        </button>
      </div>
    </div>
  );
}
