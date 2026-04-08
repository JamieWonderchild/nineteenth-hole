"use client";

import { useState } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useClubCtx } from "@/app/providers/club-context-provider";
import { api } from "convex/_generated/api";
import { formatCurrency } from "@/lib/format";
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
  const myEntry = useQuery(
    api.entries.getByCompetitionAndUser,
    competition && user ? { competitionId: competition._id, userId: user.id } : "skip"
  );

  const createEntry = useMutation(api.entries.create);
  const ensureMember = useMutation(api.clubMembers.ensureMember);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!club || !competition) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" /></div>;
  }

  if (competition.status !== "open") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl mb-4">🚫</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Entries are closed</h1>
          <p className="text-gray-500 mb-6">This competition is no longer accepting entries.</p>
          <Link href={`/${clubSlug}/${competitionSlug}`} className="text-green-700 hover:underline">
            ← View leaderboard
          </Link>
        </div>
      </div>
    );
  }

  // Already entered and paid
  if (myEntry?.paidAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">You're in!</h1>
          <p className="text-gray-500 mb-6">Your entry has been confirmed. Good luck!</p>
          <Link href={`/${clubSlug}/${competitionSlug}`} className="text-green-700 font-medium hover:underline">
            View leaderboard →
          </Link>
        </div>
      </div>
    );
  }

  // Entered but awaiting payment
  if (myEntry && !myEntry.paidAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow p-8 w-full max-w-sm text-center">
          <p className="text-4xl mb-4">⏳</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Awaiting payment</h1>
          <p className="text-gray-500 text-sm mb-6">
            Your entry is reserved. Complete payment to confirm your spot.
          </p>
          <a
            href={myEntry.stripeCheckoutSessionId ? "#" : "#"}
            className="block w-full px-5 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
          >
            Complete payment — {formatCurrency(competition.entryFee, competition.currency)}
          </a>
          <Link href={`/${clubSlug}/${competitionSlug}`} className="block mt-3 text-sm text-gray-400 hover:text-gray-600">
            Back to leaderboard
          </Link>
        </div>
      </div>
    );
  }

  async function handleEnter() {
    if (!user || !club || !competition) return;
    setLoading(true);
    setError("");
    try {
      // Ensure user is a club member
      await ensureMember({
        clubId: club._id,
        userId: user.id,
        displayName: user.fullName ?? user.username ?? user.emailAddresses[0]?.emailAddress ?? "Member",
        avatarUrl: user.imageUrl,
      });

      // Create entry record
      const entryId = await createEntry({
        competitionId: competition._id,
        clubId: club._id,
        userId: user.id,
        displayName: user.fullName ?? user.username ?? "Member",
      });

      // Create Stripe Checkout session
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: competition._id,
          entryId,
          clubSlug: club.slug,
          competitionSlug: competition.slug,
        }),
      });
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
          <div className="flex justify-between">
            <span className="text-gray-500">Entry fee</span>
            <span className="font-semibold text-gray-900">{formatCurrency(competition.entryFee, competition.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Draw type</span>
            <span className="text-gray-700 capitalize">{competition.drawType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Players drawn</span>
            <span className="text-gray-700">{competition.tierCount} (one per tier)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Entry deadline</span>
            <span className="text-gray-700">
              {new Date(competition.entryDeadline).toLocaleDateString("en-GB", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
              })}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-4 text-center">
          You'll be randomly assigned one player from each tier after the entry deadline.
          Your best-performing player determines your position.
        </p>

        {!user ? (
          <SignInButton mode="modal">
            <button className="w-full px-5 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors">
              Sign in to enter
            </button>
          </SignInButton>
        ) : (
          <>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">
                {error}
              </p>
            )}
            <button
              onClick={handleEnter}
              disabled={loading}
              className="w-full px-5 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors"
            >
              {loading ? "Setting up payment…" : `Enter for ${formatCurrency(competition.entryFee, competition.currency)}`}
            </button>
          </>
        )}

        <Link href={`/${clubSlug}/${competitionSlug}`} className="block mt-3 text-center text-sm text-gray-400 hover:text-gray-600">
          ← Back to pool
        </Link>
      </div>
    </div>
  );
}
