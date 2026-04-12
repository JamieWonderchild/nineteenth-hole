"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useMemo, useState } from "react";
import { useActiveClub } from "@/lib/club-context";
import { formatCurrency } from "@/lib/format";
import { TrendingUp, TrendingDown, Users, CalendarDays, ShoppingCart, Clock } from "lucide-react";

type Period = "7d" | "30d" | "90d" | "all";

function periodLabel(p: Period) {
  return { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", all: "All time" }[p];
}

function periodStart(p: Period): string {
  if (p === "all") return "2000-01-01";
  const d = new Date();
  d.setDate(d.getDate() - (p === "7d" ? 7 : p === "30d" ? 30 : 90));
  return d.toISOString().slice(0, 10);
}

function prevPeriodStart(p: Period): string {
  if (p === "all") return "2000-01-01";
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days * 2);
  return d.toISOString().slice(0, 10);
}

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const { club } = useActiveClub();

  const sales = useQuery(api.pos.listSales, club ? { clubId: club._id, limit: 1000 } : "skip");
  const members = useQuery(api.clubMembers.listByClub, club ? { clubId: club._id } : "skip");
  const competitions = useQuery(api.competitions.listByClub, club ? { clubId: club._id } : "skip");
  const visitors = useQuery(api.visitors.listByClub, club ? { clubId: club._id, limit: 500 } : "skip");
  const bookings = useQuery(api.teeTimes.listAllBookings, club ? { clubId: club._id } : "skip");

  const currency = club?.currency ?? "GBP";

  const stats = useMemo(() => {
    if (!sales || !members || !competitions || !visitors || !bookings) return null;

    const from = periodStart(period);
    const prevFrom = prevPeriodStart(period);
    const prevTo = periodStart(period);

    // POS revenue
    const validSales = sales.filter(s => !s.voidedAt);
    const periodSales = validSales.filter(s => s.createdAt.slice(0, 10) >= from);
    const prevSales = validSales.filter(s => {
      const d = s.createdAt.slice(0, 10);
      return d >= prevFrom && d < prevTo;
    });
    const posRevenue = periodSales.reduce((s, sale) => s + sale.totalPence, 0);
    const prevPosRevenue = prevSales.reduce((s, sale) => s + sale.totalPence, 0);

    // Visitor green fees
    const periodVisitors = visitors.filter(v => v.date >= from && v.paidAt);
    const prevVisitors = visitors.filter(v => {
      return v.date >= prevFrom && v.date < prevTo && v.paidAt;
    });
    const greenFeeRevenue = periodVisitors.reduce((s, v) => s + (v.greenFee ?? 0), 0);
    const prevGreenFees = prevVisitors.reduce((s, v) => s + (v.greenFee ?? 0), 0);

    // Members
    const newMembers = members.filter(m => m.joinedAt.slice(0, 10) >= from).length;
    const prevNewMembers = members.filter(m => {
      const d = m.joinedAt.slice(0, 10);
      return d >= prevFrom && d < prevTo;
    }).length;

    // Competitions
    const periodComps = competitions.filter(c => c.startDate.slice(0, 10) >= from);
    const prevComps = competitions.filter(c => {
      const d = c.startDate.slice(0, 10);
      return d >= prevFrom && d < prevTo;
    });

    // Tee time players
    const periodBookings = bookings.filter(b => b.date >= from);
    const prevBookings = bookings.filter(b => b.date >= prevFrom && b.date < prevTo);
    const teeTimePlayers = periodBookings.reduce((s, b) => s + b.playerCount, 0);
    const prevTeeTimePlayers = prevBookings.reduce((s, b) => s + b.playerCount, 0);

    // Daily revenue chart (last 30 or 7 days)
    const chartDays = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 90;
    const dailyRevenue: { date: string; pence: number }[] = [];
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayTotal = validSales
        .filter(s => s.createdAt.slice(0, 10) === dateStr)
        .reduce((s, sale) => s + sale.totalPence, 0);
      dailyRevenue.push({ date: dateStr, pence: dayTotal });
    }

    // Monthly member growth (all time)
    const membersByMonth: Record<string, number> = {};
    const sortedMembers = [...members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    let running = 0;
    const monthSet = new Set<string>();
    sortedMembers.forEach(m => {
      const month = m.joinedAt.slice(0, 7);
      monthSet.add(month);
    });
    const months = [...monthSet].sort();
    const monthlyGrowth = months.map(month => {
      const newThisMonth = sortedMembers.filter(m => m.joinedAt.slice(0, 7) === month).length;
      running += newThisMonth;
      return { month, total: running, newMembers: newThisMonth };
    });

    // Top products
    const productRevenue: Record<string, { name: string; units: number; pence: number }> = {};
    periodSales.forEach(sale => {
      sale.items.forEach(item => {
        const key = item.productName;
        if (!productRevenue[key]) productRevenue[key] = { name: key, units: 0, pence: 0 };
        productRevenue[key].units += item.quantity;
        productRevenue[key].pence += item.subtotalPence;
      });
    });
    const topProducts = Object.values(productRevenue)
      .sort((a, b) => b.pence - a.pence)
      .slice(0, 8);

    // Revenue by payment method
    const byMethod: Record<string, number> = {};
    periodSales.forEach(s => {
      byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] ?? 0) + s.totalPence;
    });

    // Recent competitions with entry-adjacent data
    const recentComps = [...competitions]
      .filter(c => c.status === "complete" || c.status === "live")
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .slice(0, 6);

    return {
      posRevenue, prevPosRevenue,
      greenFeeRevenue, prevGreenFees,
      newMembers, prevNewMembers, totalMembers: members.length,
      periodComps: periodComps.length, prevComps: prevComps.length,
      teeTimePlayers, prevTeeTimePlayers,
      dailyRevenue,
      monthlyGrowth,
      topProducts,
      byMethod,
      recentComps,
      totalRevenue: posRevenue + greenFeeRevenue,
      prevTotalRevenue: prevPosRevenue + prevGreenFees,
    };
  }, [sales, members, competitions, visitors, bookings, period]);

  if (!club || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const maxDaily = Math.max(...stats.dailyRevenue.map(d => d.pence), 1);
  const maxMonthly = Math.max(...stats.monthlyGrowth.map(d => d.total), 1);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">{club.name}</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
          {(["7d", "30d", "90d", "all"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === p
                  ? "bg-green-700 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {p === "all" ? "All time" : p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<ShoppingCart size={16} />}
          label="Total revenue"
          value={formatCurrency(stats.totalRevenue, currency)}
          sub={`POS + green fees · ${periodLabel(period)}`}
          change={pct(stats.totalRevenue, stats.prevTotalRevenue)}
          color="green"
        />
        <KpiCard
          icon={<Users size={16} />}
          label="Members"
          value={String(stats.totalMembers)}
          sub={stats.newMembers > 0 ? `+${stats.newMembers} joined this period` : "No new joins"}
          change={pct(stats.newMembers, stats.prevNewMembers)}
          color="blue"
        />
        <KpiCard
          icon={<CalendarDays size={16} />}
          label="Competitions"
          value={String(stats.periodComps)}
          sub={`Started · ${periodLabel(period)}`}
          change={pct(stats.periodComps, stats.prevComps)}
          color="purple"
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="Tee time players"
          value={String(stats.teeTimePlayers)}
          sub={`Confirmed slots · ${periodLabel(period)}`}
          change={pct(stats.teeTimePlayers, stats.prevTeeTimePlayers)}
          color="orange"
        />
      </div>

      {/* Revenue chart */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Daily POS revenue</h2>
            <p className="text-sm text-gray-400 mt-0.5">{periodLabel(period)}</p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">{formatCurrency(stats.posRevenue, currency)}</div>
            <Trend change={pct(stats.posRevenue, stats.prevPosRevenue)} />
          </div>
        </div>

        {stats.dailyRevenue.every(d => d.pence === 0) ? (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
            No POS sales in this period
          </div>
        ) : (
          <div className="flex items-end gap-[2px] h-32">
            {stats.dailyRevenue.map(day => {
              const h = Math.round((day.pence / maxDaily) * 100);
              const isToday = day.date === new Date().toISOString().slice(0, 10);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      {new Date(day.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      <br />{formatCurrency(day.pence, currency)}
                    </div>
                  </div>
                  <div
                    className={`w-full rounded-sm transition-all ${isToday ? "bg-green-600" : day.pence > 0 ? "bg-green-300 hover:bg-green-500" : "bg-gray-100"}`}
                    style={{ height: `${Math.max(h, day.pence > 0 ? 4 : 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Payment method breakdown */}
        {Object.keys(stats.byMethod).length > 0 && (
          <div className="mt-5 pt-5 border-t border-gray-100 flex flex-wrap gap-4">
            {Object.entries(stats.byMethod)
              .sort(([, a], [, b]) => b - a)
              .map(([method, pence]) => (
                <div key={method} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${methodColor(method)}`} />
                  <span className="text-sm text-gray-600 capitalize">{method}</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(pence, currency)}</span>
                </div>
              ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member growth */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Member growth</h2>
          <p className="text-sm text-gray-400 mb-6">Cumulative active members over time</p>

          {stats.monthlyGrowth.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No member data yet</div>
          ) : (
            <div className="flex items-end gap-1 h-28">
              {stats.monthlyGrowth.slice(-12).map(m => {
                const h = Math.round((m.total / maxMonthly) * 100);
                const label = new Date(m.month + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                      <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        {label}<br />{m.total} members (+{m.newMembers})
                      </div>
                    </div>
                    <div
                      className="w-full rounded-sm bg-blue-200 hover:bg-blue-400 transition-all"
                      style={{ height: `${Math.max(h, 4)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="text-xl font-bold text-gray-900">{stats.totalMembers}</div>
              <div className="text-xs text-gray-500">Total members</div>
            </div>
            <div className="bg-green-50 rounded-lg px-3 py-2">
              <div className="text-xl font-bold text-green-800">+{stats.newMembers}</div>
              <div className="text-xs text-gray-500">Joined this period</div>
            </div>
          </div>
        </section>

        {/* Top products */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Top selling products</h2>
          <p className="text-sm text-gray-400 mb-4">{periodLabel(period)}</p>

          {stats.topProducts.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No sales in this period</div>
          ) : (
            <div className="space-y-2.5">
              {stats.topProducts.map((product, i) => {
                const maxPence = stats.topProducts[0].pence;
                const barWidth = Math.round((product.pence / maxPence) * 100);
                return (
                  <div key={product.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 truncate max-w-[60%]">
                        <span className="text-gray-400 mr-1.5">{i + 1}.</span>
                        {product.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{product.units} sold</span>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(product.pence, currency)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Recent competitions */}
      {stats.recentComps.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Recent competitions</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 text-left text-xs text-gray-400">
                <th className="px-6 py-3 font-medium">Competition</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Format</th>
                <th className="px-6 py-3 font-medium text-right">Entry fee</th>
                <th className="px-6 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentComps.map(comp => (
                <tr key={comp._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-6 py-3.5 font-medium text-gray-900">{comp.name}</td>
                  <td className="px-6 py-3.5 text-gray-500">
                    {new Date(comp.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-3.5 text-gray-500 capitalize">{comp.scoringFormat ?? comp.type}</td>
                  <td className="px-6 py-3.5 text-right text-gray-700 font-medium">{formatCurrency(comp.entryFee, comp.currency)}</td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      comp.status === "live" ? "bg-green-100 text-green-700" :
                      comp.status === "complete" ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {comp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Green fee revenue callout */}
      {stats.greenFeeRevenue > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-900">Green fee revenue — {periodLabel(period)}</p>
            <p className="text-xs text-green-700 mt-0.5">{stats.periodComps > 0 ? `${visitors?.filter(v => v.date >= periodStart(period)).length ?? 0} visitors logged` : "Visitors tracked via the platform"}</p>
          </div>
          <div className="text-2xl font-bold text-green-800">{formatCurrency(stats.greenFeeRevenue, currency)}</div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, change, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; change: number;
  color: "green" | "blue" | "purple" | "orange";
}) {
  const colors = {
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900 mb-0.5">{value}</div>
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400 truncate">{sub}</span>
        <Trend change={change} small />
      </div>
    </div>
  );
}

function Trend({ change, small }: { change: number; small?: boolean }) {
  if (change === 0) return null;
  const up = change > 0;
  return (
    <span className={`flex items-center gap-0.5 font-semibold shrink-0 ${small ? "text-xs" : "text-sm"} ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? <TrendingUp size={small ? 11 : 14} /> : <TrendingDown size={small ? 11 : 14} />}
      {Math.abs(change)}%
    </span>
  );
}

function methodColor(method: string) {
  const map: Record<string, string> = {
    cash: "bg-green-400",
    card: "bg-blue-400",
    terminal: "bg-blue-600",
    tab: "bg-yellow-400",
    complimentary: "bg-gray-300",
  };
  return map[method] ?? "bg-gray-400";
}
