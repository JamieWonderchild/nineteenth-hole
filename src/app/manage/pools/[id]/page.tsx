"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { use } from "react";

const STATUS_FLOW = ["draft", "open", "live", "complete"] as const;

export default function ManagePoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const pool = useQuery(api.competitions.get, { competitionId: id as never });
  const entries = useQuery(api.entries.listByCompetition, pool ? { competitionId: pool._id } : "skip");
  const players = useQuery(api.players.listByCompetition, pool ? { competitionId: pool._id } : "skip");
  const updateStatus = useMutation(api.competitions.updateStatus);
  const runDraw = useMutation(api.entries.runDraw);

  if (!pool) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const paidEntries = (entries ?? []).filter(e => e.paidAt);
  const currentStep = STATUS_FLOW.indexOf(pool.status as typeof STATUS_FLOW[number]);
  const nextStatus = STATUS_FLOW[currentStep + 1];
  const pot = paidEntries.length * pool.entryFee;
  const sym = pool.currency === "GBP" ? "£" : pool.currency === "EUR" ? "€" : "$";

  async function handleRunDraw() {
    if (!pool) return;
    if (!confirm(`Run draw for ${paidEntries.length} entries? This cannot be undone.`)) return;
    try {
      await runDraw({ competitionId: pool._id });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Draw failed");
    }
  }

  async function handleAdvanceStatus() {
    if (!pool || !nextStatus) return;
    await updateStatus({ competitionId: pool._id, status: nextStatus });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">{pool.name}</h1>
          <p className="text-sm text-muted-foreground">Platform pool · {pool.status}</p>
        </div>
        <Link
          href={`/pools/${pool.slug}`}
          target="_blank"
          className="flex items-center gap-1.5 text-sm text-green-700 hover:underline"
        >
          View <ExternalLink size={14} />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Entries", value: paidEntries.length },
          { label: "Pot", value: formatCurrency(pot, pool.currency) },
          { label: "Players", value: players?.length ?? "—" },
          { label: "Status", value: pool.status.charAt(0).toUpperCase() + pool.status.slice(1) },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-800">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pool info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Tournament</span>
          <span className="font-medium">{pool.tournamentRef ?? pool.type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Dates</span>
          <span className="font-medium">
            {new Date(pool.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – {new Date(pool.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Entry deadline</span>
          <span className="font-medium">
            {new Date(pool.entryDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Entry fee</span>
          <span className="font-medium">
            {sym}{(pool.entryFee / 100).toFixed(0)} + {sym}{(Math.round(pool.entryFee * 0.1) / 100).toFixed(2)} fee
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Prize structure</span>
          <span className="font-medium">
            {pool.prizeStructure.map(p => `${p.position}st ${p.percentage}%`).join(", ")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Public URL</span>
          <span className="font-mono text-xs text-green-700">/pools/{pool.slug}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Actions</h2>

        {pool.status === "draft" && (
          <Button onClick={handleAdvanceStatus} className="w-full">
            Open pool for entries
          </Button>
        )}

        {pool.status === "open" && (
          <>
            <Button
              onClick={handleRunDraw}
              disabled={paidEntries.length === 0 || (players?.length ?? 0) === 0}
              className="w-full"
            >
              Run draw ({paidEntries.length} entries, {players?.length ?? 0} players)
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Add players via the Convex dashboard first. Draw assigns one per tier per entrant.
            </p>
          </>
        )}

        {pool.status === "live" && (
          <Button onClick={handleAdvanceStatus} variant="outline" className="w-full">
            Mark as complete
          </Button>
        )}

        {nextStatus && pool.status !== "open" && (
          <Button variant="outline" size="sm" onClick={handleAdvanceStatus} className="w-full text-muted-foreground">
            Force advance to: {nextStatus}
          </Button>
        )}
      </div>

      {/* Entry list */}
      {entries && entries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Entries ({entries.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Paid</th>
                <th className="px-5 py-3">Players drawn</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e._id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-gray-900">{e.displayName}</td>
                  <td className="px-5 py-3">
                    {e.paidAt ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Unpaid</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {e.drawnPlayerIds ? `${e.drawnPlayerIds.length} players` : "Not drawn"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
