"use client";

/**
 * KioskShiftModal
 *
 * A fullscreen-friendly dark overlay that shows the current shift for a kiosk
 * location — income summary, member/guest split, stock movement — and lets a
 * manager open a new shift if one isn't already running.
 *
 * Mirrors the ShiftReportPanel + ShiftCard from the manage/pos/shifts page but
 * styled for the dark kiosk UI and presented as an overlay so the kiosk never
 * navigates away.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import {
  X, Clock, BarChart2, ClipboardList,
  CheckCircle2, Circle, AlertTriangle,
  PackageOpen, PackageCheck, Plus,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function shiftDuration(openedAt: string, closedAt?: string) {
  const end = closedAt ? new Date(closedAt) : new Date();
  const diffMs = end.getTime() - new Date(openedAt).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type StockRow = {
  productId: Id<"posProducts">;
  productName: string;
  countedUnits: number;
};

// ── Stock Take Form (dark variant) ────────────────────────────────────────────

function StockTakeForm({
  products,
  type,
  existingCounts,
  onSave,
  onCancel,
  saving,
}: {
  products: { _id: Id<"posProducts">; name: string; trackStock?: boolean }[];
  type: "opening" | "closing";
  existingCounts?: StockRow[];
  onSave: (counts: StockRow[], notes: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const tracked = products.filter((p) => p.trackStock);

  const [counts, setCounts] = useState<StockRow[]>(() =>
    tracked.map((p) => ({
      productId: p._id,
      productName: p.name,
      countedUnits: existingCounts?.find((c) => c.productId === p._id)?.countedUnits ?? 0,
    }))
  );
  const [notes, setNotes] = useState("");

  function setCount(productId: Id<"posProducts">, value: string) {
    const n = Math.max(0, parseInt(value, 10) || 0);
    setCounts((prev) =>
      prev.map((c) => c.productId === productId ? { ...c, countedUnits: n } : c)
    );
  }

  if (tracked.length === 0) {
    return (
      <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 text-sm text-amber-300">
        <strong>No stock-tracked products for this location.</strong> Enable stock tracking
        on products in product management to use the stock take feature.
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onSave([], notes)}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Continue without stock take
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        {type === "opening"
          ? <PackageOpen size={16} className="text-green-400" />
          : <PackageCheck size={16} className="text-blue-400" />}
        <h3 className="font-semibold text-white text-sm">
          {type === "opening" ? "Opening stock take" : "Closing stock take"}
        </h3>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Count physical units for each tracked product at{" "}
        {type === "opening" ? "the start" : "the end"} of the shift.
      </p>

      <div className="space-y-3 mb-4">
        {counts.map((row) => (
          <div key={row.productId} className="flex items-center gap-3">
            <span className="flex-1 text-sm text-gray-200 font-medium">{row.productName}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCount(row.productId, String(Math.max(0, row.countedUnits - 1)))}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors"
              >−</button>
              <input
                type="number"
                min="0"
                value={row.countedUnits}
                onChange={(e) => setCount(row.productId, e.target.value)}
                className="w-16 text-center bg-gray-900 border border-gray-600 rounded-lg py-1.5 text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={() => setCount(row.productId, String(row.countedUnits + 1))}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors"
              >+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Notes <span className="text-gray-600">(optional)</span>
        </label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Delivery arrived, short on Peroni"
          className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(counts, notes)}
          disabled={saving}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : `Save ${type} stock take`}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Shift Report Panel (dark variant) ─────────────────────────────────────────

function ShiftReportPanel({ shiftId, currency }: { shiftId: Id<"posShifts">; currency: string }) {
  const report = useQuery(api.posShifts.getShiftReport, { shiftId });

  if (!report) {
    return <div className="animate-pulse h-32 bg-gray-700 rounded-xl" />;
  }

  const { summary, stockVariance, hasOpeningStockTake, hasClosingStockTake } = report;
  const hasVarianceData = hasOpeningStockTake && hasClosingStockTake;

  return (
    <div className="space-y-3">
      {/* Income summary */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
          <BarChart2 size={14} className="text-gray-400" />
          <span className="font-semibold text-gray-200 text-sm">Income summary</span>
          <span className="ml-auto text-xs text-gray-500">
            {summary.saleCount} sale{summary.saleCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="divide-y divide-gray-700/50">
          {[
            { label: "Cash",            value: summary.cashPence,    color: "text-amber-400" },
            { label: "Card / Terminal", value: summary.cardPence,    color: "text-blue-400"  },
            { label: "Member account",  value: summary.accountPence, color: "text-purple-400" },
            { label: "Complimentary",   value: summary.compPence,    color: "text-gray-500"  },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-400">{label}</span>
              <span className={`text-sm font-semibold ${value > 0 ? color : "text-gray-600"}`}>
                {formatCurrency(value, currency)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-700/40">
            <span className="text-sm font-bold text-gray-100">Total</span>
            <span className="text-xl font-black text-white">{formatCurrency(summary.totalPence, currency)}</span>
          </div>
        </div>
      </div>

      {/* Member vs Guest split */}
      {(summary.guestPence > 0 || summary.memberPence > 0) && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <span className="font-semibold text-gray-200 text-sm">Member vs. Guest</span>
          </div>
          <div className="divide-y divide-gray-700/50">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-400">Member sales</span>
              <span className="text-sm font-semibold text-gray-200">{formatCurrency(summary.memberPence, currency)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-400">Guest / visitor sales</span>
              <span className="text-sm font-semibold text-gray-200">{formatCurrency(summary.guestPence, currency)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stock movement */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
          <ClipboardList size={14} className="text-gray-400" />
          <span className="font-semibold text-gray-200 text-sm">Stock movement</span>
          <div className="ml-auto flex gap-3 text-[11px]">
            <span className={`flex items-center gap-1 ${hasOpeningStockTake ? "text-green-400" : "text-gray-600"}`}>
              {hasOpeningStockTake ? <CheckCircle2 size={10} /> : <Circle size={10} />} Opening
            </span>
            <span className={`flex items-center gap-1 ${hasClosingStockTake ? "text-green-400" : "text-gray-600"}`}>
              {hasClosingStockTake ? <CheckCircle2 size={10} /> : <Circle size={10} />} Closing
            </span>
          </div>
        </div>

        {!hasVarianceData ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            {!hasOpeningStockTake && !hasClosingStockTake
              ? "No stock takes recorded for this shift."
              : "Variance available once both opening and closing stock takes are complete."}
          </div>
        ) : stockVariance.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            No stock-tracked products in this location.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700">
                  <th className="text-left px-4 py-2">Product</th>
                  <th className="text-right px-3 py-2">Open</th>
                  <th className="text-right px-3 py-2">Sold</th>
                  <th className="text-right px-3 py-2">Close</th>
                  <th className="text-right px-4 py-2">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {stockVariance.map((row) => {
                  const bad  = row.variance !== null && row.variance < 0;
                  const good = row.variance !== null && row.variance === 0;
                  return (
                    <tr key={row.productId}>
                      <td className="px-4 py-2.5 font-medium text-gray-200">{row.productName}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{row.openCount  ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-gray-300 font-medium">{row.sold}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{row.closeCount ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {row.variance === null ? (
                          <span className="text-gray-600">—</span>
                        ) : (
                          <span className={`font-bold ${bad ? "text-red-400" : good ? "text-green-400" : "text-amber-400"}`}>
                            {bad ? "" : row.variance > 0 ? "+" : ""}{row.variance}
                            {bad && <AlertTriangle size={11} className="inline ml-1" />}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-4 py-2 text-[11px] text-gray-600 border-t border-gray-700">
              Variance = (opening − closing) − units sold. Negative = more taken than recorded.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shift panel (open shift actions + report) ─────────────────────────────────

function ActiveShiftPanel({
  shift,
  locationName,
  currency,
  products,
  clubId,
}: {
  shift: { _id: Id<"posShifts">; locationId: Id<"posLocations">; status: string; openedAt: string; closedAt?: string };
  locationName: string;
  currency: string;
  products: { _id: Id<"posProducts">; name: string; trackStock?: boolean }[];
  clubId: Id<"clubs">;
}) {
  const [showStockTake, setShowStockTake] = useState<"opening" | "closing" | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stockTakes     = useQuery(api.posShifts.getStockTakes, { shiftId: shift._id });
  const recordStockTake = useMutation(api.posShifts.recordStockTake);
  const closeShift      = useMutation(api.posShifts.closeShift);

  const openingTake = stockTakes?.find((t) => t.type === "opening");
  const closingTake = stockTakes?.find((t) => t.type === "closing");
  const isOpen      = shift.status === "open";

  const handleStockTakeSave = useCallback(async (counts: StockRow[], notes: string) => {
    if (!showStockTake) return;
    setSaving(true);
    try {
      await recordStockTake({
        clubId,
        shiftId:    shift._id,
        locationId: shift.locationId,
        type:       showStockTake,
        counts,
        notes:      notes || undefined,
      });
      setShowStockTake(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save stock take");
    } finally {
      setSaving(false);
    }
  }, [showStockTake, recordStockTake, clubId, shift._id]);

  const handleCloseShift = useCallback(async () => {
    setSaving(true);
    try {
      await closeShift({ shiftId: shift._id });
      setShowCloseConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close shift");
    } finally {
      setSaving(false);
    }
  }, [closeShift, shift._id]);

  return (
    <div className="space-y-4">
      {/* Shift header info */}
      <div className="flex items-center gap-3 px-1">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOpen ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">{locationName}</span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${isOpen ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}`}>
              {isOpen ? "Open" : "Closed"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={10} /> {formatDateTime(shift.openedAt)}
            </span>
            <span className="text-xs text-gray-500">{shiftDuration(shift.openedAt, shift.closedAt)}</span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={13} /></button>
        </div>
      )}

      {/* Stock take + close actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowStockTake("opening")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            openingTake
              ? "border-green-700 bg-green-900/30 text-green-300"
              : "border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          {openingTake ? <CheckCircle2 size={14} /> : <PackageOpen size={14} />}
          Opening stock take
          {openingTake && <span className="text-[10px] text-green-400 ml-0.5">✓</span>}
        </button>

        <button
          onClick={() => setShowStockTake("closing")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            closingTake
              ? "border-blue-700 bg-blue-900/30 text-blue-300"
              : "border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          {closingTake ? <CheckCircle2 size={14} /> : <PackageCheck size={14} />}
          Closing stock take
          {closingTake && <span className="text-[10px] text-blue-400 ml-0.5">✓</span>}
        </button>

        {isOpen && (
          <button
            onClick={() => setShowCloseConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-red-700 bg-red-900/30 text-red-300 hover:bg-red-900/60 transition-colors ml-auto"
          >
            Close shift
          </button>
        )}
      </div>

      {/* Stock take form */}
      {showStockTake && (
        <StockTakeForm
          products={products}
          type={showStockTake}
          existingCounts={
            showStockTake === "opening"
              ? openingTake?.counts as StockRow[] | undefined
              : closingTake?.counts as StockRow[] | undefined
          }
          onSave={handleStockTakeSave}
          onCancel={() => setShowStockTake(null)}
          saving={saving}
        />
      )}

      {/* Close shift confirm */}
      {showCloseConfirm && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-200 mb-1">Close this shift?</p>
          <p className="text-xs text-red-400 mb-3">
            {!closingTake && "You haven't taken a closing stock take yet. "}
            Once closed, no new sales can be attributed to this shift.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCloseShift}
              disabled={saving}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Closing…" : "Yes, close shift"}
            </button>
            <button
              onClick={() => setShowCloseConfirm(false)}
              className="px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Report */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Shift report</p>
        <ShiftReportPanel shiftId={shift._id} currency={currency} />
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function KioskShiftModal({
  clubId,
  locationId,
  locationName,
  currency,
  onClose,
}: {
  clubId:       Id<"clubs">;
  locationId:   Id<"posLocations">;
  locationName: string;
  currency:     string;
  onClose:      () => void;
}) {
  const products  = useQuery(api.pos.listProducts, { clubId });
  const openShift = useQuery(api.posShifts.getOpenShift, { clubId, locationId });

  const openShiftMutation = useMutation(api.posShifts.openShift);

  const [openingNotes, setOpeningNotes] = useState("");
  const [opening, setOpening]           = useState(false);
  const [openError, setOpenError]       = useState<string | null>(null);

  const handleOpenShift = useCallback(async () => {
    setOpening(true);
    setOpenError(null);
    try {
      await openShiftMutation({ clubId, locationId, notes: openingNotes.trim() || undefined });
      setOpeningNotes("");
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : "Failed to open shift");
    } finally {
      setOpening(false);
    }
  }, [openShiftMutation, clubId, locationId, openingNotes]);

  // openShift === undefined → still loading; null → no open shift
  const loading = openShift === undefined || products === undefined;

  return (
    // Backdrop — sits above the POS but below the pin pad (z-40 vs z-50)
    <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              <Clock size={16} className="text-gray-400" /> Shift — {locationName}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage the current shift and view sales for this location.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : openShift ? (
            /* Active shift */
            <ActiveShiftPanel
              shift={openShift as { _id: Id<"posShifts">; locationId: Id<"posLocations">; status: string; openedAt: string; closedAt?: string }}
              locationName={locationName}
              currency={currency}
              products={products ?? []}
              clubId={clubId}
            />
          ) : (
            /* No open shift — offer to open one */
            <div className="space-y-4">
              <div className="text-center py-6">
                <Clock size={36} className="mx-auto mb-3 text-gray-600" />
                <p className="text-gray-300 font-semibold">No shift open at {locationName}</p>
                <p className="text-gray-500 text-sm mt-1">Open a shift to start recording sales against it.</p>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-white text-sm flex items-center gap-1.5">
                  <Plus size={14} className="text-green-400" /> Open new shift
                </h3>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Notes <span className="text-gray-600">(optional)</span>
                  </label>
                  <input
                    value={openingNotes}
                    onChange={(e) => setOpeningNotes(e.target.value)}
                    placeholder="e.g. Evening service, Jamie on bar"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                {openError && (
                  <p className="text-sm text-red-400">{openError}</p>
                )}
                <button
                  onClick={handleOpenShift}
                  disabled={opening}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {opening ? "Opening…" : "Open shift"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
