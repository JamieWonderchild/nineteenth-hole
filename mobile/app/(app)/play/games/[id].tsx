import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../lib/convex";
import { Badge, Button, Card, LoadingSpinner, ScoreChip } from "../../../../components/ui";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  name: string;
  handicap?: number;
}

interface HoleScore {
  hole: number;
  gross: number;
}

interface PlayerScore {
  playerId: string;
  gross?: number;
  net?: number;
  points?: number;
  holeScores?: HoleScore[];
}

interface Game {
  _id: string;
  name: string;
  type: string;
  date: string;
  status: string;
  stakePerPlayer?: number;
  scoringMode?: string;
  players: Player[];
  scores?: PlayerScore[];
  resultSummary?: string;
  winnerId?: string;
  settlements?: Array<{ fromId: string; toId: string; amount: number }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HOLE_PARS = [4, 4, 3, 4, 5, 3, 4, 4, 5, 4, 3, 5, 4, 4, 3, 4, 5, 4]; // 18 holes
const HOLE_STROKE_INDEX = [9, 1, 15, 7, 3, 17, 11, 5, 13, 10, 16, 2, 8, 4, 18, 12, 6, 14];

function holePar(hole: number): number {
  return HOLE_PARS[hole - 1] ?? 4;
}

function strokesReceived(handicap: number, hole: number): number {
  const si = HOLE_STROKE_INDEX[hole - 1] ?? 1;
  return Math.floor(handicap / 18) + (si <= (handicap % 18) ? 1 : 0);
}

function calcStableford(gross: number, par: number, hcp: number, hole: number): number {
  return Math.max(0, 2 + par - gross + strokesReceived(hcp, hole));
}


function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? id;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatTypeBadge(type: string): "default" | "warning" | "muted" {
  if (type === "skins") return "warning";
  if (type === "nassau") return "muted";
  return "default";
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LiveGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const game = useQuery(api.quickGames.get, id ? { gameId: id as any } : "skip");
  const updateScores = useMutation(api.quickGames.updateScores);
  const completeGame = useMutation(api.quickGames.complete);

  const [currentHole, setCurrentHole] = useState(1);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  // Local score state (per hole: map of playerId -> score)
  const [holeScoreMap, setHoleScoreMap] = useState<Record<string, Record<number, number>>>({});
  // Overall score state (playerId -> { gross, points })
  const [overallScores, setOverallScores] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);

  if (game == null) {
    return <LoadingSpinner fullScreen />;
  }

  // Capture narrowed type so closures below can reference it without null checks
  const g = game as Game;

  const scoringMode = g.scoringMode ?? "overall";
  const isPerHole = scoringMode === "per_hole";

  // ── Per-hole helpers ─────────────────────────────────────────────────────────

  function getHoleScore(playerId: string, hole: number): number {
    return holeScoreMap[playerId]?.[hole] ?? 0;
  }

  function setHoleScore(playerId: string, hole: number, score: number) {
    setHoleScoreMap((prev) => {
      const wasUnset = prev[playerId]?.[hole] == null;
      const actualScore = wasUnset
        ? (score > 0 ? holePar(hole) : Math.max(1, holePar(hole) - 1))
        : Math.max(1, score);
      return { ...prev, [playerId]: { ...(prev[playerId] ?? {}), [hole]: actualScore } };
    });
  }

  function runningTotal(playerId: string): number {
    const player = g.players.find((p: Player) => p.id === playerId);
    const hcp = player?.handicap ?? 0;

    if (g.type === "stableford") {
      let pts = 0;
      for (let h = 1; h <= 18; h++) {
        const s = holeScoreMap[playerId]?.[h];
        if (s != null && s > 0) pts += calcStableford(s, holePar(h), hcp, h);
      }
      return pts;
    } else {
      let total = 0;
      for (let h = 1; h <= 18; h++) {
        total += holeScoreMap[playerId]?.[h] ?? 0;
      }
      return total;
    }
  }

  // ── Matchplay helpers (nassau: 2 players head-to-head) ───────────────────────

  const team1 = g.players.slice(0, Math.ceil(g.players.length / 2));
  const team2 = g.players.slice(Math.ceil(g.players.length / 2));

