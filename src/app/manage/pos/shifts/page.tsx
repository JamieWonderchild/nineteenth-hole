"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import { formatCurrency } from "@/lib/format";
import type { Id } from "convex/_generated/dataModel";
import {
  Clock, MapPin, Plus, X, ChevronDown, ChevronRight,
  PackageOpen, PackageCheck, BarChart2, AlertTriangle,
  CheckCircle2, Circle, ClipboardList, ScanSearch, User, Search,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type StockRow = {
  productId: Id<"posProducts">;
  productName: string;
  countedUnits: number | null; // null = not yet counted (excluded from save)
};

// Rows that have been counted — safe to send to Convex
type CountedRow = { productId: Id<"posProducts">; productName: string; countedUnits: number };

type ProductForTake = {
  _id: Id<"posProducts">;
  name: string;
  trackStock?: boolean;
  categoryId?: Id<"posCategories">;
  categoryName?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function shiftDuration(openedAt: string, closedAt?: string) {
  const end = closedAt ? new Date(closedAt) : new Date();
  const diffMs = end.getTime() - new Date(openedAt).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Stock Take Form ───────────────────────────────────────────────────────────

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
  existingCounts?: CountedRow[];
  onSave: (counts: CountedRow[], notes: string, takenByName: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  // Only show stock-tracked products
  const tracked = products.filter((p) => p.trackStock);

  const [counts, setCounts] = useState<StockRow[]>(() =>
    tracked.map((p) => {
      const existing = existingCounts?.find((c) => c.productId === p._id);
      return {
        productId: p._id,
        productName: p.name,
        countedUnits: existing != null ? existing.countedUnits : null,
      };
    })
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
    const n = value === "" ? null : Math.max(0, parseInt(value, 10) || 0);
    setCounts((prev) =>
      prev.map((c) => c.productId === productId ? { ...c, countedUnits: n } : c)
    );
  }

  function increment(productId: Id<"posProducts">, current: number | null) {
    setCounts((prev) =>
      prev.map((c) => c.productId === productId ? { ...c, countedUnits: (current ?? 0) + 1 } : c)
    );
  }

  function decrement(productId: Id<"posProducts">, current: number | null) {
    const next = Math.max(0, (current ?? 0) - 1);
    setCounts((prev) =>
      prev.map((c) => c.productId === productId ? { ...c, countedUnits: next } : c)
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

  const typeLabel  = type === "opening" ? "Opening stock take" : type === "closing" ? "Closing stock take" : "Spot stock take";
  const typeIcon   = type === "opening"
    ? <PackageOpen size={18} className="text-green-600" />
    : type === "closing"
    ? <PackageCheck size={18} className="text-blue-600" />
    : <ScanSearch size={18} className="text-amber-600" />;
  const saveBtnClass = type === "spot"
    ? "bg-amber-600 text-white hover:bg-amber-700"
    : "bg-green-600 text-white hover:bg-green-700";
  const ringClass  = type === "spot" ? "focus:ring-amber-500" : "focus:ring-green-500";
  const canSave    = takenByName.trim().length > 0;

  if (tracked.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <strong>No stock-tracked products found for this location.</strong>{" "}
        Enable stock tracking on products in{" "}
        <Link href="/manage/pos/products" className="underline font-medium">product management</Link>{" "}
        to use the stock take feature.
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { if (takenByName.trim()) onSave([], notes, takenByName.trim()); }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            Continue without stock take
          </button>
          <button onClick={onCancel} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {typeIcon}
        <h3 className="font-semibold text-gray-900">{typeLabel}</h3>
        <span className="ml-auto text-[11px] text-gray-400">{tracked.length} product{tracked.length !== 1 ? "s" : ""}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {type === "opening"
          ? "Count the physical units for each tracked product at the start of the shift."
          : type === "closing"
          ? "Count the physical units for each tracked product at the end of the shift."
          : "Mid-shift spot count. You can run multiple spot counts during a shift."}
      </p>

      {/* Staff name */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
          <User size={11} /> Your name <span className="text-red-400 ml-0.5">*</span>
        </label>
        <input
          value={takenByName}
          onChange={(e) => setTakenByName(e.target.value)}
          placeholder="e.g. Jamie"
          autoFocus
          className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ringClass}`}
        />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${tracked.length} product${tracked.length !== 1 ? "s" : ""}…`}
          className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Product rows grouped by category */}
      <div className="mb-4 space-y-1 max-h-72 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No products match "{search}"</p>
        ) : (
          groups.map(({ label, rows }) => {
            // When searching, always show all groups open
            const isCollapsed = !needle && collapsedGroups.has(label);
            const counted = rows.filter((r) => r.countedUnits !== null).length;
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
                      className={`text-gray-400 transition-transform shrink-0 ${isCollapsed ? "" : "rotate-90"}`}
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors flex-1">
                      {label}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {counted > 0 ? `${counted}/${rows.length}` : rows.length}
                    </span>
                  </button>
                ) : null}
                {!isCollapsed && (
                  <div className="space-y-2 mb-3">
                    {rows.map((row) => (
                      <div key={row.productId} className="flex items-center gap-3">
                        <span className={`flex-1 text-sm font-medium ${row.countedUnits === null ? "text-gray-400" : "text-gray-800"}`}>
                          {row.productName}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => decrement(row.productId, row.countedUnits)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
                          >−</button>
                          <input
                            type="number"
                            min="0"
                            value={row.countedUnits ?? ""}
                            placeholder="—"
                            onChange={(e) => setCount(row.productId, e.target.value)}
                            className={`w-16 text-center rounded-lg py-1.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${row.countedUnits === null ? "border border-dashed border-gray-300 text-gray-400 placeholder-gray-300" : "border border-gray-200"} ${ringClass}`}
                          />
                          <button
                            type="button"
                            onClick={() => increment(row.productId, row.countedUnits)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold"
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
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Delivery arrived, short on Peroni"
          className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ringClass}`}
        />
      </div>

      {/* Uncounted hint */}
      {counts.some((c) => c.countedUnits === null) && (
        <p className="text-[11px] text-gray-400 mb-3">
          {counts.filter((c) => c.countedUnits === null).length} product{counts.filter((c) => c.countedUnits === null).length !== 1 ? "s" : ""} left blank — blank items won't be recorded.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => {
            const recorded = counts.filter(
              (c): c is CountedRow => c.countedUnits !== null
            );
            onSave(recorded, notes, takenByName.trim());
          }}
          disabled={saving || !canSave}
          className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${saveBtnClass}`}
        >
          {saving ? "Saving…" : typeLabel}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Shift Report Panel ────────────────────────────────────────────────────────

function ShiftReportPanel({ shiftId, currency }: { shiftId: Id<"posShifts">; currency: string }) {
  const report = useQuery(api.posShifts.getShiftReport, { shiftId });

  if (!report) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />;
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
    <div className="space-y-4">
      {/* Income summary */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <BarChart2 size={15} className="text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">Income summary</span>
          <span className="ml-auto text-xs text-gray-400">{summary.saleCount} sale{summary.saleCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { label: "Cash",          value: summary.cashPence,    color: "text-amber-600" },
            { label: "Card / Terminal", value: summary.cardPence,  color: "text-blue-600"  },
            { label: "Member account", value: summary.accountPence, color: "text-purple-600" },
            { label: "Complimentary",  value: summary.compPence,   color: "text-gray-400"  },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-600">{label}</span>
              <span className={`text-sm font-semibold ${value > 0 ? color : "text-gray-300"}`}>
                {formatCurrency(value, currency)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
            <span className="text-sm font-bold text-gray-900">Total</span>
            <span className="text-lg font-black text-gray-900">{formatCurrency(summary.totalPence, currency)}</span>
          </div>
        </div>
      </div>

      {/* Member vs Guest split */}
      {(summary.guestPence > 0 || summary.memberPence > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-sm">Member vs. Guest</span>
          </div>
          <div className="divide-y divide-gray-50">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-600">Member sales</span>
              <span className="text-sm font-semibold text-gray-800">{formatCurrency(summary.memberPence, currency)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-600">Guest / visitor sales</span>
              <span className="text-sm font-semibold text-gray-800">{formatCurrency(summary.guestPence, currency)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stock variance */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <ClipboardList size={15} className="text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">Stock movement</span>
          <div className="ml-auto flex gap-2 text-[11px]">
            <span className={`flex items-center gap-1 ${hasOpeningStockTake ? "text-green-600" : "text-gray-300"}`}>
              {hasOpeningStockTake ? <CheckCircle2 size={11} /> : <Circle size={11} />} Opening
            </span>
            {(spotTakes?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <ScanSearch size={11} /> {spotTakes!.length} spot
              </span>
            )}
            <span className={`flex items-center gap-1 ${hasClosingStockTake ? "text-green-600" : "text-gray-300"}`}>
              {hasClosingStockTake ? <CheckCircle2 size={11} /> : <Circle size={11} />} Closing
            </span>
          </div>
        </div>

        {/* Who did the opening / closing takes */}
        {(hasOpeningStockTake || hasClosingStockTake) && (
          <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-x-4 gap-y-1">
            {hasOpeningStockTake && openingTakenByName && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <User size={9} className="text-green-600" />
                Opening: <span className="text-gray-700 font-medium ml-0.5">{openingTakenByName}</span>
                {openingTakenAt && (
                  <span className="text-gray-400 ml-1">{new Date(openingTakenAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </span>
            )}
            {hasClosingStockTake && closingTakenByName && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <User size={9} className="text-blue-600" />
                Closing: <span className="text-gray-700 font-medium ml-0.5">{closingTakenByName}</span>
                {closingTakenAt && (
                  <span className="text-gray-400 ml-1">{new Date(closingTakenAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </span>
            )}
          </div>
        )}

        {!hasVarianceData ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            {!hasOpeningStockTake && !hasClosingStockTake
              ? "No stock takes recorded for this shift."
              : "Variance available once both opening and closing stock takes are complete."}
          </div>
        ) : stockVariance.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            No stock-tracked products in this location.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="text-left px-4 py-2">Product</th>
                  <th className="text-right px-3 py-2">Open</th>
                  <th className="text-right px-3 py-2">Sold</th>
                  <th className="text-right px-3 py-2">Close</th>
                  <th className="text-right px-4 py-2">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stockVariance.map((row) => {
                  const bad = row.variance !== null && row.variance < 0;
                  const good = row.variance !== null && row.variance === 0;
                  return (
                    <tr key={row.productId} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{row.productName}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{row.openCount ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700 font-medium">{row.sold}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{row.closeCount ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {row.variance === null ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <span className={`font-bold ${bad ? "text-red-500" : good ? "text-green-600" : "text-amber-500"}`}>
                            {bad ? "" : row.variance > 0 ? "+" : ""}{row.variance}
                            {bad && <AlertTriangle size={12} className="inline ml-1" />}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
              Variance = units sold minus (opening − closing count). Negative = more taken than recorded (shrinkage).
            </p>
          </div>
        )}
      </div>

      {/* Spot takes log */}
      {(spotTakes?.length ?? 0) > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <ScanSearch size={15} className="text-amber-600" />
            <span className="font-semibold text-gray-800 text-sm">Spot stock takes ({spotTakes!.length})</span>
          </div>
          <div className="divide-y divide-gray-50">
            {spotTakes!.map((spot) => (
              <div key={spot._id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <User size={11} className="text-amber-600" />
                  <span className="text-xs font-semibold text-gray-800">{spot.takenByName}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(spot.takenAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {spot.notes && (
                    <span className="text-xs text-gray-400 italic ml-auto truncate">"{spot.notes}"</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {spot.counts.map((c) => (
                    <div key={c.productId} className="flex justify-between text-xs">
                      <span className="text-gray-500 truncate">{c.productName}</span>
                      <span className="text-gray-800 font-mono font-semibold ml-2 shrink-0">{c.countedUnits}</span>
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

// ── Shift Card ────────────────────────────────────────────────────────────────

function ShiftCard({
  shift,
  currency,
  onClose,
  highlight,
}: {
  shift: { _id: Id<"posShifts">; clubId: Id<"clubs">; locationId: Id<"posLocations">; locationName: string; status: string; openedAt: string; closedAt?: string };
  currency: string;
  onClose: (shiftId: Id<"posShifts">) => void;
  highlight?: boolean;
}) {
  const [expanded, setExpanded] = useState(shift.status === "open" || !!highlight);
  const [glowing, setGlowing] = useState(!!highlight);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlight) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setGlowing(false), 1500);
    return () => clearTimeout(t);
  }, [highlight]);
  const [showStockTake, setShowStockTake] = useState<"opening" | "closing" | "spot" | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stockTakes    = useQuery(api.posShifts.getStockTakes, { shiftId: shift._id });
  const rawProducts   = useQuery(api.pos.listProducts,   { clubId: shift.clubId, locationId: shift.locationId });
  const categories    = useQuery(api.pos.listCategories, { clubId: shift.clubId, locationId: shift.locationId });
  const recordStockTake = useMutation(api.posShifts.recordStockTake);

  // Join category names onto location-filtered products
  const products = useMemo<ProductForTake[]>(() => {
    if (!rawProducts || !categories) return [];
    const catMap = new Map(categories.map((c) => [c._id, c.name]));
    return rawProducts.map((p) => ({
      ...p,
      categoryName: p.categoryId ? catMap.get(p.categoryId) : undefined,
    }));
  }, [rawProducts, categories]);

  const openingTake = stockTakes?.find((t) => t.type === "opening");
  const closingTake = stockTakes?.find((t) => t.type === "closing");
  const spotCount   = stockTakes?.filter((t) => t.type === "spot").length ?? 0;
  const isOpen = shift.status === "open";

  async function handleStockTakeSave(counts: CountedRow[], notes: string, takenByName: string) {
    if (!showStockTake) return;
    setSaving(true);
    try {
      await recordStockTake({
        clubId:      shift.clubId,
        shiftId:     shift._id,
        locationId:  shift.locationId,
        type:        showStockTake,
        takenByName,
        counts,
        notes:       notes || undefined,
      });
      setShowStockTake(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save stock take");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={cardRef}
      className={`border rounded-xl overflow-hidden transition-shadow duration-700 ${
        isOpen ? "border-green-300 bg-green-50/30" : "border-gray-200 bg-white"
      } ${glowing ? "ring-2 ring-emerald-400 shadow-lg shadow-emerald-100" : ""}`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-black/5 transition-colors"
      >
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOpen ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm">{shift.locationName}</span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {isOpen ? "Open" : "Closed"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={10} /> {formatDateTime(shift.openedAt)}
            </span>
            {shift.closedAt && (
              <span className="text-xs text-gray-400">→ {formatTime(shift.closedAt)}</span>
            )}
            <span className="text-xs text-gray-400">{shiftDuration(shift.openedAt, shift.closedAt)}</span>
          </div>
        </div>
        {expanded ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg mt-3">
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)}><X size={13} /></button>
            </div>
          )}

          {/* Stock take actions */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {openingTake ? (
              <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-green-200 bg-green-50 text-green-700 cursor-default">
                <CheckCircle2 size={14} /> Opening stock take ✓
              </span>
            ) : (
              <button
                onClick={() => setShowStockTake("opening")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <PackageOpen size={14} /> Opening stock take
              </button>
            )}

            {isOpen && (
              <button
                onClick={() => setShowStockTake("spot")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <ScanSearch size={14} />
                Spot count
                {spotCount > 0 && (
                  <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-semibold">
                    {spotCount}
                  </span>
                )}
              </button>
            )}

            {closingTake ? (
              <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-blue-200 bg-blue-50 text-blue-700 cursor-default">
                <CheckCircle2 size={14} /> Closing stock take ✓
              </span>
            ) : (
              <button
                onClick={() => setShowStockTake("closing")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <PackageCheck size={14} /> Closing stock take
              </button>
            )}

            {isOpen && (
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors ml-auto"
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
                  ? openingTake?.counts as CountedRow[] | undefined
                  : closingTake?.counts as CountedRow[] | undefined
              }
              onSave={handleStockTakeSave}
              onCancel={() => setShowStockTake(null)}
              saving={saving}
            />
          )}

          {/* Close shift confirm */}
          {showCloseConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-800 mb-1">Close this shift?</p>
              <p className="text-xs text-red-600 mb-3">
                {!closingTake && "You haven't taken a closing stock take yet. "}
                Once closed, no new sales can be attributed to this shift.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onClose(shift._id); setShowCloseConfirm(false); }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Yes, close shift
                </button>
                <button
                  onClick={() => setShowCloseConfirm(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Shift report */}
          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Shift report</p>
            <ShiftReportPanel shiftId={shift._id} currency={currency} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { club } = useActiveClub();
  const searchParams = useSearchParams();
  const targetShiftId = searchParams.get("shift") as Id<"posShifts"> | null;

  const locations = useQuery(
    api.posLocations.listLocations,
    club ? { clubId: club._id } : "skip"
  );
  const shifts = useQuery(
    api.posShifts.listShifts,
    club ? { clubId: club._id } : "skip"
  );
  const openShift  = useMutation(api.posShifts.openShift);
  const closeShift = useMutation(api.posShifts.closeShift);

  const [showOpenForm, setShowOpenForm] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<Id<"posLocations"> | "">("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLocations = useMemo(
    () => (locations ?? []).filter((l) => l.isActive),
    [locations]
  );

  const openShifts = useMemo(
    () => (shifts ?? []).filter((s) => s.status === "open"),
    [shifts]
  );

  const closedShifts = useMemo(
    () => (shifts ?? []).filter((s) => s.status === "closed"),
    [shifts]
  );

  // Which locations already have an open shift
  const openLocationIds = new Set(openShifts.map((s) => s.locationId));

  async function handleOpenShift() {
    if (!club || !selectedLocationId) return;
    setOpening(true);
    setError(null);
    try {
      await openShift({
        clubId:     club._id,
        locationId: selectedLocationId as Id<"posLocations">,
        notes:      openingNotes.trim() || undefined,
      });
      setShowOpenForm(false);
      setSelectedLocationId("");
      setOpeningNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open shift");
    } finally {
      setOpening(false);
    }
  }

  async function handleCloseShift(shiftId: Id<"posShifts">) {
    try {
      await closeShift({ shiftId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close shift");
    }
  }

  if (!club || !locations || !shifts) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const currency = club.currency ?? "GBP";

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/manage/pos" className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">
            ← Point of Sale
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock size={20} /> Shifts
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Open and close service shifts, record stock takes, and view shift reports.
          </p>
        </div>
        {activeLocations.length > 0 && (
          <button
            onClick={() => setShowOpenForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shrink-0"
          >
            <Plus size={15} /> Open shift
          </button>
        )}
      </div>

      {/* Global error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl mb-4">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* No locations warning */}
      {activeLocations.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 mb-6">
          No active locations found.{" "}
          <Link href="/manage/pos/locations" className="font-medium underline">
            Set up a location
          </Link>{" "}
          before opening a shift.
        </div>
      )}

      {/* Open shift form */}
      {showOpenForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Open new shift</h2>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Location <span className="text-red-400">*</span></label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value as Id<"posLocations">)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select location…</option>
              {activeLocations.map((loc) => (
                <option
                  key={loc._id}
                  value={loc._id}
                  disabled={openLocationIds.has(loc._id)}
                >
                  {loc.name}{openLocationIds.has(loc._id) ? " (shift already open)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
            <input
              value={openingNotes}
              onChange={(e) => setOpeningNotes(e.target.value)}
              placeholder="e.g. Evening service, Jamie on bar"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleOpenShift}
              disabled={opening || !selectedLocationId}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {opening ? "Opening…" : "Open shift"}
            </button>
            <button
              onClick={() => { setShowOpenForm(false); setSelectedLocationId(""); setOpeningNotes(""); }}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Open shifts */}
      {openShifts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Open shifts ({openShifts.length})
            </p>
          </div>
          <div className="space-y-3">
            {openShifts.map((shift) => (
              <ShiftCard
                key={shift._id}
                shift={shift}
                currency={currency}
                onClose={handleCloseShift}
                highlight={shift._id === targetShiftId}
              />
            ))}
          </div>
        </div>
      )}

      {/* No shifts at all */}
      {shifts.length === 0 && !showOpenForm && (
        <div className="text-center py-16 text-gray-400">
          <Clock size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No shifts yet.</p>
          {activeLocations.length > 0 && (
            <button
              onClick={() => setShowOpenForm(true)}
              className="mt-2 text-sm text-green-600 hover:underline"
            >
              Open your first shift →
            </button>
          )}
        </div>
      )}

      {/* Closed shifts */}
      {closedShifts.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
            <MapPin size={12} /> Recent closed shifts
          </p>
          <div className="space-y-3">
            {closedShifts.map((shift) => (
              <ShiftCard
                key={shift._id}
                shift={shift}
                currency={currency}
                onClose={handleCloseShift}
                highlight={shift._id === targetShiftId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
