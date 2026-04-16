"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Search, MapPin, Check, ChevronRight } from "lucide-react";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type GolfClub = {
  _id: Id<"golfClubs">;
  name: string;
  county: string;
  postcode?: string;
  englandGolfId?: string;
  platformClubId?: Id<"clubs">;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const superAdmin = useQuery(api.clubs.isSuperAdmin);
  const createClub = useMutation(api.clubs.create);
  const seedGolfClubs = useMutation(api.golfClubs.seed);

  // Step 1 — find the club in the directory
  const [step, setStep] = useState<"search" | "configure">("search");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<GolfClub[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedClub, setSelectedClub] = useState<GolfClub | null>(null);

  // Step 2 — configure platform details
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const slug = slugify(name);

  // We need to search via a query — use the search query reactively
  const searchQueryResults = useQuery(
    api.golfClubs.search,
    searchTerm.length >= 2 ? { term: searchTerm } : "skip"
  ) as GolfClub[] | undefined;

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

  function handleSelectClub(club: GolfClub) {
    setSelectedClub(club);
    setName(club.name);
    setStep("configure");
  }

  function handleSkipSearch() {
    setSelectedClub(null);
    setStep("configure");
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
        county: selectedClub?.county,
        englandGolfId: selectedClub?.englandGolfId,
        golfClubId: selectedClub?._id,
      });
      router.push("/manage");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function handleSeed() {
    try {
      const result = await seedGolfClubs({});
      alert(JSON.stringify(result));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Seed failed");
    }
  }

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === "search" ? "bg-green-600 text-white" : "bg-green-100 text-green-700"}`}>
            {step === "configure" ? <Check size={12} /> : "1"}
          </div>
          <div className="flex-1 h-0.5 bg-gray-100 rounded" />
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === "configure" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-400"}`}>
            2
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">
          {step === "search" ? "Find your club" : "Configure your club"}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {step === "search"
            ? "Search the England Golf directory to identify your club."
            : selectedClub
              ? `Setting up ${selectedClub.name}`
              : "Set up your club on the platform."}
        </p>
      </div>

      {step === "search" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="e.g. Finchley Golf Club"
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {searchTerm.length >= 2 && searchQueryResults !== undefined && (
              <div className="space-y-1">
                {searchQueryResults.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No clubs found for "{searchTerm}"</p>
                ) : (
                  searchQueryResults.map(club => (
                    <button
                      key={club._id}
                      onClick={() => handleSelectClub(club)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-50 hover:border-green-200 border border-transparent transition-colors text-left"
                    >
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                        <MapPin size={14} className="text-green-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{club.name}</p>
                        <p className="text-xs text-gray-400">
                          {club.county}{club.postcode ? ` · ${club.postcode}` : ""}
                          {club.platformClubId ? " · Already on platform" : ""}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}

            {searchTerm.length < 2 && (
              <p className="text-xs text-gray-400 text-center">Type at least 2 characters to search</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <button
            onClick={handleSkipSearch}
            className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Skip — set up manually
          </button>

          {/* Dev helper — seeds the directory */}
          <button
            onClick={handleSeed}
            className="w-full py-2 text-xs text-gray-300 hover:text-gray-500 transition-colors"
          >
            Seed golf club directory
          </button>
        </div>
      )}

      {step === "configure" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {selectedClub && (
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
              <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                <MapPin size={15} className="text-green-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedClub.name}</p>
                <p className="text-xs text-gray-400">{selectedClub.county}{selectedClub.postcode ? ` · ${selectedClub.postcode}` : ""}</p>
              </div>
              <button
                onClick={() => { setStep("search"); setSelectedClub(null); setName(""); }}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600"
              >
                Change
              </button>
            </div>
          )}

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
      )}
    </div>
  );
}
