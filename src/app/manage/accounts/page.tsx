"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { Search, Wallet, TrendingUp, TrendingDown, Plus, ChevronLeft, X, RefreshCw } from "lucide-react";

type Member = {
  _id: Id<"clubMembers">;
  displayName: string;
  fgcMemberId?: string;
  accountBalance: number;
};

type Transaction = {
  _id: Id<"memberAccountTransactions">;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
};

const TOP_UP_PRESETS = [500, 1000, 2000, 5000]; // pence

function TransactionRow({ tx, currency }: { tx: Transaction; currency: string }) {
  const isCredit = tx.amount > 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        isCredit ? "bg-green-100" : "bg-red-50"
      }`}>
        {isCredit
          ? <TrendingUp size={13} className="text-green-600" />
          : <TrendingDown size={13} className="text-red-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
        <p className="text-xs text-gray-400">
          {new Date(tx.createdAt).toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold ${isCredit ? "text-green-600" : "text-red-500"}`}>
          {isCredit ? "+" : ""}{formatCurrency(tx.amount, currency)}
        </p>
        <p className="text-xs text-gray-400">bal {formatCurrency(tx.balanceAfter, currency)}</p>
      </div>
    </div>
  );
}

function MemberDetail({
  member,
  currency,
  onClose,
}: {
  member: Member;
  currency: string;
  onClose: () => void;
}) {
  const transactions = useQuery(api.memberAccounts.listTransactions, {
    memberId: member._id,
    limit: 50,
  });
  const topUp = useMutation(api.memberAccounts.topUp);

  const [amount, setAmount] = useState<number | null>(null);
  const [customStr, setCustomStr] = useState("");
  const [description, setDescription] = useState("Account top-up");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const penceToCharge = amount ?? (customStr ? Math.round(parseFloat(customStr) * 100) : 0);

  async function handleTopUp() {
    if (!penceToCharge || penceToCharge <= 0) return;
    setSaving(true);
    setError("");
    try {
      await topUp({ memberId: member._id, amount: penceToCharge, description: description || "Account top-up" });
      setAmount(null);
      setCustomStr("");
      setDescription("Account top-up");
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 truncate">{member.displayName}</p>
          {member.fgcMemberId && <p className="text-xs text-gray-400">{member.fgcMemberId}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">Balance</p>
          <p className={`text-lg font-bold ${member.accountBalance < 0 ? "text-red-500" : "text-gray-900"}`}>
            {formatCurrency(member.accountBalance, currency)}
          </p>
        </div>
      </div>

      {/* Top-up panel */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top Up Account</p>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {TOP_UP_PRESETS.map(p => (
            <button
              key={p}
              onClick={() => { setAmount(p); setCustomStr(""); }}
              className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${
                amount === p
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-white border-gray-200 text-gray-700 hover:border-green-400"
              }`}
            >
              {formatCurrency(p, currency)}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={customStr}
              onChange={e => { setCustomStr(e.target.value); setAmount(null); }}
              placeholder="Custom amount"
              className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Description */}
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

        <button
          onClick={handleTopUp}
          disabled={saving || penceToCharge <= 0}
          className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          <Plus size={15} />
          {saving ? "Processing…" : `Top up ${penceToCharge > 0 ? formatCurrency(penceToCharge, currency) : ""}`}
        </button>
      </div>

      {/* Transaction history */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Transaction History</p>
        {!transactions ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-5 w-5 border-2 border-green-600 border-t-transparent rounded-full" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No transactions yet</p>
        ) : (
          transactions.map(tx => (
            <TransactionRow key={tx._id} tx={tx as Transaction} currency={currency} />
          ))
        )}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const { user } = useUser();
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const club = useQuery(api.clubs.get, activeMembership ? { clubId: activeMembership.clubId } : "skip");
  const members = useQuery(api.memberAccounts.listBalances, club ? { clubId: club._id } : "skip");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);

  const currency = club?.currency ?? "GBP";

  const filtered = (members ?? []).filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.displayName.toLowerCase().includes(q) ||
      (m.fgcMemberId?.toLowerCase().includes(q) ?? false)
    );
  });

  const totalBalances = (members ?? []).reduce((s, m) => s + m.accountBalance, 0);

  if (!club || !members) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // If a member is selected, show the detail panel
  if (selected) {
    // Refresh the selected member's balance from the live list
    const live = members.find(m => m._id === selected._id);
    const memberToShow = live ?? selected;

    return (
      <div className="max-w-lg mx-auto h-[calc(100vh-3rem)] md:h-screen flex flex-col">
        <MemberDetail
          member={memberToShow as Member}
          currency={currency}
          onClose={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Member Accounts</h1>
        <p className="text-sm text-gray-500 mt-1">Top up pre-paid balances and view transaction history</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{members.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Balances</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalBalances, currency)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:block hidden">
          <p className="text-xs text-gray-400 uppercase tracking-wide">With Balance</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {members.filter(m => m.accountBalance > 0).length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or membership number…"
          className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Member list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{search ? "No members match your search" : "No members yet"}</p>
          </div>
        ) : (
          <ul>
            {filtered.map((member, i) => (
              <li key={member._id}>
                <button
                  onClick={() => setSelected(member as Member)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {member.displayName[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{member.displayName}</p>
                    {member.fgcMemberId && (
                      <p className="text-xs text-gray-400">{member.fgcMemberId}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${
                      member.accountBalance < 0 ? "text-red-500" : member.accountBalance === 0 ? "text-gray-400" : "text-green-700"
                    }`}>
                      {formatCurrency(member.accountBalance, currency)}
                    </p>
                    <p className="text-xs text-gray-400">balance</p>
                  </div>
                </button>
                {i < filtered.length - 1 && <div className="border-b border-gray-100 mx-4" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