  function matchPlayScore(): string {
    if (g.players.length !== 2) return "";
    const [p0, p1] = g.players;
    let score = 0; // +ve = p0 leads, -ve = p1 leads
    for (let h = 1; h <= 18; h++) {
      const s0 = holeScoreMap[p0.id]?.[h];
      const s1 = holeScoreMap[p1.id]?.[h];
      if (s0 == null || s1 == null) continue;
      const net0 = s0 - strokesReceived(p0.handicap ?? 0, h);
      const net1 = s1 - strokesReceived(p1.handicap ?? 0, h);
      if (net0 < net1) score++;
      else if (net1 < net0) score--;
    }
    if (score === 0) return "All Square";
    const leader = score > 0 ? p0.name : p1.name;
    return `${leader} ${Math.abs(score)} UP`;
  }

  function holeMatchResult(hole: number): string {
    if (g.players.length !== 2) return "";
    const [p0, p1] = g.players;
    const s0 = holeScoreMap[p0.id]?.[hole];
    const s1 = holeScoreMap[p1.id]?.[hole];
    if (s0 == null || s1 == null) return "";
    const net0 = s0 - strokesReceived(p0.handicap ?? 0, hole);
    const net1 = s1 - strokesReceived(p1.handicap ?? 0, hole);
    if (net0 < net1) return `${p0.name} wins hole`;
    if (net1 < net0) return `${p1.name} wins hole`;
    return "Halved";
  }

  // ── Better ball helpers (betterball: teams of 2, stableford best ball) ────────

  function betterBallTeamScore(teamPlayers: Player[]): number {
    let total = 0;
    for (let h = 1; h <= 18; h++) {
      const pts = teamPlayers
        .map((p) => {
          const s = holeScoreMap[p.id]?.[h];
          return s != null ? calcStableford(s, holePar(h), p.handicap ?? 0, h) : null;
        })
        .filter((x): x is number => x != null);
      if (pts.length > 0) total += Math.max(...pts);
    }
    return total;
  }

  // ── Save scores ──────────────────────────────────────────────────────────────

  async function handleSaveScores() {
    const scores: PlayerScore[] = g.players.map((p: Player) => {
      if (isPerHole) {
        const hs: HoleScore[] = [];
        for (let h = 1; h <= 18; h++) {
          const s = holeScoreMap[p.id]?.[h];
          if (s != null && s > 0) hs.push({ hole: h, gross: s });
        }
        return { playerId: p.id, holeScores: hs };
      } else {
        const raw = overallScores[p.id];
        const val = raw ? parseInt(raw, 10) : undefined;
        return { playerId: p.id, gross: val };
      }
    });

    await updateScores({ gameId: g._id as any, scores });
  }

  async function handleComplete() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const scores: PlayerScore[] = g.players.map((p: Player) => {
        if (isPerHole) {
          const hs: HoleScore[] = [];
          for (let h = 1; h <= 18; h++) {
            const s = holeScoreMap[p.id]?.[h];
            if (s != null && s > 0) hs.push({ hole: h, gross: s });
          }
          return { playerId: p.id, holeScores: hs };
        } else {
          const raw = overallScores[p.id];
          const val = raw ? parseInt(raw, 10) : undefined;
          return { playerId: p.id, gross: val };
        }
      });

