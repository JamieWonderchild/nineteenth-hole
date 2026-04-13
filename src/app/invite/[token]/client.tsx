"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "convex/_generated/api";
import { useClubContext } from "@/lib/club-context";

export default function InvitePageClient({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const router = useRouter();
  const { setSelectedClubId } = useClubContext();
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const result = useQuery(api.invites.getByToken, { token });
  const redeemInvite = useMutation(api.invites.redeem);

  async function handleAccept() {
    if (!user) {
      openSignIn({ afterSignInUrl: `/invite/${token}` } as Parameters<typeof openSignIn>[0]);
      return;
    }
    setRedeeming(true);
    setError(null);
    try {
      const { clubId } = await redeemInvite({ token });
      setSelectedClubId(clubId);
      setDone(true);
      setTimeout(() => router.replace("/manage"), 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRedeeming(false);
    }
  }

  // Loading
  if (result === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Invalid
  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">⛳</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invite not found</h1>
          <p className="text-gray-500 text-sm">This invite link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const { invite, club } = result;
  const isExpired = new Date(invite.expiresAt) < new Date();
  const isUsed = !!invite.usedAt;

  if (isExpired || isUsed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">⏰</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {isUsed ? "Invite already used" : "Invite expired"}
          </h1>
          <p className="text-gray-500 text-sm">
            {isUsed
              ? "This invite link has already been redeemed."
              : "This invite link has expired. Ask a club admin to send a new one."}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-950 to-green-900 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-6 text-4xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;re in!</h1>
          <p className="text-green-300">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-950 to-green-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {/* Club icon */}
        <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-6 text-4xl">
          ⛳
        </div>

        <p className="text-green-300 text-sm font-medium tracking-wide uppercase mb-2">Personal invitation</p>
        <h1 className="text-3xl font-bold text-white mb-2">{club?.name}</h1>
        <p className="text-green-300 text-sm mb-1">Sent to {invite.email}</p>

        <p className="text-green-200 text-base leading-relaxed mt-4 mb-8">
          You&apos;ve been personally invited to join your club on The 19th Hole — competitions, interclub results, tee time booking, and more.
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={redeeming}
          className="w-full bg-white text-green-900 font-semibold text-base py-4 rounded-2xl hover:bg-green-50 transition-colors disabled:opacity-60"
        >
          {redeeming ? "Joining…" : user ? `Join ${club?.name}` : "Sign in to accept"}
        </button>

        {!user && (
          <p className="text-green-400 text-sm mt-4">
            You&apos;ll be asked to sign in or create an account
          </p>
        )}
      </div>
    </div>
  );
}
