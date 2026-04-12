"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import type { Id } from "convex/_generated/dataModel";
import { Terminal, Plus, Trash2, Pencil, Wifi } from "lucide-react";
import Link from "next/link";

type TerminalRow = {
  _id: Id<"posTerminals">;
  name: string;
  provider: string;
  terminalId: string;
  isActive: boolean;
};

const PROVIDERS = [
  { value: "dojo", label: "Dojo" },
  { value: "square", label: "Square" },
];

export default function TerminalsPage() {
  const { club } = useActiveClub();
  const terminals = useQuery(
    api.posTerminals.listByClub,
    club ? { clubId: club._id } : "skip"
  );
  const save = useMutation(api.posTerminals.save);
  const remove = useMutation(api.posTerminals.remove);

  const [editing, setEditing] = useState<TerminalRow | null>(null);
  const [form, setForm] = useState({
    provider: "dojo",
    terminalId: "",
    name: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setForm({ provider: "dojo", terminalId: "", name: "", isActive: true });
  }

  function openEdit(t: TerminalRow) {
    setEditing(t);
    setForm({ provider: t.provider, terminalId: t.terminalId, name: t.name, isActive: t.isActive });
  }

  async function handleSave() {
    if (!club || !form.terminalId.trim() || !form.name.trim()) return;
    setSaving(true);
    try {
      await save({
        clubId: club._id,
        terminalDbId: editing?._id,
        provider: form.provider,
        terminalId: form.terminalId.trim(),
        name: form.name.trim(),
        isActive: form.isActive,
      });
      setEditing(null);
      setForm({ provider: "dojo", terminalId: "", name: "", isActive: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: Id<"posTerminals">) {
    if (!confirm("Remove this terminal?")) return;
    await remove({ terminalDbId: id });
  }

  if (!club || !terminals) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/manage/pos" className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">
            ← Point of Sale
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Terminal size={20} /> Payment Terminals
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Register your physical card terminals so staff can send payments to them.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          <Plus size={15} /> Add terminal
        </button>
      </div>

      {/* Form */}
      {(editing !== undefined) && (form.name !== "" || form.terminalId !== "" || editing !== null) ? null : null}
      {(editing !== null || form.terminalId !== "" || form.name !== "") && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">
            {editing ? "Edit terminal" : "Add terminal"}
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
              <select
                value={form.provider}
                onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Terminal ID</label>
              <input
                value={form.terminalId}
                onChange={e => setForm(f => ({ ...f, terminalId: e.target.value }))}
                placeholder="trm_xxxxxxxxxxxx"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Display name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Bar, Pro Shop, Reception"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active (visible to staff)</label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.terminalId.trim() || !form.name.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(null); setForm({ provider: "dojo", terminalId: "", name: "", isActive: true }); }}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Terminal list */}
      {terminals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Terminal size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No terminals registered yet.</p>
          <button onClick={openNew} className="mt-2 text-sm text-green-600 hover:underline">
            Add your first terminal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {terminals.map(t => (
            <div
              key={t._id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${t.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                  <Wifi size={18} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{t.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{t.terminalId}</p>
                  <p className="text-xs text-gray-400 capitalize">{t.provider} · {t.isActive ? "Active" : "Inactive"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(t as TerminalRow)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(t._id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
        <strong>How to find your terminal ID:</strong> Log into your Dojo account at{" "}
        <span className="font-mono">business.dojo.tech</span> → Devices → copy the terminal ID shown next to each device.
      </div>
    </div>
  );
}
