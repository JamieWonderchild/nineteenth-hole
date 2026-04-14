"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Zap, ChevronRight, X, Users, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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

function NewGameModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useUser();
  const router = useRouter();
  const createGame = useMutation(api.quickGames.create);

  // Load user's club courses for course picker
  const memberships = useQuery(api.clubMembers.listByUser, user ? { userId: user.id } : "skip");
  const activeMembership = memberships?.find(m => m.status === "active");
  const clubCourses = useQuery(
    api.courses.listByClub,
    activeMembership ? { clubId: activeMembership.clubId } : "skip"
  );

  // Global course search (golfCourses DB)
  const [globalQuery, setGlobalQuery] = useState("");
  const [debouncedGlobalQuery, setDebouncedGlobalQuery] = useState("");
  const [golfCourseId, setGolfCourseId] = useState<string>("");
  const [selectedGlobalCourseName, setSelectedGlobalCourseName] = useState("");
  const [teeId, setTeeId] = useState<string>("");
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [fetchingTees, setFetchingTees] = useState(false);
  const ensureDetail = useAction(api.golfCourses.ensureDetail);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedGlobalQuery(globalQuery), 300);
    return () => clearTimeout(t);
  }, [globalQuery]);

  const globalResults = useQuery(
    api.golfCourses.search,
    debouncedGlobalQuery.length >= 2 ? { query: debouncedGlobalQuery, limit: 8 } : "skip"
  );
  const globalCourseTees = useQuery(
    api.golfCourses.listTees,
    golfCourseId ? { courseId: golfCourseId as never } : "skip"
  );

  const today = new Date().toISOString().split("T")[0];

  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState("stableford");
  const [scoringMode, setScoringMode] = useState<"overall" | "per_hole">("overall");
  const [courseId, setCourseId] = useState<string>("");
  const [teeColour, setTeeColour] = useState<string>("yellow");
  const [date, setDate] = useState(today);
  const [players, setPlayers] = useState([
    { id: generateId(), name: "", handicap: "" },
    { id: generateId(), name: "", handicap: "" },
    { id: generateId(), name: "", handicap: "" },
    { id: generateId(), name: "", handicap: "" },
  ]);
  const [currency, setCurrency] = useState("GBP");
  const [stakeStr, setStakeStr] = useState("5");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sym = CURRENCIES.find(c => c.id === currency)?.symbol ?? "£";
  const stakePerPlayer = Math.round(parseFloat(stakeStr || "0") * 100);
  const filledPlayers = players.filter(p => p.name.trim().length > 0);
  const totalPot = stakePerPlayer * filledPlayers.length;

  function resetAndClose() {
    setStep(1);
    setType("stableford");
    setScoringMode("overall");
    setCourseId("");
    setTeeColour("yellow");
    setGolfCourseId("");
    setTeeId("");
    setGlobalQuery("");
    setDebouncedGlobalQuery("");
    setSelectedGlobalCourseName("");
    setShowGlobalSearch(false);
    setDate(today);
    setPlayers([
      { id: generateId(), name: "", handicap: "" },
      { id: generateId(), name: "", handicap: "" },
      { id: generateId(), name: "", handicap: "" },
      { id: generateId(), name: "", handicap: "" },
    ]);
    setCurrency("GBP");
    setStakeStr("5");
    setName("");
    setError("");
    onClose();
  }

  function addPlayer() {
    setPlayers(prev => [...prev, { id: generateId(), name: "", handicap: "" }]);
  }

  function removePlayer(id: string) {
    setPlayers(prev => prev.filter(p => p.id !== id));
  }

  function updatePlayer(id: string, field: "name" | "handicap", value: string) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  function goToStep2(e: React.FormEvent) {
    e.preventDefault();
    if (filledPlayers.length < 2) {
      setError("Add at least 2 players");
      return;
    }
    setError("");
    setStep(2);
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
        scoringMode,
        courseId: (courseId || undefined) as never,
        teeColour: courseId ? teeColour : undefined,
        golfCourseId: (golfCourseId || undefined) as never,
        teeId: (teeId || undefined) as never,
        players: filledPlayers.map(p => ({
          id: p.id,
          name: p.name.trim(),
          userId: p.name.trim().toLowerCase() === (user.firstName ?? "").toLowerCase() ? user.id : undefined,
          handicap: p.handicap ? parseFloat(p.handicap) : undefined,
        })),
        date,
      });
      resetAndClose();
      router.push(`/games/${gameId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) resetAndClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            {step === 1 ? "New game — Format & Players" : "New game — Stake & Details"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? "Step 1 of 2" : "Step 2 of 2"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <form onSubmit={goToStep2} className="space-y-5 mt-2">
            {/* Game type */}
            <div className="space-y-2">
              <Label>Game format</Label>
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
            </div>

            {/* Scoring mode */}
            <div className="space-y-2">
              <Label>Scoring</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "overall", label: "Overall", desc: "Enter final score after the round" },
                  { id: "per_hole", label: "Per hole", desc: "Enter gross per hole — auto-calculates stableford / net" },
                ] as const).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setScoringMode(m.id)}
                    className={cn(
                      "text-left px-4 py-3 rounded-lg border text-sm transition-all",
                      scoringMode === m.id
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border hover:border-primary/40 hover:bg-accent/50"
                    )}
                  >
                    {m.label}
                    <span className="block text-xs text-muted-foreground font-normal mt-0.5">{m.desc}</span>
                  </button>
                ))}
              </div>

              {/* Course picker — only shown for per-hole mode */}
              {scoringMode === "per_hole" && (
                <div className="mt-2 space-y-3">
                  {/* Club course (fast path) */}
                  {clubCourses && clubCourses.length > 0 && !showGlobalSearch && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Course (optional)</Label>
                        <select
                          value={courseId}
                          onChange={e => { setCourseId(e.target.value); setGolfCourseId(""); setTeeId(""); }}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">No course (manual scores only)</option>
                          {clubCourses.map(c => (
                            <option key={c._id} value={c._id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      {courseId && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Tees</Label>
                          <div className="flex gap-2">
                            {(["white", "yellow", "blue", "red"] as const).map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setTeeColour(t)}
                                className={cn(
                                  "flex-1 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all",
                                  teeColour === t
                                    ? t === "white" ? "border-gray-400 bg-gray-100 text-gray-800"
                                      : t === "yellow" ? "border-yellow-400 bg-yellow-100 text-yellow-800"
                                      : t === "blue" ? "border-blue-400 bg-blue-100 text-blue-800"
                                      : "border-red-400 bg-red-100 text-red-700"
                                    : "border-border hover:border-primary/40"
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { setShowGlobalSearch(true); setCourseId(""); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Playing away? Search all courses →
                      </button>
                    </div>
                  )}

                  {/* Global course search (no club courses, or user chose to search) */}
                  {(showGlobalSearch || !clubCourses || clubCourses.length === 0) && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Search course database</Label>

                      {golfCourseId && teeId ? (
                        // Selected state
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                          <MapPin size={13} className="text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-green-900 truncate">{selectedGlobalCourseName}</p>
                            <p className="text-xs text-green-600">
                              {globalCourseTees?.find(t => t._id === teeId)?.name} tees
                              {globalCourseTees?.find(t => t._id === teeId)?.courseRating
                                ? ` · CR ${globalCourseTees.find(t => t._id === teeId)?.courseRating}`
                                : ""}
                            </p>
                          </div>
                          <button type="button" onClick={() => { setGolfCourseId(""); setTeeId(""); setGlobalQuery(""); setSelectedGlobalCourseName(""); }} className="text-green-600 hover:text-green-800">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Input
                            placeholder="e.g. Finchley Golf Club"
                            value={globalQuery}
                            onChange={e => { setGlobalQuery(e.target.value); setGolfCourseId(""); setTeeId(""); }}
                            className="h-8 text-sm"
                          />
                          {/* Search results */}
                          {globalResults && globalResults.length > 0 && !golfCourseId && (
                            <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
                              {globalResults.map((c: any) => (
                                <button
                                  key={c._id}
                                  type="button"
                                  onClick={() => {
                                    setGolfCourseId(c._id);
                                    setSelectedGlobalCourseName(c.name);
                                    setGlobalQuery(c.name);
                                    setFetchingTees(true);
                                    ensureDetail({ courseId: c._id }).finally(() => setFetchingTees(false));
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-accent/50 text-sm"
                                >
                                  <span className="font-medium">{c.name}</span>
                                  {(c.city || c.county) && (
                                    <span className="text-xs text-muted-foreground ml-1.5">
                                      {[c.city, c.county].filter(Boolean).join(", ")}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Tee picker once course is selected */}
                          {golfCourseId && fetchingTees && (
                            <p className="text-xs text-muted-foreground">Fetching tee data…</p>
                          )}
                          {golfCourseId && !fetchingTees && globalCourseTees && globalCourseTees.length === 0 && (
                            <p className="text-xs text-muted-foreground">No tee data available for this course yet.</p>
                          )}
                          {golfCourseId && !fetchingTees && globalCourseTees && globalCourseTees.length > 0 && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Select tees</Label>
                              <div className="grid grid-cols-2 gap-1.5">
                                {globalCourseTees.map((tee: any) => (
                                  <button
                                    key={tee._id}
                                    type="button"
                                    onClick={() => setTeeId(tee._id)}
                                    className={cn(
                                      "text-left px-2.5 py-2 rounded-lg border text-xs transition-all",
                                      teeId === tee._id
                                        ? "border-primary bg-primary/5 text-primary font-medium"
                                        : "border-border hover:border-primary/40"
                                    )}
                                  >
                                    <span className="font-medium">{tee.name}</span>
                                    {tee.courseRating && (
                                      <span className="block text-muted-foreground font-normal">
                                        CR {tee.courseRating} · S {tee.slopeRating}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {clubCourses && clubCourses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setShowGlobalSearch(false); setGolfCourseId(""); setTeeId(""); setGlobalQuery(""); }}
                          className="text-xs text-primary hover:underline"
                        >
                          ← Use my club's course
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Players */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users size={14} />
                Players
              </Label>
              <div className="space-y-2">
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
                  className="text-muted-foreground"
                >
                  <Plus size={14} className="mr-1.5" />
                  Add player
                </Button>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="modal-game-date">Date</Label>
              <Input
                id="modal-game-date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={resetAndClose}>Cancel</Button>
              <Button type="submit">Next →</Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-5 mt-2">
            {/* Currency */}
            <div className="space-y-2">
              <Label>Currency</Label>
              <div className="grid grid-cols-3 gap-2">
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
            </div>

            {/* Stake */}
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

            {/* Optional name */}
            <div className="space-y-1.5">
              <Label htmlFor="modal-game-name">Name (optional)</Label>
              <Input
                id="modal-game-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={`e.g. Saturday fourball at Finchley`}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => { setStep(1); setError(""); }}>
                ← Back
              </Button>
              <Button type="submit" disabled={loading || filledPlayers.length < 2}>
                {loading ? "Creating…" : `Create game · ${filledPlayers.length} players`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function GamesPage() {
  const { user } = useUser();
  const games = useQuery(api.quickGames.listByUser, user ? { userId: user.id } : "skip");
  const [modalOpen, setModalOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setModalOpen(true);
    }
  }, [searchParams]);

  const active = games?.filter(g => g.status !== "complete") ?? [];
  const completed = games?.filter(g => g.status === "complete") ?? [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <Zap size={22} className="text-amber-500" />
          My Games
        </h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
        >
          <Plus size={16} />
          New game
        </button>
      </div>

      <NewGameModal open={modalOpen} onClose={() => setModalOpen(false)} />

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
          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors inline-block"
          >
            Start your first game
          </button>
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
