"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "convex/_generated/api";
import { use } from "react";

export default function ClubPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  const ensureMember = useMutation(api.clubMembers.ensureMember);

  const club = useQuery(api.clubs.getBySlug, { slug: clubSlug });
  const membership = useQuery(
    api.clubMembers.getByClubAndUser,
    club && user ? { clubId: club._id, userId: user.id } : "skip"
  );
  const membersList = useQuery(
    api.clubMembers.listByClub,
    club ? { clubId: club._id } : "skip"
  );

  // Active members get the full dashboard
  useEffect(() => {
    if (membership?.status === "active") {
      router.replace("/manage");
    }
  }, [membership, router]);

  async function handleJoin() {
    if (!user) { openSignIn(); return; }
    if (!club) return;
    setJoining(true);
    try {
      await ensureMember({
        clubId: club._id,
        userId: user.id,
        displayName: user.fullName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? "Member",
        avatarUrl: user.imageUrl ?? undefined,
      });
      setJoined(true);
    } finally {
      setJoining(false);
    }
  }

  if (club === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">⛳</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Club not found</h1>
          <p className="text-gray-500 text-sm">This club doesn&apos;t exist or may have moved.</p>
        </div>
      </div>
    );
  }

  // Pending state
  if (membership?.status === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5 text-2xl">⏳</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Request pending</h1>
          <p className="text-gray-500 text-sm">Your request to join <strong>{club.name}</strong> has been received. An admin will approve you shortly.</p>
        </div>
      </div>
    );
  }

  // Non-member (or not signed in) — focused invite acceptance screen
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-950 to-green-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {/* Club icon */}
        <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-6 text-4xl">
          ⛳
        </div>

        {/* Invite label */}
        <p className="text-green-300 text-sm font-medium tracking-wide uppercase mb-2">You&apos;ve been invited</p>

        {/* Club name */}
        <h1 className="text-3xl font-bold text-white mb-3">{club.name}</h1>

        {/* Welcome message */}
        <p className="text-green-200 text-base leading-relaxed mb-8">
          Join your club on The 19th Hole — access competitions, interclub results, tee time booking, and more.
        </p>

        {/* CTA */}
        {joined ? (
          <div className="bg-white/10 border border-white/20 rounded-2xl px-6 py-4 text-center">
            <div className="text-2xl mb-2">✓</div>
            <p className="text-white font-semibold">Request sent!</p>
            <p className="text-green-300 text-sm mt-1">An admin will approve you shortly.</p>
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full bg-white text-green-900 font-semibold text-base py-4 rounded-2xl hover:bg-green-50 transition-colors disabled:opacity-60"
          >
            {joining ? "Joining…" : `Join ${club.name}`}
          </button>
        )}

        {/* Member count hint */}
        {membersList && membersList.length > 0 && !joined && (
          <p className="text-green-400 text-sm mt-5">
            {membersList.length} member{membersList.length !== 1 ? "s" : ""} already on the platform
          </p>
        )}
      </div>
    </div>
  );
}
