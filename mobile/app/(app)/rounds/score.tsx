/**
 * Resume an in-progress round.
 * Route: /rounds/score?roundId=xxx
 */
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/convex";
import { Button } from "../../../components/ui";
import { PlayedWithPicker } from "../../../components/PlayedWithPicker";
import { useDistanceUnit } from "../../../hooks/useDistanceUnit";

// ── Constants ──────────────────────────────────────────────────────────────────

const STANDARD_PARS = [4, 4, 4, 3, 5, 4, 3, 4, 5, 4, 3, 5, 4, 4, 5, 3, 4, 4];
const STANDARD_SI   = [1, 7, 11, 15, 3, 13, 17, 5, 9, 8, 16, 4, 12, 6, 2, 18, 10, 14];

const CONDITIONS = [
  { key: "dry",      emoji: "☀️", label: "Dry"      },
  { key: "overcast", emoji: "🌤", label: "Overcast" },
  { key: "wet",      emoji: "🌧", label: "Wet"      },
  { key: "windy",    emoji: "💨", label: "Windy"    },
] as const;

function computeStableford(
  holeScores: number[],
  pars: number[],
  playingHandicap: number,
  strokeIndexes: number[]
): number {
  let total = 0;
  for (let i = 0; i < 18; i++) {
    const si = strokeIndexes[i];
    const shots = Math.floor(playingHandicap / 18) + (si <= (playingHandicap % 18) ? 1 : 0);
    const diff = (pars[i] + shots) - holeScores[i];
    total += Math.max(0, diff + 2);
  }
  return total;
}

// ── Resume Scoring Screen ─────────────────────────────────────────────────────

