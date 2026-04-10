"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { Send, Mail, Users, ChevronDown } from "lucide-react";

const FILTERS = [
  { value: "all", label: "All active members", description: "Everyone with an active membership" },
  { value: "admins", label: "Admins only", description: "Club administrators only" },
] as const;

type Filter = typeof FILTERS[number]["value"];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function CommsPage() {
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");
  const history = useQuery(api.communications.listByClub, club ? { clubId: club._id } : "skip");
  const sendBulkEmail = useAction(api.communications.sendBulkEmail);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const activeFilter = FILTERS.find(f => f.value === filter)!;
  const memberCount = useQuery(api.clubMembers.listByClub, club ? { clubId: club._id } : "skip");
  const adminCount = memberCount?.filter(m => m.role === "admin").length ?? 0;
  const totalCount = filter === "admins" ? adminCount : (memberCount?.length ?? 0);

  async function handleSend() {
    if (!user || !club || !subject.trim() || !body.trim()) return;
    if (!confirm(`Send to ${totalCount} member${totalCount !== 1 ? "s" : ""}? This cannot be undone.`)) return;

    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await sendBulkEmail({
        clubId: club._id,
        sentBy: user.id,
        subject: subject.trim(),
        body: body.trim(),
        recipientFilter: filter,
      });
      setResult(res as { sent: number; failed: number });
      setSubject("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
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
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
        <p className="text-gray-500 text-sm mt-0.5">Email your members directly from here</p>
      </div>

      {/* Compose */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Mail size={16} className="text-green-700" />
          <span className="font-semibold text-gray-900 text-sm">New email</span>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Recipients */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">To</label>
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(m => !m)}
                className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white hover:border-green-400 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-gray-400" />
                  <span className="font-medium text-gray-900">{activeFilter.label}</span>
                  <span className="text-gray-400">— {totalCount} recipient{totalCount !== 1 ? "s" : ""}</span>
                </div>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              {showFilterMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {FILTERS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => { setFilter(f.value); setShowFilterMenu(false); }}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${filter === f.value ? "bg-green-50" : ""}`}
                    >
                      <p className="text-sm font-medium text-gray-900">{f.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Club championship results — well done everyone!"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message here. Use blank lines to separate paragraphs."
              rows={10}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">{body.length} characters · Sent as a formatted email from {club.name}</p>
          </div>

          {/* Result / error */}
          {result && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
              ✓ Sent to {result.sent} member{result.sent !== 1 ? "s" : ""}
              {result.failed > 0 && ` · ${result.failed} failed (no email on file)`}
            </div>
          )}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Send */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Send size={14} />
              {sending ? "Sending…" : `Send to ${totalCount} member${totalCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </section>

      {/* History */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Sent emails</h2>
        {!history || history.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
            <p className="text-gray-400 text-sm">No emails sent yet</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {history.map(c => (
              <div key={c._id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{c.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.body}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">{timeAgo(c.sentAt)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.recipientCount} sent · {c.recipientFilter}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
