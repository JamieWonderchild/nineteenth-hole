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

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import {
  X, Clock, BarChart2, ClipboardList,
  CheckCircle2, Circle, AlertTriangle,
  PackageOpen, PackageCheck, Plus, ScanSearch, User, Search, ChevronRight,
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

type ProductForTake = {
  _id: Id<"posProducts">;
  name: string;
  trackStock?: boolean;
  categoryId?: Id<"posCategories">;
  categoryName?: string;
};

function StockTakeForm({
  products,
  type,
  existingCounts,
  onSave,
  onCancel,
  saving,
}: {
  products: ProductForTake[];
  type: "opening" | "closing" | "spot";
  existingCounts?: StockRow[];
  onSave: (counts: StockRow[], notes: string, takenByName: string) => void;
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
  const [takenByName, setTakenByName] = useState("");
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  function setCount(productId: Id<"posProducts">, value: string) {
    const n = Math.max(0, parseInt(value, 10) || 0);
    setCounts((prev) =>
      prev.map((c) => c.productId === productId ? { ...c, countedUnits: n } : c)
    );
  }

  // Build a map from productId → product (for categoryId/categoryName lookup)
  const productMap = new Map(tracked.map((p) => [p._id, p]));

  // Filter by search, then group by category
  const needle = search.trim().toLowerCase();
  const filtered = counts.filter((row) =>
    !needle || row.productName.toLowerCase().includes(needle)
  );

  // Group: build ordered list of [categoryLabel, rows[]]
  const groups: { label: string; rows: StockRow[] }[] = [];
  const seen = new Map<string, StockRow[]>();
  for (const row of filtered) {
    const cat = productMap.get(row.productId);
    const label = cat?.categoryName ?? "Uncategorised";
    if (!seen.has(label)) {
      seen.set(label, []);
      groups.push({ label, rows: seen.get(label)! });
    }
    seen.get(label)!.push(row);
  }

  const typeLabel = type === "opening" ? "Opening stock take" : type === "closing" ? "Closing stock take" : "Spot stock take";
  const typeIcon  = type === "opening"
    ? <PackageOpen size={16} className="text-green-400" />
    : type === "closing"
    ? <PackageCheck size={16} className="text-blue-400" />
    : <ScanSearch size={16} className="text-amber-400" />;
  const typeBtnLabel = type === "opening" ? "Save opening stock take" : type === "closing" ? "Save closing stock take" : "Save spot count";
  const ringColour = type === "spot" ? "focus:ring-amber-500" : "focus:ring-green-500";
  const saveBtnClass = type === "spot"
    ? "bg-amber-600 hover:bg-amber-500"
    : "bg-green-600 hover:bg-green-500";

  const canSave = takenByName.trim().length > 0;

  if (tracked.length === 0) {
    return (
      <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 text-sm text-amber-300">
        <strong>No stock-tracked products for this location.</strong> Enable stock tracking
        on products in product management to use the stock take feature.
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { if (takenByName.trim()) onSave([], notes, takenByName.trim()); }}
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
        {typeIcon}
        <h3 className="font-semibold text-white text-sm">{typeLabel}</h3>
        <span className="ml-auto text-[11px] text-gray-500">{tracked.length} product{tracked.length !== 1 ? "s" : ""}</span>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        {type === "opening"
          ? "Count physical units for each tracked product at the start of the shift."
          : type === "closing"
          ? "Count physical units for each tracked product at the end of the shift."
          : "Count physical units for a mid-shift spot check. You can run multiple spot counts during a shift."}
      </p>

      {/* Staff name */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
          <User size={11} /> Your name <span className="text-red-400 ml-0.5">*</span>
        </label>
        <input
          value={takenByName}
          onChange={(e) => setTakenByName(e.target.value)}
          placeholder="e.g. Jamie"
          autoFocus
          className={`w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 ${ringColour}`}
        />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${tracked.length} product${tracked.length !== 1 ? "s" : ""}…`}
          className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Product rows grouped by category */}
      <div className="mb-4 space-y-1 max-h-72 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No products match "{search}"</p>
        ) : (
          groups.map(({ label, rows }) => {
            // When searching, always show all groups open
            const isCollapsed = !needle && collapsedGroups.has(label);
            const counted = rows.filter((r) => r.countedUnits > 0).length;
            return (
              <div key={label}>
                {groups.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(label)}
                    className="w-full flex items-center gap-2 py-1.5 pl-0.5 pr-1 text-left group"
                  >
                    <ChevronRight
                      size={12}
                      className={`text-gray-500 transition-transform shrink-0 ${isCollapsed ? "" : "rotate-90"}`}
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 group-hover:text-gray-300 transition-colors flex-1">
                      {label}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {counted > 0 ? `${counted}/${rows.length}` : rows.length}
                    </span>
                  </button>
                ) : null}
                {!isCollapsed && (
                  <div className="space-y-2 mb-3">
                    {rows.map((row) => (
                      <div key={row.productId} className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-gray-200 font-medium">{row.productName}</span>
                        <div className="flex items-center gap-1 shrink-0">
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
                            className={`w-16 text-center bg-gray-900 border border-gray-600 rounded-lg py-1.5 text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${ringColour}`}
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
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Notes <span className="text-gray-600">(optional)</span>
        </label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Delivery arrived, short on Peroni"
          className={`w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 ${ringColour}`}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(counts, notes, takenByName.trim())}
          disabled={saving || !canSave}
          className={`px-4 py-2 ${saveBtnClass} text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50`}
        >
          {saving ? "Saving…" : typeBtnLabel}
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

  const {
    summary, stockVariance,
    hasOpeningStockTake, hasClosingStockTake,
    openingTakenByName, openingTakenAt,
    closingTakenByName, closingTakenAt,
    spotTakes,
  } = report;
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
            {(spotTakes?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <ScanSearch size={10} /> {spotTakes!.length} spot
              </span>
            )}
            <span className={`flex items-center gap-1 ${hasClosingStockTake ? "text-green-400" : "text-gray-600"}`}>
              {hasClosingStockTake ? <CheckCircle2 size={10} /> : <Circle size={10} />} Closing
            </span>
          </div>
        </div>

        {/* Who did the opening / closing takes */}
        {(hasOpeningStockTake || hasClosingStockTake) && (
          <div className="px-4 py-2 border-b border-gray-700 flex flex-wrap gap-x-4 gap-y-1">
            {hasOpeningStockTake && openingTakenByName && (
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <User size={9} className="text-green-500" />
                Opening: <span className="text-gray-300 font-medium ml-0.5">{openingTakenByName}</span>
                {openingTakenAt && (
                  <span className="text-gray-600 ml-1">{new Date(openingTakenAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </span>
            )}
            {hasClosingStockTake && closingTakenByName && (
              <span className="text-[11px] text-gray-500 flex items-center gap-1">
                <User size={9} className="text-blue-500" />
                Closing: <span className="text-gray-300 font-medium ml-0.5">{closingTakenByName}</span>
                {closingTakenAt && (
                  <span className="text-gray-600 ml-1">{new Date(closingTakenAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </span>
            )}
          </div>
        )}

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

      {/* Spot takes log */}
      {(spotTakes?.length ?? 0) > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
            <ScanSearch size={14} className="text-amber-400" />
            <span className="font-semibold text-gray-200 text-sm">Spot stock takes ({spotTakes!.length})</span>
          </div>
          <div className="divide-y divide-gray-700/40">
            {spotTakes!.map((spot) => (
              <div key={spot._id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <User size={11} className="text-amber-400" />
                  <span className="text-xs font-semibold text-gray-200">{spot.takenByName}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(spot.takenAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {spot.notes && (
                    <span className="text-xs text-gray-500 italic ml-auto truncate">"{spot.notes}"</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {spot.counts.map((c) => (
                    <div key={c.productId} className="flex justify-between text-xs">
                      <span className="text-gray-400 truncate">{c.productName}</span>
                      <span className="text-gray-200 font-mono font-semibold ml-2 shrink-0">{c.countedUnits}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
  kioskId,
}: {
  shift: { _id: Id<"posShifts">; locationId: Id<"posLocations">; status: string; openedAt: string; closedAt?: string };
  locationName: string;
  currency: string;
  products: ProductForTake[];
  clubId: Id<"clubs">;
  kioskId: Id<"posKiosks">;
}) {
  const [showStockTake, setShowStockTake] = useState<"opening" | "closing" | "spot" | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stockTakes     = useQuery(api.posShifts.getStockTakes, { shiftId: shift._id });
  const recordStockTake = useMutation(api.posShifts.recordStockTake);
  const closeShift      = useMutation(api.posShifts.closeShift);

  const openingTake = stockTakes?.find((t) => t.type === "opening");
  const closingTake = stockTakes?.find((t) => t.type === "closing");
  const spotCount   = stockTakes?.filter((t) => t.type === "spot").length ?? 0;
  const isOpen      = shift.status === "open";

  const handleStockTakeSave = useCallback(async (counts: StockRow[], notes: string, takenByName: string) => {
    if (!showStockTake) return;
    setSaving(true);
    try {
      await recordStockTake({
        clubId,
        shiftId:     shift._id,
        locationId:  shift.locationId,
        type:        showStockTake,
        takenByName,
        counts,
        notes:       notes || undefined,
        kioskId,
      });
      setShowStockTake(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save stock take");
    } finally {
      setSaving(false);
    }
  }, [showStockTake, recordStockTake, clubId, kioskId, shift._id, shift.locationId]);

  const handleCloseShift = useCallback(async () => {
    setSaving(true);
    try {
      await closeShift({ shiftId: shift._id, kioskId });
      setShowCloseConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close shift");
    } finally {
      setSaving(false);
    }
  }, [closeShift, kioskId, shift._id]);

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

        {isOpen && (
          <button
            onClick={() => setShowStockTake("spot")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-amber-700 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 transition-colors"
          >
            <ScanSearch size={14} />
            Spot count
            {spotCount > 0 && (
              <span className="text-[10px] bg-amber-700/60 text-amber-200 px-1.5 py-0.5 rounded-full font-semibold">
                {spotCount}
              </span>
            )}
          </button>
        )}

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
  kioskId,
  onClose,
}: {
  clubId:       Id<"clubs">;
  locationId:   Id<"posLocations">;
  locationName: string;
  currency:     string;
  kioskId:      Id<"posKiosks">;
  onClose:      () => void;
}) {
  const rawProducts = useQuery(api.pos.listProducts, { clubId });
  const categories  = useQuery(api.pos.listCategories, { clubId });
  const openShift   = useQuery(api.posShifts.getOpenShift, { clubId, locationId });

  // Join category names onto products
  const products = useMemo<ProductForTake[] | undefined>(() => {
    if (!rawProducts || !categories) return undefined;
    const catMap = new Map(categories.map((c) => [c._id, c.name]));
    return rawProducts.map((p) => ({
      ...p,
      categoryName: p.categoryId ? catMap.get(p.categoryId) : undefined,
    }));
  }, [rawProducts, categories]);

  const openShiftMutation = useMutation(api.posShifts.openShift);

  const [openingNotes, setOpeningNotes] = useState("");
  const [opening, setOpening]           = useState(false);
  const [openError, setOpenError]       = useState<string | null>(null);

  const handleOpenShift = useCallback(async () => {
    setOpening(true);
    setOpenError(null);
    try {
      await openShiftMutation({ clubId, locationId, kioskId, notes: openingNotes.trim() || undefined });
      setOpeningNotes("");
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : "Failed to open shift");
    } finally {
      setOpening(false);
    }
  }, [openShiftMutation, clubId, locationId, kioskId, openingNotes]);

  // openShift === undefined → still loading; null → no open shift
  const loading = openShift === undefined || products === undefined || categories === undefined;

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
              kioskId={kioskId}
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
