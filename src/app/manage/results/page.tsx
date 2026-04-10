"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const STATUS_ORDER: Record<string, number> = { live: 0, open: 1, draft: 2, complete: 3 };

export default function ResultsPage() {
  const { user } = useUser();

  const memberships = useQuery(
    api.clubMembers.listByUser,
    user ? { userId: user.id } : "skip"
  );
  const activeMembership = memberships?.find(m => m.status === "active");
  const isAdmin = activeMembership?.role === "admin";
  const club = useQuery(
    api.clubs.get,
    activeMembership ? { clubId: activeMembership.clubId } : "skip"
  );
  const competitions = useQuery(
    api.competitions.listByClub,
    club ? { clubId: club._id } : "skip"
  );

  const sorted = [...(competitions ?? [])].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
  );

  if (!club || !competitions) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competitions</h1>
          <p className="text-gray-500 text-sm mt-0.5">All competitions at {club.name}</p>
        </div>
        {isAdmin && (
          <Link
            href="/manage/competitions/new"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus size={15} />
            New competition
          </Link>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <Trophy size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 mb-3">No competitions yet</p>
          {isAdmin && (
            <Link href="/manage/competitions/new" className="text-green-700 font-medium text-sm hover:underline">
              Create your first competition →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map(comp => (
            <CompetitionResult
              key={comp._id}
              competition={comp}
              currency={club.currency}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CompetitionResult({
  competition,
  currency,
}: {
  competition: {
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
    entryFee: number;
    status: string;
    prizeStructure: Array<{ position: number; percentage: number }>;
    type: string;
  };
  currency: string;
}) {
  const entries = useQuery(api.entries.listByCompetition, {
    competitionId: competition._id as any,
  });

  const paidEntries = entries?.filter(e => e.paidAt) ?? [];
  const pot = paidEntries.length * competition.entryFee;
  const winner = entries?.find(e => e.leaderboardPosition === 1);
  const topPrizePercent = competition.prizeStructure[0]?.percentage ?? 100;
  const topPrize = Math.round(pot * topPrizePercent / 100);

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-500",
    open: "bg-blue-100 text-blue-700",
    live: "bg-green-100 text-green-700",
    complete: "bg-purple-100 text-purple-700",
  };
  const statusLabel: Record<string, string> = {
    draft: "Draft",
    open: "Open",
    live: "In progress",
    complete: "Complete",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{competition.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[competition.status] ?? "bg-gray-100 text-gray-600"}`}>
              {statusLabel[competition.status] ?? competition.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {new Date(competition.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            {" – "}
            {new Date(competition.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <Link
          href={`/manage/competitions/${competition._id}`}
          className="text-sm text-green-700 hover:underline shrink-0"
        >
          Manage →
        </Link>
      </div>

      <div className="border-t border-gray-100 px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <Stat label="Entrants" value={String(paidEntries.length)} />
        <Stat label="Pot" value={formatCurrency(pot, currency)} />
        <Stat label="Top prize" value={formatCurrency(topPrize, currency)} />
        <Stat label="Entry fee" value={formatCurrency(competition.entryFee, currency)} />
      </div>

      {winner && (
        <div className="border-t border-gray-100 px-5 py-3 bg-green-50 flex items-center gap-2 text-sm">
          <span className="text-lg">🏆</span>
          <span className="font-medium text-gray-900">{winner.displayName}</span>
          <span className="text-gray-500">won</span>
          <span className="font-semibold text-green-700">{formatCurrency(topPrize, currency)}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="font-semibold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
