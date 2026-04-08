"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Plus, X, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const GAME_TYPES = [
  { id: "stableford", label: "Stableford", desc: "Highest points wins", icon: "📊" },
  { id: "strokeplay", label: "Strokeplay", desc: "Lowest gross score wins", icon: "⛳" },
  { id: "betterball", label: "Betterball", desc: "Pairs — best ball counts", icon: "👥" },
  { id: "nassau", label: "Nassau", desc: "Three bets: front, back, overall", icon: "💰" },
  { id: "skins", label: "Skins", desc: "Win each hole outright", icon: "🏆" },
];

const CURRENCIES = [
  { id: "GBP", symbol: "£", label: "GBP" },
  { id: "EUR", symbol: "€", label: "EUR" },
  { id: "USD", symbol: "$", label: "USD" },
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function NewGamePage() {
  const router = useRouter();
  const { user } = useUser();
  const createGame = useMutation(api.quickGames.create);

  const today = new Date().toISOString().split("T")[0];

  const [name, setName] = useState("");
  const [type, setType] = useState("stableford");
  const [currency, setCurrency] = useState("GBP");
  const [stakeStr, setStakeStr] = useState("5");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [players, setPlayers] = useState([
    { id: generateId(), name: user?.firstName ?? "", handicap: "" },
    { id: generateId(), name: "", handicap: "" },
    { id: generateId(), name: "", handicap: "" },
    { id: generateId(), name: "", handicap: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sym = CURRENCIES.find(c => c.id === currency)?.symbol ?? "£";
  const stakePerPlayer = Math.round(parseFloat(stakeStr || "0") * 100);
  const filledPlayers = players.filter(p => p.name.trim().length > 0);
  const totalPot = stakePerPlayer * filledPlayers.length;

  function addPlayer() {
    setPlayers(prev => [...prev, { id: generateId(), name: "", handicap: "" }]);
  }

  function removePlayer(id: string) {
    setPlayers(prev => prev.filter(p => p.id !== id));
  }

  function updatePlayer(id: string, field: "name" | "handicap", value: string) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (filledPlayers.length < 2) {
      setError("Add at least 2 players");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const gameId = await createGame({
        name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} — ${new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        type,
        currency,
        stakePerPlayer,
        settlementType: "cash",
        players: filledPlayers.map(p => ({
          id: p.id,
          name: p.name.trim(),
          userId: p.name.trim().toLowerCase() === (user.firstName ?? "").toLowerCase() ? user.id : undefined,
          handicap: p.handicap ? parseFloat(p.handicap) : undefined,
        })),
        date,
        notes: notes || undefined,
      });
      router.push(`/games/${gameId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Zap size={18} className="text-amber-500" />
            New Quick Game
          </h1>
          <p className="text-sm text-muted-foreground">Set up an informal round with friends</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="space-y-5">

        {/* Game type */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Game format</CardTitle>
            <CardDescription>How you&apos;re playing today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GAME_TYPES.map(gt => (
                <button
                  key={gt.id}
                  type="button"
                  onClick={() => setType(gt.id)}
                  className={cn(
                    "text-left px-4 py-3 rounded-lg border text-sm transition-all",
                    type === gt.id
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border hover:border-primary/40 hover:bg-accent/50"
                  )}
                >
                  <span className="mr-2">{gt.icon}</span>
                  {gt.label}
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">{gt.desc}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Players */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10"><Users size={16} className="text-primary" /></div>
              <div>
                <CardTitle className="text-base">Players</CardTitle>
                <CardDescription>Who&apos;s playing — add handicaps for net scoring</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {players.map((player, i) => (
              <div key={player.id} className="flex items-center gap-2">
                <div className="w-6 text-center text-xs text-muted-foreground shrink-0">{i + 1}</div>
                <Input
                  value={player.name}
                  onChange={e => updatePlayer(player.id, "name", e.target.value)}
                  placeholder={i === 0 ? "Your name" : `Player ${i + 1}`}
                  className="flex-1"
                />
                <Input
                  value={player.handicap}
                  onChange={e => updatePlayer(player.id, "handicap", e.target.value)}
                  placeholder="HCP"
                  type="number"
                  min="0"
                  max="54"
                  step="0.1"
                  className="w-20 shrink-0"
                />
                {players.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removePlayer(player.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addPlayer}
              className="mt-2 text-muted-foreground"
            >
              <Plus size={14} className="mr-1.5" />
              Add player
            </Button>
          </CardContent>
        </Card>

        {/* Stake & date */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Stake & date</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {CURRENCIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCurrency(c.id)}
                  className={cn(
                    "py-2 rounded-lg border text-sm font-medium transition-all",
                    currency === c.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  {c.symbol} {c.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Stake per player ({sym})</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{sym}</span>
                <Input
                  type="number"
                  value={stakeStr}
                  onChange={e => setStakeStr(e.target.value)}
                  min="0"
                  step="1"
                  className="pl-7"
                  placeholder="0 for fun only"
                />
              </div>
              {stakePerPlayer > 0 && filledPlayers.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Total pot: {sym}{(totalPot / 100).toFixed(0)} · Winner takes all (or split)
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="game-date">Date</Label>
              <Input
                id="game-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="game-name">Name (optional)</Label>
              <Input
                id="game-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={`e.g. Saturday fourball at Finchley`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="game-notes">Notes (optional)</Label>
              <Input
                id="game-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any special rules, conditions, etc."
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || filledPlayers.length < 2}
          className="w-full"
          size="lg"
        >
          {loading ? "Creating…" : `Create game · ${filledPlayers.length} players`}
        </Button>
      </form>
    </div>
  );
}
