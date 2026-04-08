"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { Plus, Zap, ChevronRight } from "lucide-react";

export default function GamesPage() {
  const { user } = useUser();
  const games = useQuery(api.quickGames.listByUser, user ? { userId: user.id } : "skip");

  const active = games?.filter(g => g.status !== "complete") ?? [];
  const completed = games?.filter(g => g.status === "complete") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <Zap size={22} className="text-amber-500" />
          My Games
        </h1>
        <Link
          href="/games/new"
          className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
        >
          <Plus size={16} />
          New game
        </Link>
      </div>

      {games === undefined ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-xl">
          <div className="text-4xl mb-3">⛳</div>
          <p className="text-gray-500 mb-4">No games yet</p>
          <Link
            href="/games/new"
            className="px-5 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors inline-block"
          >
            Start your first game
          </Link>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">In Progress</h2>
              <div className="space-y-2">
                {active.map(game => <GameCard key={game._id} game={game} />)}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Completed</h2>
              <div className="space-y-2">
                {completed.map(game => <GameCard key={game._id} game={game} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

type Game = {
  _id: string;
  name: string;
  type: string;
  status: string;
  date: string;
  players: { id: string; name: string }[];
  stakePerPlayer: number;
  currency: string;
  result?: { summary: string } | null;
};

function GameCard({ game }: { game: Game }) {
  const sym = game.currency === "GBP" ? "£" : game.currency === "EUR" ? "€" : "$";
  return (
    <Link
      href={`/games/${game._id}`}
      className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-green-400 transition-colors"
    >
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-gray-900">{game.name}</span>
          {game.status === "complete" && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Complete</span>
          )}
          {game.status !== "complete" && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Active</span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {game.type.charAt(0).toUpperCase() + game.type.slice(1)}
          {" · "}
          {game.players.length} players
          {game.stakePerPlayer > 0 && ` · ${sym}${(game.stakePerPlayer / 100).toFixed(0)}/player`}
          {" · "}
          {new Date(game.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
        {game.result?.summary && (
          <p className="text-sm text-green-700 font-medium mt-0.5">{game.result.summary}</p>
        )}
      </div>
      <ChevronRight size={16} className="text-gray-400 shrink-0" />
    </Link>
  );
}