      await completeGame({ gameId: g._id as any, scores });
      setConfirmModalVisible(false);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to complete game.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ title: game.name }} />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="px-4 pt-4 pb-3 bg-white border-b border-gray-100">
          <View className="flex-row items-center gap-2 mb-1">
            <Badge variant={formatTypeBadge(game.type)}>
              {game.type.charAt(0).toUpperCase() + game.type.slice(1)}
            </Badge>
            <Text className="text-xs text-gray-400">{formatDate(game.date)}</Text>
            {game.stakePerPlayer != null && game.stakePerPlayer > 0 && (
              <Badge variant="warning">
                £{(game.stakePerPlayer / 100).toFixed(2)}/player
              </Badge>
            )}
          </View>

          {/* Player totals / match score bar */}
          <View className="mt-2">
            {isPerHole && g.type === "nassau" && g.players.length === 2 ? (
              <View className="flex-row items-center gap-2">
                <View className="bg-gray-50 rounded-full px-3 py-1">
                  <Text className="text-xs font-bold text-green-700">{matchPlayScore()}</Text>
                </View>
                <Text className="text-xs text-gray-400">
                  {g.players.map((p) => `${p.name.split(" ")[0]}${p.handicap != null ? ` (${p.handicap})` : ""}`).join(" vs ")}
                </Text>
              </View>
            ) : isPerHole && g.type === "betterball" && g.players.length >= 2 ? (
              <View className="flex-row gap-2">
                {[team1, team2].map((team, idx) => (
                  <View key={idx} className="flex-row items-center bg-gray-50 rounded-full px-3 py-1 gap-1.5">
                    <Text className="text-xs font-semibold text-gray-700">
                      {team.map((p) => p.name.split(" ")[0]).join("/")}
                    </Text>
                    <Text className="text-xs text-green-700 font-bold">{betterBallTeamScore(team)} pts</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {game.players.map((p: Player) => {
                  const playerScore = game.scores?.find((s: PlayerScore) => s.playerId === p.id);
                  const total = isPerHole
                    ? runningTotal(p.id)
                    : playerScore?.points ?? playerScore?.gross ?? "—";
                  return (
                    <View key={p.id} className="flex-row items-center bg-gray-50 rounded-full px-3 py-1 gap-1.5">
                      <Text className="text-xs font-semibold text-gray-700">{p.name}</Text>
                      <Text className="text-xs text-green-700 font-bold">{total}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Complete — winner banner */}
        {game.status === "complete" && (
          <CompleteView game={game} />
        )}

        {/* Active — scoring area */}
        {game.status === "active" && (
          <View className="px-4 pt-4">
            {isPerHole ? (
              <PerHoleScoringView
                game={game}
                currentHole={currentHole}
                setCurrentHole={setCurrentHole}
                holeScoreMap={holeScoreMap}
                getHoleScore={getHoleScore}
                setHoleScore={setHoleScore}
                runningTotal={runningTotal}
                holeMatchResult={g.type === "nassau" ? holeMatchResult : undefined}
                betterBallTeams={g.type === "betterball" && g.players.length >= 2 ? [team1, team2] : undefined}
                betterBallTeamScore={g.type === "betterball" ? betterBallTeamScore : undefined}
                onSave={handleSaveScores}
                onFinish={() => setConfirmModalVisible(true)}
              />
            ) : (
              <OverallScoringView
                game={game}
                overallScores={overallScores}
                setOverallScores={setOverallScores}
                onComplete={() => setConfirmModalVisible(true)}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Confirm complete modal */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
            <Text className="text-xl font-bold text-gray-900 mb-2">Complete game?</Text>
            <Text className="text-gray-500 mb-6">
              This will finalise all scores and calculate results.
            </Text>
            <Button onPress={handleComplete} loading={submitting} className="mb-3">
              Yes, Complete Game
            </Button>
            <Button variant="outline" onPress={() => setConfirmModalVisible(false)}>
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Complete view ─────────────────────────────────────────────────────────────

function CompleteView({ game }: { game: Game }) {
  const router = useRouter();
  const winnerName = game.winnerId ? playerName(game.players, game.winnerId) : null;

  return (
    <View className="px-4 pt-4 gap-4">
      {/* Winner card */}
      <Card className="px-4 py-5 items-center gap-2">
        <Ionicons name="trophy" size={36} color="#d97706" />
        <Text className="text-2xl font-bold text-gray-900">
          {winnerName ?? "Game Complete"}
        </Text>
        {game.resultSummary && (
          <Text className="text-gray-500 text-center text-sm">{game.resultSummary}</Text>
        )}
      </Card>

      {/* Settlement table */}
      {game.settlements && game.settlements.length > 0 && (
        <Card className="overflow-hidden">
          <View className="px-4 py-3 border-b border-gray-50">
            <Text className="font-bold text-gray-900">Settlement</Text>
          </View>
          {game.settlements.map((s, i) => (
            <View
              key={i}
              className="flex-row items-center px-4 py-3 border-b border-gray-50 last:border-0"
            >
              <Text className="flex-1 text-gray-700 text-sm">
                {playerName(game.players, s.fromId)}{" "}
                <Text className="text-gray-400">owes</Text>{" "}
                {playerName(game.players, s.toId)}
              </Text>
              <Text className="font-bold text-gray-900">
                £{(s.amount / 100).toFixed(2)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Final scores */}
      <Card className="overflow-hidden">
        <View className="px-4 py-3 border-b border-gray-50">
          <Text className="font-bold text-gray-900">Scores</Text>
        </View>
        {game.players.map((p: Player, i: number) => {
          const score = game.scores?.find((s: PlayerScore) => s.playerId === p.id);
          const display = score?.points ?? score?.gross ?? "—";
          return (
            <View
              key={p.id}
              className="flex-row items-center px-4 py-3 border-b border-gray-50"
            >
              <View
                className={`w-7 h-7 rounded-full items-center justify-center mr-3 ${
                  i === 0 ? "bg-amber-100" : "bg-gray-100"
                }`}
              >
                <Text className={`text-xs font-bold ${i === 0 ? "text-amber-700" : "text-gray-500"}`}>
                  {i + 1}
                </Text>
              </View>
              <Text className="flex-1 text-gray-900 font-medium text-sm">{p.name}</Text>
              <Text className="font-bold text-gray-900">{display}</Text>
            </View>
          );
        })}
      </Card>

      <Button
        variant="outline"
        onPress={() => router.push("/play/games/new" as any)}
      >
        Play Again
      </Button>
    </View>
  );
}

// ── Overall scoring view ───────────────────────────────────────────────────────

function OverallScoringView({
  game,
  overallScores,
  setOverallScores,
  onComplete,
}: {
  game: Game;
  overallScores: Record<string, string>;
  setOverallScores: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onComplete: () => void;
}) {
  return (
    <View className="gap-4">
      <Text className="text-base font-semibold text-gray-700">Enter scores</Text>
      <Card className="overflow-hidden">
        {game.players.map((p: Player, i: number) => (
          <View
            key={p.id}
            className={`flex-row items-center px-4 py-3 ${
              i < game.players.length - 1 ? "border-b border-gray-50" : ""
            }`}
          >
            <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-3">
              <Text className="text-green-700 text-xs font-bold">
                {p.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-gray-900 text-sm">{p.name}</Text>
              {p.handicap != null && (
                <Text className="text-xs text-gray-400">HCP {p.handicap}</Text>
              )}
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-gray-400">
                {game.type === "stableford" ? "pts" : "gross"}
              </Text>
              <TextInput
                value={overallScores[p.id] ?? ""}
                onChangeText={(v) =>
                  setOverallScores((prev) => ({ ...prev, [p.id]: v }))
                }
                keyboardType="number-pad"
                placeholder="0"
                className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-center text-gray-900 font-bold"
              />
            </View>
          </View>
        ))}
      </Card>

      <Button onPress={onComplete} size="lg">
        Complete Game
      </Button>
    </View>
  );
}

// ── Per-hole scoring view ─────────────────────────────────────────────────────

function PerHoleScoringView({
  game,
  currentHole,
  setCurrentHole,
  holeScoreMap,
  getHoleScore,
  setHoleScore,
  runningTotal,
  holeMatchResult,
  betterBallTeams,
  betterBallTeamScore,
  onSave,
  onFinish,
}: {
  game: Game;
  currentHole: number;
  setCurrentHole: React.Dispatch<React.SetStateAction<number>>;
  holeScoreMap: Record<string, Record<number, number>>;
  getHoleScore: (playerId: string, hole: number) => number;
  setHoleScore: (playerId: string, hole: number, score: number) => void;
  runningTotal: (playerId: string) => number;
  holeMatchResult?: (hole: number) => string;
  betterBallTeams?: [Player[], Player[]];
  betterBallTeamScore?: (team: Player[]) => number;
  onSave: () => void;
  onFinish: () => void;
}) {
  const par = holePar(currentHole);
  const si = HOLE_STROKE_INDEX[currentHole - 1];

  // For betterball: map playerId → team index (0 or 1)
  const playerTeamIndex = betterBallTeams
    ? new Map<string, number>([
        ...betterBallTeams[0].map((p): [string, number] => [p.id, 0]),
        ...betterBallTeams[1].map((p): [string, number] => [p.id, 1]),
      ])
    : null;

  // Subtotal label per player row
  function rowSubtotal(p: Player): string {
    if (game.type === "nassau") {
      return p.handicap != null ? `HCP ${p.handicap}` : "";
    }
    if (game.type === "betterball") {
      const teamIdx = playerTeamIndex?.get(p.id);
      const teamLabel = teamIdx === 0 ? "A" : teamIdx === 1 ? "B" : "";
      const teamScore = betterBallTeamScore && betterBallTeams
        ? betterBallTeamScore(betterBallTeams[teamIdx ?? 0])
        : 0;
      return `Team ${teamLabel}: ${teamScore} pts`;
    }
    const total = runningTotal(p.id);
    return `Total: ${total}${game.type === "stableford" ? " pts" : ""}`;
  }

  const matchResult = holeMatchResult ? holeMatchResult(currentHole) : "";

  return (
    <View className="gap-4">
      {/* Hole navigator */}
      <View className="flex-row items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-100">
        <TouchableOpacity
          onPress={() => setCurrentHole((h) => Math.max(1, h - 1))}
          disabled={currentHole === 1}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={currentHole === 1 ? "#d1d5db" : "#374151"}
          />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-2xl font-bold text-gray-900">Hole {currentHole}</Text>
          <Text className="text-sm text-gray-400">Par {par} · SI {si}</Text>
        </View>

        <TouchableOpacity
          onPress={() => setCurrentHole((h) => Math.min(18, h + 1))}
          disabled={currentHole === 18}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={currentHole === 18 ? "#d1d5db" : "#374151"}
          />
        </TouchableOpacity>
      </View>

      {/* Player rows */}
      <Card className="overflow-hidden">
        {game.players.map((p: Player, i: number) => {
          const score = getHoleScore(p.id, currentHole);
          const shots = strokesReceived(p.handicap ?? 0, currentHole);
          return (
            <View
              key={p.id}
              className={`flex-row items-center px-4 py-3 gap-3 ${
                i < game.players.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              {/* Player info */}
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-semibold text-gray-900 text-sm">{p.name}</Text>
                  {shots > 0 && (
                    <View className="bg-green-100 rounded px-1">
                      <Text className="text-green-700 text-xs font-semibold">+{shots}</Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs text-gray-400">{rowSubtotal(p)}</Text>
              </View>

              {/* Score chip */}
              {score > 0 ? (
                <ScoreChip score={score} par={par} size="sm" />
              ) : (
                <View className="w-7 h-7 rounded-sm border border-dashed border-gray-300 items-center justify-center">
                  <Text className="text-gray-300 text-xs">—</Text>
                </View>
              )}

              {/* +/- buttons */}
              <View className="flex-row items-center gap-1">
                <TouchableOpacity
                  onPress={() => setHoleScore(p.id, currentHole, score - 1)}
                  className="w-9 h-9 rounded-lg bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="remove" size={18} color="#374151" />
                </TouchableOpacity>
                <Text className="w-7 text-center font-bold text-gray-900">{score > 0 ? score : "—"}</Text>
                <TouchableOpacity
                  onPress={() => setHoleScore(p.id, currentHole, score + 1)}
                  className="w-9 h-9 rounded-lg bg-green-100 items-center justify-center"
                >
                  <Ionicons name="add" size={18} color="#15803d" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Hole result banner (matchplay) */}
        {matchResult !== "" && (
          <View className="flex-row items-center justify-center px-4 py-2.5 bg-green-50 border-t border-green-100">
            <Ionicons name="flag" size={13} color="#16a34a" style={{ marginRight: 6 }} />
            <Text className="text-xs font-semibold text-green-700">{matchResult}</Text>
          </View>
        )}
      </Card>

      {/* Save / finish */}
      <View className="flex-row gap-3">
        <Button variant="outline" onPress={onSave} className="flex-1">
          Save
        </Button>
        {currentHole === 18 ? (
          <Button onPress={onFinish} className="flex-1">
            Finish Round
          </Button>
        ) : (
          <Button
            onPress={() => setCurrentHole((h) => Math.min(18, h + 1))}
            className="flex-1"
          >
            Next Hole
          </Button>
        )}
      </View>
    </View>
  );
}

