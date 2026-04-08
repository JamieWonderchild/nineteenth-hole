"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const createClub = useMutation(api.clubs.create);

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const slug = slugify(name);

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
    <div className="min-h-screen bg-green-950 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⛳</div>
          <h1 className="text-2xl font-bold text-gray-900">Create your club</h1>
          <p className="text-gray-500 mt-1 text-sm">
            You can run unlimited competitions once your club is set up.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Club name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sunningdale GC, Jamie's Masters Pool"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {name && (
              <p className="text-xs text-gray-400 mt-1">
                URL: the19th.golf/<span className="font-mono text-green-700">{slug}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
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
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
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