export default function ResumeRoundScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { roundId } = useLocalSearchParams<{ roundId: string }>();

  const round = useQuery(api.rounds.get, roundId ? { roundId: roundId as any } : "skip");
  const courseData = useQuery(
    api.golfCourses.getWithTees,
    round?.golfCourseId ? { courseId: round.golfCourseId as any } : "skip"
  );
  const saveHoleScore = useMutation(api.rounds.saveHoleScore);
  const completeRound = useMutation(api.rounds.completeRound);
  const deleteRound = useMutation(api.rounds.deleteRound);

  const handicap = useQuery(
    api.handicap.getLatest,
    user?.id ? { userId: user.id } : "skip"
  );

  const [submitting, setSubmitting] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [playedWith, setPlayedWith] = useState<string[]>([]);
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");

  // Still loading
  if (round === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ title: "Loading…" }} />
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  }

  // Round not found or was deleted
  if (round === null) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Stack.Screen options={{ title: "Round not found" }} />
        <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
        <Text className="text-gray-900 font-bold text-xl mt-4 text-center">Round not found</Text>
        <Text className="text-gray-500 text-sm text-center mt-2">
          This round may have been completed or cancelled.
        </Text>
        <Button onPress={() => router.replace("/(app)/rounds")} className="mt-6">
          View Rounds
        </Button>
      </View>
    );
  }

  // Round already complete — shouldn't be here
  if (round.status !== "in_progress") {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
        <Text className="text-gray-900 font-bold text-xl mt-4">Round complete</Text>
        <Button onPress={() => router.replace("/(app)/rounds")} className="mt-6">
          View Rounds
        </Button>
      </View>
    );
  }

  // Build pars & stroke indexes from course data or saved hole scores
  const clubCourseHoles = (courseData as any)?.clubCourseHoles;
  const matchedTee = courseData?.tees?.find((t: any) => t._id === round.teeId) ?? courseData?.tees?.[0];
  const teeHoles = matchedTee?.holes;
  const courseHoles = clubCourseHoles ?? teeHoles;
  const pars = courseHoles?.length === 18 ? courseHoles.map((h: any) => h.par) : STANDARD_PARS;
  const strokeIndexes = courseHoles?.length === 18 ? courseHoles.map((h: any) => h.strokeIndex) : STANDARD_SI;
  const holeYards: (number | null)[] | null = teeHoles?.length === 18 ? teeHoles.map((h: any) => h.yards ?? null) : null;
  const holeMeters: (number | null)[] | null = teeHoles?.length === 18 ? teeHoles.map((h: any) => h.meters ?? null) : null;

  // Pre-populate scores from saved holeScores
  const savedScores: (number | null)[] = new Array(18).fill(null);
  for (const h of round.holeScores ?? []) {
    if (h.hole >= 1 && h.hole <= 18) savedScores[h.hole - 1] = h.score;
  }

  // First unscored hole
  const firstUnscored = savedScores.findIndex(s => s === null);
  const resumeAtHole = firstUnscored >= 0 ? firstUnscored : 17;

  return (
    <ScoringUI
      round={round}
      pars={pars}
      strokeIndexes={strokeIndexes}
      holeYards={holeYards}
      holeMeters={holeMeters}
      initialScores={savedScores}
      startHole={resumeAtHole}
      playingHandicap={Math.round(handicap ?? 0)}
      showExtras={showExtras}
      setShowExtras={setShowExtras}
      playedWith={playedWith}
      setPlayedWith={setPlayedWith}
      conditions={conditions}
      setConditions={setConditions}
      notes={notes}
      setNotes={setNotes}
      onSaveHole={(hole, par, si, score) => {
        saveHoleScore({ roundId: round._id, hole, par, strokeIndex: si, score }).catch(() => {});
      }}
      onCancel={() => {
        Alert.alert(
          "Cancel round?",
          "This round will be permanently deleted.",
          [
            { text: "Keep playing", style: "cancel" },
            {
              text: "Cancel round",
              style: "destructive",
              onPress: () =>
                deleteRound({ roundId: round._id }).then(() => router.replace("/(app)" as any)).catch((e: any) =>
                  Alert.alert("Error", e?.message ?? "Failed to cancel round")
                ),
            },
          ]
        );
      }}
      onComplete={async (holeScores) => {
        setSubmitting(true);
        try {
          await completeRound({
            roundId: round._id,
            holeScores,
            ...(playedWith.length > 0 ? { playedWith } : {}),
            ...(conditions ? { conditions } : {}),
            ...(notes ? { notes } : {}),
          });
          Alert.alert("Round Complete!", "Your round has been saved.", [
            { text: "View Rounds", onPress: () => router.replace("/(app)/rounds") },
          ]);
        } catch (e: any) {
          Alert.alert("Error", e?.message ?? "Failed to save round");
        } finally {
          setSubmitting(false);
        }
      }}
      submitting={submitting}
      router={router}
    />
  );
}

// ── Scoring UI (shared logic) ──────────────────────────────────────────────────

