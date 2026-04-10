"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { formatCurrency } from "@/lib/format";
import { ArrowLeft, TrendingUp, Banknote, CreditCard, X } from "lucide-react";
import Link from "next/link";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  tab: "Tab",
  terminal: "Terminal",
  complimentary: "Comp",
};

export default function POSSalesPage() {
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");

  const sales = useQuery(api.pos.listSales, club ? { clubId: club._id } : "skip");
  const summary = useQuery(api.pos.salesSummary, club ? { clubId: club._id } : "skip");
  const voidSale = useMutation(api.pos.voidSale);

  const [dateFilter, setDateFilter] = useState("");

  if (!club || !sales || !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const filtered = sales.filter(s =>
    !s.voidedAt &&
    (!dateFilter || s.createdAt.startsWith(dateFilter))
  );
  const voided = sales.filter(s => s.voidedAt && (!dateFilter || s.createdAt.startsWith(dateFilter)));

  const filteredTotal = filtered.reduce((s, sale) => s + sale.totalPence, 0);
  const currency = club.currency;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/manage/pos" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Log</h1>
          <p className="text-gray-500 text-sm mt-0.5">Revenue history and transaction records</p>
        </div>
      </div>

      {/* Summary stats (all time) */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total revenue", value: formatCurrency(summary.totalRevenue, currency), icon: <TrendingUp size={16} className="text-green-600" /> },
          { label: "Cash takings", value: formatCurrency(summary.cashRevenue, currency), icon: <Banknote size={16} className="text-green-600" /> },
          { label: "Card / terminal", value: formatCurrency(summary.cardRevenue, currency), icon: <CreditCard size={16} className="text-green-600" /> },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              {s.icon}
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-green-800">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        {dateFilter && (
          <>
            <span className="text-sm text-gray-500">
              {filtered.length} sale{filtered.length !== 1 ? "s" : ""} · {formatCurrency(filteredTotal, currency)}
            </span>
            <button onClick={() => setDateFilter("")} className="text-sm text-gray-400 hover:text-gray-700">
              Clear
            </button>
          </>
        )}
      </div>

      {/* Sales table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <TrendingUp size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No sales recorded yet</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium hidden sm:table-cell">Method</th>
                <th className="px-5 py-3 font-medium text-right">Total</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(sale => (
                <tr key={sale._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(sale.createdAt).toLocaleString("en-GB", {
                      day: "numeric", month: "short",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="space-y-0.5">
                      {sale.items.map((item, i) => (
                        <p key={i} className="text-gray-700 text-xs">
                          {item.quantity}× {item.productName}
                        </p>
                      ))}
                    </div>
                    {sale.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{sale.notes}</p>}
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">
                    {formatCurrency(sale.totalPence, sale.currency)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => { if (confirm("Void this sale?")) voidSale({ saleId: sale._id }); }}
                      className="text-gray-200 hover:text-red-400 transition-colors"
                      title="Void sale"
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

      {/* Voided sales (collapsed) */}
      {voided.length > 0 && (
        <details className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <summary className="px-5 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
            {voided.length} voided sale{voided.length !== 1 ? "s" : ""}
          </summary>
          <table className="w-full text-sm">
            <tbody>
              {voided.map(sale => (
                <tr key={sale._id} className="border-t border-gray-50 opacity-50">
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Date(sale.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500 line-through">
                    {sale.items.map(i => `${i.quantity}× ${i.productName}`).join(", ")}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-gray-400 line-through">
                    {formatCurrency(sale.totalPence, sale.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
