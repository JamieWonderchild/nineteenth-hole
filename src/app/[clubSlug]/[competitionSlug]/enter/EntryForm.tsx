"use client";

import { useState } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useClubCtx } from "@/app/providers/club-context-provider";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Props {
  clubSlug: string;
  competitionSlug: string;
}

export function EntryForm({ clubSlug, competitionSlug }: Props) {
  const { user } = useUser();
  const { club } = useClubCtx();

  const competition = useQuery(
    api.competitions.getBySlug,
    club ? { clubId: club._id, slug: competitionSlug } : "skip"
  );
  const myEntries = useQuery(
    api.entries.listByCompetitionAndUser,
    competition && user ? { competitionId: competition._id, userId: user.id } : "skip"
  );
  const players = useQuery(
    api.players.listByCompetition,
    competition ? { competitionId: competition._id } : "skip"
  );

  const createEntry = useMutation(api.entries.create);
  const enterFree = useMutation(api.entries.enterFree);
  const ensureMember = useMutation(api.clubMembers.ensureMember);

  // Pick format state
  const [picks, setPicks] = useState<Id<"players">[]>([]);
  const [reserve, setReserve] = useState<Id<"players"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!club || !competition || myEntries === undefined) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  }

  if (competition.status !== "open") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl mb-4">🚫</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Entries are closed</h1>
          <p className="text-gray-500 mb-6">This competition is no longer accepting entries.</p>
          <Link href={`/${clubSlug}/${competitionSlug}`} className="text-green-700 hover:underline">← View leaderboard</Link>
        </div>
      </div>
    );
  }

  const isPickFormat = competition.drawType === "pick";
  const pickCount = competition.pickCount ?? 5;
  const reserveCount = competition.reserveCount ?? 1;
  const paidEntries = myEntries.filter(e => e.paidAt);

  // ── Standard draw entry ─────────────────────────────────────────────────────
  if (!isPickFormat) {
    const myEntry = myEntries[0];
    const isCash = competition.paymentCollection === "cash";

    if (myEntry?.paidAt) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-5xl mb-4">✅</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re in!</h1>
            <p className="text-gray-500 mb-6">Your entry has been confirmed. Good luck!</p>
            <Link href={`/${clubSlug}/${competitionSlug}`} className="text-green-700 font-medium hover:underline">View leaderboard →</Link>
          </div>
        </div>
      );
    }

    if (myEntry && !myEntry.paidAt && isCash) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-5xl mb-4">🤝</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re registered!</h1>
            <p className="text-gray-500 mb-2">
              Pay <strong>{formatCurrency(competition.entryFee, competition.currency)}</strong> cash to the organiser to confirm your place.
            </p>
            <p className="text-sm text-gray-400 mb-6">You&apos;ll be included in the draw once marked as paid.</p>
            <Link href={`/${clubSlug}/${competitionSlug}`} className="text-green-700 font-medium hover:underline">Back to pool →</Link>
          </div>
        </div>
      );
    }

    async function handleCashEnter() {
      if (!user || !club || !competition) return;
      setLoading(true);
      setError("");
      try {
        await ensureMember({ clubId: club._id, userId: user.id, displayName: user.fullName ?? user.username ?? user.emailAddresses[0]?.emailAddress ?? "Member", avatarUrl: user.imageUrl });
        await enterFree({ competitionId: competition._id, clubId: club._id, userId: user.id, displayName: user.fullName ?? user.username ?? "Member" });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    async function handleDrawEnter() {
      if (!user || !club || !competition) return;
      setLoading(true);
      setError("");
      try {
        await ensureMember({ clubId: club._id, userId: user.id, displayName: user.fullName ?? user.username ?? user.emailAddresses[0]?.emailAddress ?? "Member", avatarUrl: user.imageUrl });
        const entryId = await createEntry({ competitionId: competition._id, clubId: club._id, userId: user.id, displayName: user.fullName ?? user.username ?? "Member" });
        const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competitionId: competition._id, entryId, clubSlug: club.slug, competitionSlug: competition.slug }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Payment failed");
        window.location.href = data.url;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setLoading(false);
      }
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🏌️</div>
            <h1 className="text-xl font-bold text-gray-900">{competition.name}</h1>
            <p className="text-gray-500 text-sm mt-1">{club.name}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Entry fee</span><span className="font-semibold text-gray-900">{formatCurrency(competition.entryFee, competition.currency)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Draw type</span><span className="text-gray-700 capitalize">{competition.drawType}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Players drawn</span><span className="text-gray-700">{competition.tierCount} (one per tier)</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Entry deadline</span><span className="text-gray-700">{new Date(competition.entryDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
            {isCash && (
              <div className="flex justify-between"><span className="text-gray-500">Payment</span><span className="text-gray-700">Cash to organiser</span></div>
            )}
          </div>
          {isCash ? (
            <p className="text-xs text-gray-400 mb-4 text-center">
              Register your interest now. Pay {formatCurrency(competition.entryFee, competition.currency)} cash to the organiser — you&apos;ll be in the draw once marked as paid.
            </p>
          ) : (
            <p className="text-xs text-gray-400 mb-4 text-center">You&apos;ll be randomly assigned one player from each tier after the entry deadline.</p>
          )}
          {!user ? (
            <SignInButton mode="modal"><button className="w-full px-5 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors">Sign in to enter</button></SignInButton>
          ) : (
            <>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">{error}</p>}
              {isCash ? (
                <button onClick={handleCashEnter} disabled={loading} className="w-full px-5 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors">
                  {loading ? "Registering…" : "Register interest"}
                </button>
              ) : (
                <button onClick={handleDrawEnter} disabled={loading} className="w-full px-5 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors">
                  {loading ? "Setting up payment…" : `Enter for ${formatCurrency(competition.entryFee, competition.currency)}`}
                </button>
              )}
            </>
          )}
          <Link href={`/${clubSlug}/${competitionSlug}`} className="block mt-3 text-center text-sm text-gray-400 hover:text-gray-600">← Back to pool</Link>
        </div>
      </div>
    );
  }

  // ── Pick Your Team entry ─────────────────────────────────────────────────────
  if (!players) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  }

  const sortedPlayers = [...players].sort((a, b) => (a.worldRanking ?? 999) - (b.worldRanking ?? 999));
  const picksComplete = picks.length === pickCount;
  const reserveComplete = reserveCount === 0 || reserve !== null;
  const canSubmit = picksComplete && reserveComplete;

  function togglePick(playerId: Id<"players">) {
    if (picks.includes(playerId)) {
      setPicks(p => p.filter(id => id !== playerId));
      if (reserve === playerId) setReserve(null);
    } else if (picks.length < pickCount) {
      setPicks(p => [...p, playerId]);
    }
  }

  function toggleReserve(playerId: Id<"players">) {
    if (!picks.includes(playerId) && picks.length < pickCount) return; // must be a main pick or extra
    setReserve(r => r === playerId ? null : playerId);
  }

  async function handlePickEnter() {
    if (!user || !club || !competition || !canSubmit) return;
    setLoading(true);
    setError("");
    try {
      await ensureMember({ clubId: club._id, userId: user.id, displayName: user.fullName ?? user.username ?? user.emailAddresses[0]?.emailAddress ?? "Member", avatarUrl: user.imageUrl });
      const entryId = await createEntry({
        competitionId: competition._id,
        clubId: club._id,
        userId: user.id,
        displayName: user.fullName ?? user.username ?? "Member",
        drawnPlayerIds: picks,
        reservePlayerIds: reserve ? [reserve] : [],
        allowMultiple: true,
      });
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competitionId: competition._id, entryId, clubSlug: club.slug, competitionSlug: competition.slug }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-green-900 text-white px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="text-xs text-green-400 mb-0.5">⛳ {club.name}</div>
          <h1 className="font-bold text-xl">{competition.name}</h1>
          <p className="text-green-300 text-sm mt-1">
            Pick {pickCount} golfers + {reserveCount} reserve · {formatCurrency(competition.entryFee, competition.currency)} per team · multiple teams allowed
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Progress */}
        <div className="flex gap-4">
          <div className={cn("flex-1 rounded-xl p-4 text-center border", picksComplete ? "bg-green-50 border-green-300" : "bg-white border-gray-200")}>
            <div className={cn("text-2xl font-bold", picksComplete ? "text-green-700" : "text-gray-400")}>
              {picks.length}/{pickCount}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Picks selected</div>
          </div>
          <div className={cn("flex-1 rounded-xl p-4 text-center border", reserveComplete ? "bg-green-50 border-green-300" : "bg-white border-gray-200")}>
            <div className={cn("text-2xl font-bold", reserveComplete ? "text-green-700" : "text-gray-400")}>
              {reserve ? "1" : "0"}/{reserveCount}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Reserve selected</div>
          </div>
          {paidEntries.length > 0 && (
            <div className="flex-1 rounded-xl p-4 text-center border bg-amber-50 border-amber-200">
              <div className="text-2xl font-bold text-amber-700">{paidEntries.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Team{paidEntries.length === 1 ? "" : "s"} entered</div>
            </div>
          )}
        </div>

        {/* Rules reminder */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          <strong>Rules:</strong> Whoever&apos;s golfers have the most accumulated prize money on Sunday night wins.
          Reserve only counts if two teams pick the exact same 5 players.
        </div>

        {/* My picks so far */}
        {picks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your picks</p>
            <div className="flex flex-wrap gap-2">
              {picks.map(pid => {
                const p = players.find(pl => pl._id === pid);
                if (!p) return null;
                return (
                  <span key={pid} className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-sm font-medium px-3 py-1.5 rounded-full">
                    {p.name}
                    {reserve === pid && <span className="text-xs text-green-600">(R)</span>}
                    <button onClick={() => togglePick(pid)} className="ml-0.5 text-green-600 hover:text-green-900 leading-none">×</button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructions for reserve */}
        {picksComplete && !reserveComplete && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Now tap one of your picks to designate them as your <strong>reserve</strong> (tiebreaker).
          </div>
        )}

        {/* Player grid */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {picksComplete ? "Tap a pick to set as reserve" : `Select ${pickCount - picks.length} more golfer${pickCount - picks.length === 1 ? "" : "s"}`}
          </p>
          <div className="space-y-1">
            {sortedPlayers.map(player => {
              const isPicked = picks.includes(player._id);
              const isReserve = reserve === player._id;
              const isDisabled = !isPicked && picks.length >= pickCount;

              return (
                <button
                  key={player._id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isPicked && picksComplete) {
                      // Toggle reserve
                      toggleReserve(player._id);
                    } else {
                      togglePick(player._id);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                    isReserve
                      ? "border-amber-400 bg-amber-50"
                      : isPicked
                        ? "border-green-400 bg-green-50"
                        : isDisabled
                          ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                          : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/40"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold",
                    isReserve
                      ? "border-amber-500 bg-amber-500 text-white"
                      : isPicked
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-gray-300"
                  )}>
                    {isReserve ? "R" : isPicked ? "✓" : ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn("font-medium text-sm", isPicked ? "text-gray-900" : "text-gray-700")}>
                      {player.name}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">{player.country}</span>
                  </div>
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded shrink-0",
                    player.tier === 1 ? "bg-amber-100 text-amber-700" :
                    player.tier === 2 ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-500"
                  )}>
                    #{player.worldRanking}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 safe-area-inset-bottom">
        <div className="max-w-2xl mx-auto">
          {!user ? (
            <SignInButton mode="modal">
              <button className="w-full px-5 py-3.5 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors">
                Sign in to enter
              </button>
            </SignInButton>
          ) : (
            <>
              {error && <p className="text-sm text-red-600 mb-2 text-center">{error}</p>}
              <button
                onClick={handlePickEnter}
                disabled={!canSubmit || loading}
                className="w-full px-5 py-3.5 bg-green-700 text-white font-semibold rounded-xl hover:bg-green-600 disabled:bg-gray-300 transition-colors"
              >
                {loading ? "Setting up payment…" : !canSubmit
                  ? picks.length < pickCount
                    ? `Pick ${pickCount - picks.length} more golfer${pickCount - picks.length === 1 ? "" : "s"}`
                    : "Choose a reserve"
                  : `Pay ${formatCurrency(competition.entryFee, competition.currency)} — confirm ${pickCount} picks`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