function ScoringUI({
  round,
  pars,
  strokeIndexes,
  holeYards,
  holeMeters,
  initialScores,
  startHole,
  playingHandicap,
  showExtras,
  setShowExtras,
  playedWith,
  setPlayedWith,
  conditions,
  setConditions,
  notes,
  setNotes,
  onSaveHole,
  onCancel,
  onComplete,
  submitting,
  router,
}: {
  round: any;
  pars: number[];
  strokeIndexes: number[];
  holeYards?: (number | null)[] | null;
  holeMeters?: (number | null)[] | null;
  initialScores: (number | null)[];
  startHole: number;
  playingHandicap: number;
  showExtras: boolean;
  setShowExtras: (v: boolean) => void;
  playedWith: string[];
  setPlayedWith: (v: string[]) => void;
  conditions: string;
  setConditions: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  onSaveHole: (hole: number, par: number, si: number, score: number) => void;
  onCancel: () => void;
  onComplete: (holeScores: { hole: number; par: number; strokeIndex: number; score: number }[]) => void;
  submitting: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const { fmt } = useDistanceUnit();
  const [viewMode, setViewMode] = useState<"hole_by_hole" | "scorecard">("hole_by_hole");
  const [scores, setScores] = useState<(number | null)[]>(initialScores);
  const [currentHole, setCurrentHole] = useState(startHole);

  function updateScore(i: number, delta: number) {
    setScores(prev => {
      const next = [...prev];
      if (next[i] === null) {
        next[i] = delta > 0 ? pars[i] : pars[i] - 1;
      } else {
        next[i] = Math.max(1, next[i]! + delta);
      }
      return next;
    });
  }

  const filledScores = scores.map((s, i) => s ?? pars[i]);
  const enteredCount = scores.filter(s => s !== null).length;
  const grossTotal = scores.reduce<number>((a, s) => a + (s ?? 0), 0);
  const stablefordTotal = computeStableford(filledScores, pars, playingHandicap, strokeIndexes);

  function buildHoleScores() {
    return filledScores.map((score, i) => ({
      hole: i + 1,
      par: pars[i],
      strokeIndex: strokeIndexes[i],
      score,
    }));
  }

  // ── Extras ───────────────────────────────────────────────────────────────────
  if (showExtras) {
    const total = filledScores.reduce((a, b) => a + b, 0);
    const stablefordFinal = computeStableford(filledScores, pars, playingHandicap, strokeIndexes);
    return (
      <>
        <Stack.Screen options={{ title: "Finish Round" }} />
        <ScrollView className="flex-1 bg-gray-50" keyboardShouldPersistTaps="handled">
          <View className="px-4 pt-4 gap-5">
            <Text className="text-xl font-bold text-gray-900">Round complete</Text>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-green-600 rounded-xl p-4 items-center">
                <Text className="text-white text-3xl font-bold">{total}</Text>
                <Text className="text-green-200 text-xs mt-1">Gross</Text>
              </View>
              <View className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 items-center">
                <Text className="text-green-700 text-3xl font-bold">{stablefordFinal}</Text>
                <Text className="text-green-500 text-xs mt-1">Stableford</Text>
              </View>
            </View>
            <PlayedWithPicker players={playedWith} onChange={setPlayedWith} />
            <View className="gap-2">
              <Text className="text-sm font-medium text-gray-700">Conditions</Text>
              <View className="flex-row gap-2">
                {CONDITIONS.map(c => (
                  <TouchableOpacity key={c.key} onPress={() => setConditions(conditions === c.key ? "" : c.key)}
                    className={`flex-1 py-2.5 rounded-xl items-center border ${conditions === c.key ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"}`}>
                    <Text className="text-xl">{c.emoji}</Text>
                    <Text className={`text-xs mt-0.5 ${conditions === c.key ? "text-green-700 font-semibold" : "text-gray-500"}`}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-gray-700">Notes (optional)</Text>
              <TextInput
                className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 min-h-20"
                value={notes} onChangeText={setNotes}
                placeholder="How did it go?" placeholderTextColor="#9ca3af"
                multiline numberOfLines={3} textAlignVertical="top"
              />
            </View>
            <Button onPress={() => onComplete(buildHoleScores())} loading={submitting} size="lg" className="mb-8">
              Submit Round
            </Button>
          </View>
        </ScrollView>
      </>
    );
  }

  // ── Toggle ───────────────────────────────────────────────────────────────────
  const viewToggle = (
    <View className="flex-row mx-4 mt-2 mb-1 bg-gray-100 rounded-xl p-1">
      {(["hole_by_hole", "scorecard"] as const).map(mode => (
        <TouchableOpacity key={mode} onPress={() => setViewMode(mode)}
          className={`flex-1 py-1.5 rounded-lg items-center ${viewMode === mode ? "bg-white" : ""}`}>
          <Text className={`text-xs font-semibold ${viewMode === mode ? "text-gray-900" : "text-gray-400"}`}>
            {mode === "hole_by_hole" ? "Hole by hole" : "Scorecard"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Scorecard view ───────────────────────────────────────────────────────────
  if (viewMode === "scorecard") {
    return (
      <>
        <Stack.Screen options={{
          title: round.courseNameFreetext ?? "In Progress",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.replace("/(app)" as any)}
              style={{ paddingLeft: 4, paddingRight: 12 }}
            >
              <Ionicons name="arrow-back" size={22} color="#374151" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={onCancel} style={{ paddingRight: 4 }}>
              <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "600" }}>Cancel round</Text>
            </TouchableOpacity>
          ),
        }} />
        <View className="flex-1 bg-gray-50">
          {viewToggle}
          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            <View className="px-4 pt-2 pb-8 gap-4">
              <View className="flex-row gap-3">
                <View className="flex-1 bg-green-600 rounded-xl p-3 items-center">
                  <Text className="text-white text-2xl font-bold">{enteredCount > 0 ? grossTotal : "—"}</Text>
                  <Text className="text-green-200 text-xs">Gross · {enteredCount}/18</Text>
                </View>
                <View className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 items-center">
                  <Text className="text-green-700 text-2xl font-bold">{stablefordTotal}</Text>
                  <Text className="text-green-500 text-xs">Stableford</Text>
                </View>
              </View>
              <View className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <View className="flex-row px-3 py-2 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-400 w-8">Hole</Text>
                  <Text className="text-xs font-bold text-gray-400 w-10">Par</Text>
                  <Text className="text-xs font-bold text-gray-400 w-10">SI</Text>
                  <Text className="text-xs font-bold text-gray-400 flex-1 text-center">Score</Text>
                </View>
                {pars.map((par, i) => {
                  const score = scores[i];
                  const diff = score !== null ? score - par : null;
                  const diffColor = diff === null ? "#d1d5db" : diff < 0 ? "#16a34a" : diff === 0 ? "#6b7280" : diff === 1 ? "#3b82f6" : "#dc2626";
                  return (
                    <View key={i} className={`flex-row items-center px-3 py-2 border-b border-gray-50 last:border-0 ${i === 8 ? "border-b-2 border-gray-200" : ""}`}>
                      <Text className="text-sm font-bold text-gray-500 w-8">{i + 1}</Text>
                      <Text className="text-sm text-gray-500 w-10">{par}</Text>
                      <Text className="text-sm text-gray-400 w-10">{strokeIndexes[i]}</Text>
                      <View className="flex-1 flex-row items-center justify-center gap-3">
                        <TouchableOpacity onPress={() => updateScore(i, -1)} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                          <Ionicons name="remove" size={16} color="#6b7280" />
                        </TouchableOpacity>
                        <Text style={{ color: diffColor, fontWeight: "700", fontSize: 18, minWidth: 24, textAlign: "center" }}>
                          {score !== null ? score : "—"}
                        </Text>
                        <TouchableOpacity onPress={() => updateScore(i, 1)} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                          <Ionicons name="add" size={16} color="#6b7280" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Button onPress={() => setShowExtras(true)} size="lg">Continue</Button>
            </View>
          </ScrollView>
        </View>
      </>
    );
  }

  // ── Hole-by-hole view ────────────────────────────────────────────────────────
  const par = pars[currentHole];
  const si = strokeIndexes[currentHole];
  const score = scores[currentHole];
  const shotsReceived = Math.floor(playingHandicap / 18) + (si <= (playingHandicap % 18) ? 1 : 0);
  const distLabel = fmt(holeYards?.[currentHole] ?? undefined, holeMeters?.[currentHole] ?? undefined);
  const diff = score !== null ? score - par : null;
  const diffLabel = diff === null ? "" : diff === -2 ? "Eagle" : diff === -1 ? "Birdie" : diff === 0 ? "Par" : diff === 1 ? "Bogey" : diff === 2 ? "Double" : `+${diff}`;
  const diffColor = diff === null ? "#d1d5db" : diff < 0 ? "#16a34a" : diff === 0 ? "#6b7280" : diff === 1 ? "#3b82f6" : "#dc2626";
  const enteredTotal = scores.slice(0, currentHole + 1).reduce<number>((a, s) => a + (s ?? 0), 0);

  return (
    <>
      <Stack.Screen options={{
        title: round.courseNameFreetext ?? "In Progress",
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.replace("/(app)" as any)}
            style={{ paddingLeft: 4, paddingRight: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={onCancel} style={{ paddingRight: 4 }}>
            <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "600" }}>Cancel round</Text>
          </TouchableOpacity>
        ),
      }} />
      <View className="flex-1 bg-white">
        {viewToggle}
        <View className="flex-row px-4 pt-1 gap-1">
          {pars.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setCurrentHole(i)} className="flex-1 py-1">
              <View className={`h-1.5 rounded-full ${i < currentHole ? "bg-green-500" : i === currentHole ? "bg-green-300" : scores[i] !== null ? "bg-green-200" : "bg-gray-100"}`} />
            </TouchableOpacity>
          ))}
        </View>
        <View className="flex-row px-4 pt-2 pb-1 gap-3">
          <View className="flex-1 bg-green-600 rounded-xl px-3 py-2 items-center">
            <Text className="text-white text-lg font-bold">{enteredTotal > 0 ? enteredTotal : "—"}</Text>
            <Text className="text-green-200 text-xs">Gross · {enteredCount}/18</Text>
          </View>
          <View className="flex-1 bg-green-50 border border-green-200 rounded-xl px-3 py-2 items-center">
            <Text className="text-green-700 text-lg font-bold">{stablefordTotal}</Text>
            <Text className="text-green-500 text-xs">Stableford</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-8 gap-6">
          <View className="items-center gap-1">
            <Text className="text-5xl font-bold text-gray-900">Hole {currentHole + 1}</Text>
            <View className="flex-row gap-4 mt-1">
              <Text className="text-base text-gray-500">Par {par}</Text>
              {distLabel && <Text className="text-base text-gray-500">{distLabel}</Text>}
              <Text className="text-base text-gray-400">SI {si}</Text>
              {shotsReceived > 0 && (
                <Text className="text-base text-green-600 font-semibold">+{shotsReceived} shot{shotsReceived > 1 ? "s" : ""}</Text>
              )}
            </View>
          </View>
          <View className="items-center gap-2">
            <Text style={{ fontSize: 80, fontWeight: "800", color: diffColor, lineHeight: 88 }}>
              {score !== null ? score : "—"}
            </Text>
            {diffLabel !== "" && (
              <Text style={{ color: diffColor, fontWeight: "600", fontSize: 18 }}>{diffLabel}</Text>
            )}
          </View>
          <View className="flex-row gap-8 items-center">
            <TouchableOpacity onPress={() => updateScore(currentHole, -1)}
              style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="remove" size={32} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => updateScore(currentHole, 1)}
              style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="add" size={32} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>
        <View className="flex-row px-4 pb-6 gap-3">
          <TouchableOpacity onPress={() => currentHole > 0 && setCurrentHole(h => h - 1)}
            disabled={currentHole === 0}
            className={`flex-1 py-3.5 rounded-xl items-center border ${currentHole === 0 ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"}`}>
            <Text className={`font-semibold ${currentHole === 0 ? "text-gray-300" : "text-gray-700"}`}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (score !== null) {
                onSaveHole(currentHole + 1, par, si, score);
              }
              if (currentHole < 17) {
                setCurrentHole(h => h + 1);
              } else {
                setShowExtras(true);
              }
            }}
            disabled={score === null}
            className={`flex-[2] py-3.5 rounded-xl items-center ${score === null ? "bg-gray-100" : "bg-green-600"}`}>
            <Text className={`font-semibold ${score === null ? "text-gray-400" : "text-white"}`}>
              {currentHole === 17 ? "Finish round" : "Next hole →"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
