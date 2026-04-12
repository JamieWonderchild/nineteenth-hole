"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveClub } from "@/lib/club-context";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import {
  MonitorPlay, Package, Terminal, Tag, ClipboardList,
  TrendingUp, Banknote, CreditCard, ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function ManagePOSPage() {
  const { selectedClubId: activeClubId, activeMembership } = useActiveClub();
  const { user } = useUser();
  const router = useRouter();

  const superAdmin = user?.publicMetadata?.superAdmin as boolean | undefined;
  const isAdmin =
    activeMembership?.role === "admin" ||
    activeMembership?.role === "manager" ||
    superAdmin === true;

  // Staff with no management rights go straight to the till
  useEffect(() => {
    if (activeMembership && !isAdmin) {
      router.replace("/pos");
    }
  }, [activeMembership, isAdmin, router]);

  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const summary = useQuery(
    api.pos.salesSummary,
    activeClubId ? { clubId: activeClubId, date: today } : "skip"
  );

  if (!activeClubId || !activeMembership) return null;
  if (!isAdmin) return null; // will redirect

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Point of Sale</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* Open Till */}
        <Link
          href="/pos"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95
                     text-white font-semibold px-5 py-3 rounded-xl shadow transition-all text-sm"
        >
          <MonitorPlay className="w-5 h-5" />
          Open till
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Today's summary */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Today
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Transactions"
            value={summary ? String(summary.count) : "—"}
            icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
            bg="bg-indigo-50"
          />
          <SummaryCard
            label="Total revenue"
            value={summary ? formatCurrency(summary.totalRevenue, "GBP") : "—"}
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            bg="bg-emerald-50"
          />
          <SummaryCard
            label="Cash"
            value={summary ? formatCurrency(summary.cashRevenue, "GBP") : "—"}
            icon={<Banknote className="w-5 h-5 text-amber-500" />}
            bg="bg-amber-50"
          />
          <SummaryCard
            label="Card / terminal"
            value={summary ? formatCurrency(summary.cardRevenue, "GBP") : "—"}
            icon={<CreditCard className="w-5 h-5 text-blue-500" />}
            bg="bg-blue-50"
          />
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Manage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NavCard
            href="/manage/pos/products"
            icon={<Package className="w-6 h-6 text-gray-600" />}
            label="Products"
            description="Prices, stock, visibility"
          />
          <NavCard
            href="/manage/pos/categories"
            icon={<Tag className="w-6 h-6 text-gray-600" />}
            label="Categories"
            description="Organise the menu"
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  bg,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        {icon}
      </div>
      <span className="text-xl font-bold text-gray-900">{value}</span>
    </div>
  );
}

function NavCard({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300
                 hover:shadow-sm active:scale-95 transition-all flex flex-col gap-2"
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
