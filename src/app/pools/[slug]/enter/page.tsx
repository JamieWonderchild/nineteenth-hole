"use client";

import { useState } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";
import { use } from "react";

export default function EnterPoolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useUser();

  const pool = useQuery(api.competitions.getByPlatformSlug, { slug });
  const myEntry = useQuery(
    api.entries.getByCompetitionAndUser,
    pool && user ? { competitionId: pool._id, userId: user.id } : "skip"
  );

  const createEntry = useMutation(api.entries.create);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (pool === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">⛳</div>
          <p className="text-xl font-semibold text-gray-900">Pool not found</p>
          <Link href="/pools" className="text-green-700 hover:underline mt-2 block">← Back to pools</Link>
        </div>
      </div>
    );
  }

  if (pool.status !== "open") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-4xl mb-4">🚫</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Entries are closed</h1>
          <p className="text-gray-500 mb-6">This pool is no longer accepting entries.</p>
          <Link href={`/pools/${slug}`} className="text-green-700 hover:underline">← View pool</Link>
        </div>
      </div>
    );
  }

  if (myEntry?.paidAt) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re in!</h1>
          <p className="text-gray-500 mb-6">Your entry is confirmed. Good luck!</p>
          <Link href={`/pools/${slug}`} className="text-green-700 font-medium hover:underline">
            View pool →
          </Link>
        </div>
      </div>
    );
  }

  async function handleEnter() {
    if (!user || !pool) return;
    setLoading(true);
    setError("");
    try {
      const entryId = await createEntry({
        competitionId: pool._id,
        userId: user.id,
        displayName: user.fullName ?? user.username ?? user.emailAddresses[0]?.emailAddress ?? "Player",
      });

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: pool._id,
          entryId,
          poolSlug: slug,
          isPlatformPool: true,
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

  const totalWithFee = pool.entryFee + Math.round(pool.entryFee * 0.1);

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🏌️</div>
          <h1 className="text-xl font-bold text-gray-900">{pool.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Platform-wide pool — anyone can enter</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Entry fee (to pot)</span>
            <span className="font-semibold text-gray-900">{formatCurrency(pool.entryFee, pool.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Platform fee (10%)</span>
            <span className="text-gray-700">{formatCurrency(Math.round(pool.entryFee * 0.1), pool.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 mt-1">
            <span className="font-semibold text-gray-700">You pay</span>
            <span className="font-bold text-gray-900">{formatCurrency(totalWithFee, pool.currency)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 pt-1">
            <span>Draw type</span>
            <span className="capitalize">{pool.drawType} · {pool.tierCount} tiers</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Entry deadline</span>
            <span>
              {new Date(pool.entryDeadline).toLocaleDateString("en-GB", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
              })}
            </span>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-4 text-center">
          You&apos;ll be assigned one player per tier after the entry deadline. Your best player determines your position.
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
              {loading ? "Setting up payment…" : `Enter for ${formatCurrency(totalWithFee, pool.currency)}`}
            </button>
          </>
        )}

        <Link href={`/pools/${slug}`} className="block mt-3 text-center text-sm text-gray-400 hover:text-gray-600">
          ← Back to pool
        </Link>
      </div>
    </div>
  );
}
