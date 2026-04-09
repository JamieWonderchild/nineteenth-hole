"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const createClub = useMutation(api.clubs.create);

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const slug = slugify(name);

  // Non-super-admins shouldn't be here — redirect to home
  if (superAdmin === false) {
    router.replace("/home");
    return null;
  }

  if (superAdmin === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      await createClub({
        name,
        slug,
        currency,
        userId: user.id,
        displayName: user.fullName ?? user.username ?? "Admin",
      });
      router.push("/manage");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create a club</h1>
        <p className="text-gray-500 mt-1 text-sm">Set up a new golf club on the platform.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Club name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Finchley Golf Club"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {name && (
              <p className="text-xs text-gray-400 mt-1">
                URL: playthepool.golf/<span className="font-mono text-green-700">{slug}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="GBP">£ GBP</option>
              <option value="EUR">€ EUR</option>
              <option value="USD">$ USD</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !name}
            className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? "Creating…" : "Create club →"}
          </button>
        </form>
      </div>
    </div>
  );
}
