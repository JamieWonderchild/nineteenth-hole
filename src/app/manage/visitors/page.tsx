"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import { formatCurrency } from "@/lib/format";
import { Plus, X, Check, UserCheck } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

function LogVisitorModal({
  clubId,
  currency,
  userId,
  onClose,
}: {
  clubId: import("convex/_generated/dataModel").Id<"clubs">;
  currency: string;
  userId: string;
  onClose: () => void;
}) {
  const logVisitor = useMutation(api.visitors.log);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    homeClub: "",
    date: today(),
    greenFee: "",
    paid: false,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await logVisitor({
        clubId,
        name: form.name.trim(),
        phone: form.phone || undefined,
        email: form.email || undefined,
        homeClub: form.homeClub || undefined,
        date: form.date,
        greenFee: form.greenFee ? Math.round(parseFloat(form.greenFee) * 100) : undefined,
        currency,
        paidAt: form.paid ? new Date().toISOString() : undefined,
        notes: form.notes || undefined,
        loggedBy: userId,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Log visitor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Visitor's full name"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Green fee ({currency})</label>
              <input type="number" value={form.greenFee} onChange={e => setForm(f => ({ ...f, greenFee: e.target.value }))}
                placeholder="0.00" min="0" step="0.01"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Home club</label>
              <input type="text" value={form.homeClub} onChange={e => setForm(f => ({ ...f, homeClub: e.target.value }))}
                placeholder="e.g. Royal Mid-Surrey"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes about the visit"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <div
              onClick={() => setForm(f => ({ ...f, paid: !f.paid }))}
              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${form.paid ? "bg-green-600 border-green-600" : "border-gray-300"}`}
            >
              {form.paid && <Check size={12} className="text-white" />}
            </div>
            <span className="text-sm text-gray-700">Green fee paid</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
            {saving ? "Saving…" : "Log visitor"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VisitorsPage() {
  const { user } = useUser();
  const { club } = useActiveClub();
  const visitors = useQuery(api.visitors.listByClub, club ? { clubId: club._id } : "skip");
  const markPaid = useMutation(api.visitors.markPaid);
  const removeVisitor = useMutation(api.visitors.remove);

  const [showLog, setShowLog] = useState(false);
  const [dateFilter, setDateFilter] = useState("");

  if (!club) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const filtered = (visitors ?? []).filter(v => !dateFilter || v.date === dateFilter);
  const totalRevenue = filtered.filter(v => v.paidAt).reduce((s, v) => s + (v.greenFee ?? 0), 0);
  const unpaidCount = filtered.filter(v => !v.paidAt && v.greenFee).length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visitors</h1>
          <p className="text-gray-500 text-sm mt-0.5">Guest records and green fee tracking</p>
        </div>
        <button
          onClick={() => setShowLog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={15} /> Log visitor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Visitors" + (dateFilter ? " (filtered)" : ""), value: filtered.length },
          { label: "Green fee revenue", value: formatCurrency(totalRevenue, club.currency) },
          { label: "Awaiting payment", value: unpaidCount },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-800">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        {dateFilter && (
          <button onClick={() => setDateFilter("")} className="text-sm text-gray-500 hover:text-gray-700">
            Clear filter
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <UserCheck size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No visitors logged yet</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Home club</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium text-right">Green fee</th>
                <th className="px-5 py-3 font-medium text-right">Paid</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{v.name}</p>
                    {v.email && <p className="text-xs text-gray-400">{v.email}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">{v.homeClub ?? "—"}</td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {new Date(v.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-gray-900">
                    {v.greenFee ? formatCurrency(v.greenFee, v.currency) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {v.paidAt ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Paid</span>
                    ) : v.greenFee ? (
                      <button
                        onClick={() => markPaid({ visitorId: v._id })}
                        className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium hover:bg-amber-200 transition-colors"
                      >
                        Mark paid
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => { if (confirm(`Remove ${v.name}?`)) removeVisitor({ visitorId: v._id }); }}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showLog && user && (
        <LogVisitorModal
          clubId={club._id}
          currency={club.currency}
          userId={user.id}
          onClose={() => setShowLog(false)}
        />
      )}
    </div>
  );
}
