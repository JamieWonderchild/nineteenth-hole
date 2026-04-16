"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import type { Id } from "convex/_generated/dataModel";
import {
  MonitorPlay, Package, Terminal, ClipboardList,
  TrendingUp, Banknote, CreditCard, ArrowRight, User,
  Gift, ChevronDown, MapPin, Clock, CalendarDays,
  ShoppingBag, AlertCircle, BarChart3, Layers,
} from "lucide-react";
import Link from "next/link";

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function startOfWeek(d: Date) {
  const day = new Date(d);
  const dow = day.getDay(); // 0 = Sun
  day.setDate(day.getDate() - ((dow + 6) % 7)); // Mon
  return day;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

type Period = "today" | "week" | "month" | "custom";

interface PeriodRange { from: string; to: string; label: string }

function getPeriodRange(period: Period, customFrom: string, customTo: string): PeriodRange {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: toDateStr(now), to: toDateStr(now), label: "Today" };
    case "week":
      return { from: toDateStr(startOfWeek(now)), to: toDateStr(now), label: "This week" };
    case "month":
      return { from: toDateStr(startOfMonth(now)), to: toDateStr(now), label: "This month" };
    case "custom":
      return { from: customFrom, to: customTo, label: "Custom range" };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon, bg,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-4 flex flex-col gap-1.5`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        {icon}
      </div>
      <span className="text-xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  );
}

function NavCard({ href, icon, label, description }: {
  href: string; icon: React.ReactNode; label: string; description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm active:scale-95 transition-all flex flex-col gap-2"
    >
      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </Link>
  );
}

// ── Shift status card ─────────────────────────────────────────────────────────

function ShiftCard({ shift, currency }: {
  shift: {
    _id: Id<"posShifts">;
    status: string;
    locationName: string;
    openedAt: string;
    closedAt?: string;
    openedBy: string;
  };
  currency: string;
}) {
  const isOpen = shift.status === "open";
  const opened = new Date(shift.openedAt);
  const durationMs = (isOpen ? Date.now() : new Date(shift.closedAt!).getTime()) - opened.getTime();
  const hrs  = Math.floor(durationMs / 3_600_000);
  const mins = Math.floor((durationMs % 3_600_000) / 60_000);
  const duration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  const [expanded, setExpanded] = useState(false);
  const report = useQuery(api.posShifts.getShiftReport, { shiftId: shift._id });

  const hasVariance =
    (report?.stockVariance?.length ?? 0) > 0 &&
    report?.hasOpeningStockTake &&
    report?.hasClosingStockTake;

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${isOpen ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={13} className={isOpen ? "text-green-600 shrink-0" : "text-gray-400 shrink-0"} />
          <span className="font-semibold text-gray-900 text-sm truncate">{shift.locationName}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isOpen ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
          }`}>
            {isOpen ? "OPEN" : "CLOSED"}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {report && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-gray-400 hover:text-gray-700 font-medium"
            >
              {expanded ? "Less ↑" : "Details ↓"}
            </button>
          )}
          <Link href="/manage/pos/shifts" className="text-xs text-gray-400 hover:text-gray-600">
            View →
          </Link>
        </div>
      </div>

      {/* Top-line stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-black text-gray-900">
            {report ? formatCurrency(report.summary.totalPence, currency) : "—"}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Revenue</p>
        </div>
        <div>
          <p className="text-lg font-black text-gray-900">{report?.summary.saleCount ?? "—"}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Sales</p>
        </div>
        <div>
          <p className="text-lg font-black text-gray-900">{duration}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{isOpen ? "Elapsed" : "Duration"}</p>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && report && (
        <>
          {/* Payment-method breakdown */}
          <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-black/5">
            {[
              { label: "Cash",    value: report.summary.cashPence,    icon: <Banknote    size={11} className="text-amber-500"  /> },
              { label: "Card",    value: report.summary.cardPence,    icon: <CreditCard  size={11} className="text-blue-500"   /> },
              { label: "Account", value: report.summary.accountPence, icon: <User        size={11} className="text-purple-500" /> },
              { label: "Comp",    value: report.summary.compPence,    icon: <Gift        size={11} className="text-gray-400"   /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center mb-0.5">{icon}</div>
                <p className="text-xs font-bold text-gray-800">{formatCurrency(value, currency)}</p>
                <p className="text-[10px] text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          {/* Stock variance table */}
          {hasVariance && (
            <div className="border-t border-black/5 pt-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Package size={10} /> Stock variance
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 text-[10px]">
                      <th className="text-left py-1 pr-3 font-medium">Product</th>
                      <th className="text-right py-1 px-1 font-medium">Open</th>
                      <th className="text-right py-1 px-1 font-medium">Sold</th>
                      <th className="text-right py-1 px-1 font-medium">Close</th>
                      <th className="text-right py-1 pl-1 font-medium">Var</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.stockVariance.map((row) => {
                      const varColor =
                        row.variance === null  ? "text-gray-400" :
                        row.variance === 0     ? "text-green-600" :
                        Math.abs(row.variance) <= 2 ? "text-amber-500" :
                        "text-red-500";
                      const varLabel =
                        row.variance === null ? "—" :
                        row.variance > 0 ? `+${row.variance}` :
                        String(row.variance);
                      return (
                        <tr key={row.productId} className="border-t border-gray-100">
                          <td className="py-1 pr-3 text-gray-700 font-medium max-w-[120px] truncate">{row.productName}</td>
                          <td className="py-1 px-1 text-right text-gray-500">{row.openCount ?? "—"}</td>
                          <td className="py-1 px-1 text-right text-gray-500">{row.sold}</td>
                          <td className="py-1 px-1 text-right text-gray-500">{row.closeCount ?? "—"}</td>
                          <td className={`py-1 pl-1 text-right font-bold ${varColor}`}>{varLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!report.hasClosingStockTake && (
                <p className="text-[10px] text-amber-500 mt-1.5">No closing stock take yet</p>
              )}
            </div>
          )}

          {/* No stock takes notice */}
          {!report.hasOpeningStockTake && (
            <p className="text-[10px] text-gray-400 border-t border-black/5 pt-2">
              No stock takes recorded for this shift.
            </p>
          )}
        </>
      )}

      {/* Footer */}
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <Clock size={11} />
        Opened {opened.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        {!isOpen && shift.closedAt && (
          <> · Closed {new Date(shift.closedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ManagePOSPage() {
  const { activeMembership, club } = useActiveClub();
  const activeClubId = club?._id ?? null;
  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const router = useRouter();
  const currency = club?.currency ?? "GBP";

  const isAdmin =
    activeMembership?.role === "admin" ||
    activeMembership?.role === "manager" ||
    superAdmin === true;

  useEffect(() => {
    if (activeMembership && superAdmin !== undefined && !isAdmin) {
      router.replace("/pos");
    }
  }, [activeMembership, superAdmin, isAdmin, router]);

  // ── Period & location state ──────────────────────────────────────────────
  const [period, setPeriod]         = useState<Period>("today");
  const [customFrom, setCustomFrom] = useState(toDateStr(new Date()));
  const [customTo, setCustomTo]     = useState(toDateStr(new Date()));
  const [locationId, setLocationId] = useState<Id<"posLocations"> | "">("");

  const { from, to, label } = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  // ── Data queries ─────────────────────────────────────────────────────────
  const locations = useQuery(api.posLocations.listLocations, activeClubId ? { clubId: activeClubId } : "skip");

  const summary = useQuery(
    api.pos.salesRangeSummary,
    activeClubId
      ? {
          clubId:     activeClubId,
          fromDate:   from,
          toDate:     to,
          locationId: locationId ? locationId : undefined,
        }
      : "skip"
  );

  // Flagged stock variances across recent shifts
  const flaggedVariances = useQuery(
    api.posShifts.getFlaggedVariances,
    activeClubId
      ? { clubId: activeClubId, locationId: locationId || undefined }
      : "skip"
  );

  // Active/recent shifts — filtered to selected location when one is chosen
  const shifts = useQuery(
    api.posShifts.listShifts,
    activeClubId
      ? { clubId: activeClubId, locationId: locationId || undefined, limit: 12 }
      : "skip"
  );

  // Show today's open shifts + the most recent closed shift per location
  const activeShifts = useMemo(() => {
    if (!shifts) return [];
    const open   = shifts.filter(s => s.status === "open");
    const closed = shifts.filter(s => s.status === "closed");
    // One closed per location (most recent) — for context
    const seenLoc = new Set<string>();
    const recentClosed = closed.filter(s => {
      if (seenLoc.has(s.locationId as string)) return false;
      seenLoc.add(s.locationId as string);
      return true;
    });
    return [...open, ...recentClosed].slice(0, 6);
  }, [shifts]);

  // Per-location breakdown: enrich byLocation with names
  const locationBreakdown = useMemo(() => {
    if (!summary?.byLocation || !locations) return [];
    return summary.byLocation.map(b => ({
      ...b,
      name: b.locationId === "__none__"
        ? "No location"
        : locations.find(l => l._id === b.locationId)?.name ?? b.locationId,
    })).sort((a, b) => b.totalPence - a.totalPence);
  }, [summary, locations]);

  if (!activeMembership || superAdmin === undefined) return null;
  if (!isAdmin) return null;

  const activeLocations = locations?.filter(l => l.isActive) ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Link
          href="/pos"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold px-5 py-3 rounded-xl shadow transition-all text-sm shrink-0"
        >
          <MonitorPlay className="w-5 h-5" />
          Open till
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* ── Period + location filters ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Period chips */}
        {(["today", "week", "month", "custom"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
              period === p
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            <CalendarDays size={13} />
            {p === "today" ? "Today" : p === "week" ? "This week" : p === "month" ? "This month" : "Custom"}
          </button>
        ))}

        {/* Location filter */}
        {activeLocations.length > 0 && (
          <div className="relative ml-auto">
            <div className="flex items-center gap-1.5 border border-gray-200 rounded-full px-4 py-2 bg-white text-sm text-gray-600">
              <MapPin size={13} className="text-gray-400" />
              <select
                value={locationId}
                onChange={e => setLocationId(e.target.value as Id<"posLocations"> | "")}
                className="appearance-none bg-transparent font-semibold focus:outline-none pr-4 cursor-pointer"
              >
                <option value="">All locations</option>
                {activeLocations.map(l => (
                  <option key={l._id} value={l._id}>{l.name}</option>
                ))}
              </select>
              <ChevronDown size={13} className="text-gray-400 pointer-events-none absolute right-3" />
            </div>
          </div>
        )}
      </div>

      {/* Custom date range picker */}
      {period === "custom" && (
        <div className="flex items-center gap-3 flex-wrap bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
          <span className="text-sm font-medium text-gray-600">From</span>
          <input
            type="date"
            value={customFrom}
            max={customTo}
            onChange={e => setCustomFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-gray-600">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom}
            max={toDateStr(new Date())}
            onChange={e => setCustomTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-xs text-gray-400 ml-1">
            {from === to ? from : `${from} → ${to}`}
          </span>
        </div>
      )}

      {/* ── Revenue summary ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <BarChart3 size={13} /> Revenue — {label}
          {locationId && activeLocations.length > 0 && (
            <span className="text-green-600 font-bold">
              · {activeLocations.find(l => l._id === locationId)?.name}
            </span>
          )}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <SummaryCard
            label="Total revenue"
            value={summary ? formatCurrency(summary.totalRevenue, currency) : "—"}
            sub={summary ? `${summary.count} sale${summary.count !== 1 ? "s" : ""}` : undefined}
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            bg="bg-emerald-50"
          />
          <SummaryCard
            label="Cash"
            value={summary ? formatCurrency(summary.cashRevenue, currency) : "—"}
            icon={<Banknote className="w-5 h-5 text-amber-500" />}
            bg="bg-amber-50"
          />
          <SummaryCard
            label="Card / terminal"
            value={summary ? formatCurrency(summary.cardRevenue, currency) : "—"}
            icon={<CreditCard className="w-5 h-5 text-blue-500" />}
            bg="bg-blue-50"
          />
          <SummaryCard
            label="Member account"
            value={summary ? formatCurrency(summary.accountRevenue, currency) : "—"}
            icon={<User className="w-5 h-5 text-purple-500" />}
            bg="bg-purple-50"
          />
          <SummaryCard
            label="Complimentary"
            value={summary ? formatCurrency(summary.compRevenue, currency) : "—"}
            icon={<Gift className="w-5 h-5 text-gray-400" />}
            bg="bg-gray-50"
          />
        </div>
      </div>

      {/* ── Per-location breakdown (only shown when no location filter active) ── */}
      {!locationId && locationBreakdown.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Layers size={13} /> By location — {label}
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Location</th>
                  <th className="px-5 py-3 text-right font-medium">Sales</th>
                  <th className="px-5 py-3 text-right font-medium">Revenue</th>
                  <th className="px-5 py-3 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {locationBreakdown.map((loc, i) => {
                  const share = summary?.totalRevenue
                    ? Math.round((loc.totalPence / summary.totalRevenue) * 100)
                    : 0;
                  return (
                    <tr key={loc.locationId} className={`${i < locationBreakdown.length - 1 ? "border-b border-gray-50" : ""} hover:bg-gray-50/50`}>
                      <td className="px-5 py-3 font-medium text-gray-900 flex items-center gap-2">
                        <MapPin size={13} className="text-gray-400 shrink-0" />
                        {loc.name}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-500">{loc.count}</td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900">{formatCurrency(loc.totalPence, currency)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-gray-400 text-xs w-8 text-right">{share}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Flagged stock variances ─────────────────────────────────────── */}
      {flaggedVariances && flaggedVariances.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <AlertCircle size={13} className="text-red-400" /> Stock variances
            {locationId && activeLocations.length > 0 && (
              <span className="text-green-600 font-bold">
                · {activeLocations.find(l => l._id === locationId)?.name}
              </span>
            )}
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Product</th>
                  <th className="px-5 py-3 text-left font-medium">Location</th>
                  <th className="px-5 py-3 text-left font-medium">Shift</th>
                  <th className="px-5 py-3 text-right font-medium">Open</th>
                  <th className="px-5 py-3 text-right font-medium">Sold</th>
                  <th className="px-5 py-3 text-right font-medium">Close</th>
                  <th className="px-5 py-3 text-right font-medium">Variance</th>
                </tr>
              </thead>
              <tbody>
                {flaggedVariances.map((row, i) => {
                  const isShrinkage = row.variance < 0;
                  const varLabel = row.variance > 0 ? `+${row.variance}` : String(row.variance);
                  const shiftDate = new Date(row.shiftOpenedAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short",
                  });
                  return (
                    <tr
                      key={`${row.shiftId}-${row.productId}`}
                      className={`${i < flaggedVariances.length - 1 ? "border-b border-gray-50" : ""} hover:bg-gray-50/50`}
                    >
                      <td className="px-5 py-3 font-medium text-gray-900">{row.productName}</td>
                      <td className="px-5 py-3 text-gray-500 flex items-center gap-1.5">
                        <MapPin size={11} className="text-gray-400 shrink-0" />
                        {row.locationName}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{shiftDate}</td>
                      <td className="px-5 py-3 text-right text-gray-500">{row.openCount ?? "—"}</td>
                      <td className="px-5 py-3 text-right text-gray-500">{row.sold}</td>
                      <td className="px-5 py-3 text-right text-gray-500">{row.closeCount ?? "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                          isShrinkage
                            ? "bg-red-50 text-red-600"
                            : "bg-amber-50 text-amber-600"
                        }`}>
                          {varLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 pl-1">
            Red = shrinkage (stock consumed without a sale) · Amber = over-ring (more sales than stock consumed)
          </p>
        </div>
      )}

      {/* ── Active & recent shifts ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag size={13} /> Shifts
            {locationId && activeLocations.length > 0 && (
              <span className="text-green-600 font-bold">
                · {activeLocations.find(l => l._id === locationId)?.name}
              </span>
            )}
          </h2>
          <Link href="/manage/pos/shifts" className="text-xs text-gray-400 hover:text-gray-700 font-medium">
            View all →
          </Link>
        </div>

        {/* No shifts at all */}
        {shifts !== undefined && activeShifts.length === 0 && (
          <div className="flex items-center gap-2 text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
            <AlertCircle size={15} className="shrink-0 text-gray-400" />
            No shifts found. Open a till to start tracking sales by shift.
          </div>
        )}

        {/* Warning if shifts exist but none are open */}
        {activeShifts.length > 0 && activeShifts.every(s => s.status !== "open") && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 text-sm">
            <AlertCircle size={15} className="shrink-0" />
            No shifts are currently open. Sales made outside a shift won&apos;t be included in shift reports.
          </div>
        )}

        {activeShifts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeShifts.map(shift => (
              <ShiftCard key={shift._id} shift={shift} currency={currency} />
            ))}
          </div>
        )}
      </div>

      {/* ── Quick links ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Manage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NavCard
            href="/manage/pos/products"
            icon={<Package className="w-6 h-6 text-gray-600" />}
            label="Products & categories"
            description="Prices, stock, categories"
          />
          <NavCard
            href="/manage/pos/locations"
            icon={<MapPin className="w-6 h-6 text-gray-600" />}
            label="Locations"
            description="Bar, pro shop, etc."
          />
          <NavCard
            href="/manage/pos/terminals"
            icon={<Terminal className="w-6 h-6 text-gray-600" />}
            label="Terminals"
            description="Register card machines"
          />
          <NavCard
            href="/manage/pos/sales"
            icon={<ClipboardList className="w-6 h-6 text-gray-600" />}
            label="Sales log"
            description="History & refunds"
          />
        </div>
      </div>
    </div>
  );
}
