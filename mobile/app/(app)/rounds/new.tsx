import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/convex";
import { Button, Input, Card, Badge } from "../../../components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;
type Format = "strokeplay" | "stableford";
type EntryMode = "quick" | "full";
type TeeColour = "White" | "Yellow" | "Red" | "Blue";

interface GolfClub {
  _id: string;
  name: string;
  county?: string;
  postcode?: string;
}

interface CourseRating {
  courseRating: number;
  slopeRating: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEE_COLOURS: TeeColour[] = ["White", "Yellow", "Red", "Blue"];
const TEE_HEX: Record<TeeColour, string> = {
  White: "#ffffff",
  Yellow: "#fbbf24",
  Red: "#ef4444",
  Blue: "#3b82f6",
};

// Standard 18-hole par layout (front 9 + back 9)
const STANDARD_PARS = [4, 4, 4, 3, 5, 4, 3, 4, 5, 4, 3, 5, 4, 4, 5, 3, 4, 4];
// Standard stroke index
const STANDARD_SI = [1, 7, 11, 15, 3, 13, 17, 5, 9, 8, 16, 4, 12, 6, 2, 18, 10, 14];

const CONDITIONS = [
  { key: "dry", emoji: "☀️", label: "Dry" },
  { key: "overcast", emoji: "🌤", label: "Overcast" },
  { key: "wet", emoji: "🌧", label: "Wet" },
  { key: "windy", emoji: "💨", label: "Windy" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStableford(
  holeScores: number[],
  pars: number[],
  playingHandicap: number
): number {
  // Distribute shots across holes by SI
  const extraShots = new Array(18).fill(0);
  for (let i = 0; i < playingHandicap && i < 18; i++) {
    const holeIdx = STANDARD_SI.indexOf(i + 1);
    if (holeIdx >= 0) extraShots[holeIdx] = 1;
  }
  let total = 0;
  for (let i = 0; i < 18; i++) {
    const npar = pars[i] + (extraShots[i] ?? 0);
    const diff = npar - holeScores[i];
    total += Math.max(0, diff + 2);
  }
  return total;
}

function computeStablefordQuick(gross: number, par: number, playingHandicap: number): number {
  const net = gross - playingHandicap;
  const netVsPar = net - par;
  return Math.max(0, 36 - netVsPar);
}

function getThisWeekDates(): Date[] {
  const today = new Date();
  const result: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    result.push(d);
  }
  return result;
}

function fmtShortDate(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}

function toDateString(d: Date) {
  return d.toISOString().split("T")[0];
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-3">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <View
          key={s}
          className={`h-1.5 rounded-full ${
            s === current
              ? "bg-green-600 w-8"
              : s < current
              ? "bg-green-300 w-5"
              : "bg-gray-200 w-5"
          }`}
        />
      ))}
    </View>
  );
}

// ─── Step 1: Course ───────────────────────────────────────────────────────────

function Step1Course({
  onNext,
}: {
  onNext: (data: {
    club: GolfClub | null;
    courseNameFreetext: string;
    tee: TeeColour;
    courseRating: string;
    slopeRating: string;
    skipRatings: boolean;
  }) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedClub, setSelectedClub] = useState<GolfClub | null>(null);
  const [freetext, setFreetext] = useState("");
  const [useFreetext, setUseFreetext] = useState(false);
  const [tee, setTee] = useState<TeeColour>("Yellow");
  const [courseRating, setCourseRating] = useState("");
  const [slopeRating, setSlopeRating] = useState("");
  const [skipRatings, setSkipRatings] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const searchResults = useQuery(
    api.golfClubs.search,
    debouncedQuery.length >= 2 ? { term: debouncedQuery } : "skip"
  );

  const ratingData = useQuery(
    api.courseRatings.getByClubAndTee,
    selectedClub && tee
      ? { golfClubId: selectedClub._id as any, teeName: tee }
      : "skip"
  );

  // Auto-fill ratings when available
  useEffect(() => {
    if (ratingData) {
      setCourseRating(ratingData.courseRating?.toString() ?? "");
      setSlopeRating(ratingData.slopeRating?.toString() ?? "");
    }
  }, [ratingData]);

  const canAdvance = useFreetext
    ? freetext.trim().length > 0
    : selectedClub !== null;

  function handleNext() {
    onNext({
      club: selectedClub,
      courseNameFreetext: useFreetext ? freetext : (selectedClub?.name ?? ""),
      tee,
      courseRating,
      slopeRating,
      skipRatings,
    });
  }

  return (
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
      <View className="px-4 pt-4 gap-4">
        <Text className="text-xl font-bold text-gray-900">Course</Text>

        {/* Search or freetext toggle */}
        {!useFreetext ? (
          <View className="gap-2">
            <Input
              label="Search club"
              placeholder="e.g. Finchley Golf Club"
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                if (selectedClub) setSelectedClub(null);
              }}
              autoCorrect={false}
            />

            {/* Search results */}
            {searchResults && searchResults.length > 0 && !selectedClub && (
              <Card>
                {searchResults.slice(0, 6).map((club: GolfClub) => (
                  <TouchableOpacity
                    key={club._id}
                    onPress={() => {
                      setSelectedClub(club);
                      setQuery(club.name);
                    }}
                    className="px-4 py-3 border-b border-gray-50 flex-row items-center gap-2"
                  >
                    <Ionicons name="location-outline" size={16} color="#9ca3af" />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-gray-900">
                        {club.name}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {[club.county, club.postcode].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </Card>
            )}

            {selectedClub && (
              <View className="flex-row items-center gap-2 bg-green-50 rounded-xl px-3 py-2">
                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                <Text className="text-green-800 font-medium text-sm flex-1">
                  {selectedClub.name}
                </Text>
                <TouchableOpacity onPress={() => { setSelectedClub(null); setQuery(""); }}>
                  <Ionicons name="close" size={16} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity onPress={() => setUseFreetext(true)}>
              <Text className="text-green-600 text-sm font-medium">
                My course isn't listed →
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-2">
            <Input
              label="Course name"
              placeholder="e.g. Millfield Golf Club"
              value={freetext}
              onChangeText={setFreetext}
            />
            <TouchableOpacity onPress={() => { setUseFreetext(false); setFreetext(""); }}>
              <Text className="text-green-600 text-sm font-medium">← Search instead</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tee colour */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">Tees</Text>
          <View className="flex-row gap-2">
            {TEE_COLOURS.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTee(t)}
                className={`flex-1 py-2.5 rounded-xl items-center border-2 ${
                  tee === t ? "border-green-500" : "border-gray-200"
                }`}
                style={{ backgroundColor: tee === t ? "#f0fdf4" : "#f9fafb" }}
              >
                <View
                  className="w-5 h-5 rounded-full border border-gray-300 mb-1"
                  style={{ backgroundColor: TEE_HEX[t] }}
                />
                <Text
                  className={`text-xs font-medium ${
                    tee === t ? "text-green-700" : "text-gray-500"
                  }`}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Ratings */}
        {!skipRatings && (
          <View className="gap-3">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Course Rating"
                  placeholder="e.g. 71.3"
                  value={courseRating}
                  onChangeText={setCourseRating}
                  keyboardType="decimal-pad"
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Slope Rating"
                  placeholder="e.g. 125"
                  value={slopeRating}
                  onChangeText={setSlopeRating}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            {ratingData && (
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="checkmark-circle-outline" size={14} color="#16a34a" />
                <Text className="text-xs text-green-700">Auto-filled from club data</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={() => setSkipRatings(!skipRatings)}
          className="flex-row items-center gap-2"
        >
          <View
            className={`w-4 h-4 rounded border ${
              skipRatings ? "bg-gray-400 border-gray-400" : "border-gray-300"
            }`}
          >
            {skipRatings && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
          <Text className="text-sm text-gray-500">
            Skip ratings (round won't count to handicap)
          </Text>
        </TouchableOpacity>

        <Button
          onPress={handleNext}
          disabled={!canAdvance}
          size="lg"
          className="mt-2 mb-8"
        >
          Continue
        </Button>
      </View>
    </ScrollView>
  );
}

// ─── Step 2: Format ───────────────────────────────────────────────────────────

function Step2Format({
  onNext,
}: {
  onNext: (data: { format: Format; entryMode: EntryMode; date: string }) => void;
}) {
  const [format, setFormat] = useState<Format>("stableford");
  const [entryMode, setEntryMode] = useState<EntryMode>("quick");
  const today = new Date();
  const weekDates = getThisWeekDates();
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  return (
    <ScrollView className="flex-1">
      <View className="px-4 pt-4 gap-5">
        <Text className="text-xl font-bold text-gray-900">Format</Text>

        {/* Format toggle */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">Scoring</Text>
          <View className="flex-row gap-2">
            {(["strokeplay", "stableford"] as Format[]).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFormat(f)}
                className={`flex-1 py-3 rounded-xl items-center border-2 ${
                  format === f
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <Text
                  className={`font-semibold capitalize ${
                    format === f ? "text-green-700" : "text-gray-500"
                  }`}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Entry mode toggle */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">Entry type</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setEntryMode("quick")}
              className={`flex-1 py-3 px-2 rounded-xl items-center border-2 ${
                entryMode === "quick"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Ionicons
                name="flash-outline"
                size={20}
                color={entryMode === "quick" ? "#16a34a" : "#9ca3af"}
              />
              <Text
                className={`text-xs font-semibold mt-1 ${
                  entryMode === "quick" ? "text-green-700" : "text-gray-500"
                }`}
              >
                Quick entry
              </Text>
              <Text className="text-xs text-gray-400 text-center mt-0.5">
                Total score only
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEntryMode("full")}
              className={`flex-1 py-3 px-2 rounded-xl items-center border-2 ${
                entryMode === "full"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <Ionicons
                name="list-outline"
                size={20}
                color={entryMode === "full" ? "#16a34a" : "#9ca3af"}
              />
              <Text
                className={`text-xs font-semibold mt-1 ${
                  entryMode === "full" ? "text-green-700" : "text-gray-500"
                }`}
              >
                Full scorecard
              </Text>
              <Text className="text-xs text-gray-400 text-center mt-0.5">
                Hole by hole
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date picker: this week */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">Date</Text>
          <View className="flex-row gap-1.5">
            {weekDates.map((d) => {
              const isSelected = toDateString(d) === toDateString(selectedDate);
              return (
                <TouchableOpacity
                  key={toDateString(d)}
                  onPress={() => setSelectedDate(d)}
                  className={`flex-1 py-2.5 rounded-xl items-center border ${
                    isSelected
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      isSelected ? "text-green-700 font-bold" : "text-gray-500"
                    }`}
                  >
                    {fmtShortDate(d)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Button
          onPress={() =>
            onNext({ format, entryMode, date: toDateString(selectedDate) })
          }
          size="lg"
          className="mt-2 mb-8"
        >
          Continue
        </Button>
      </View>
    </ScrollView>
  );
}

// ─── Step 3a: Quick entry ─────────────────────────────────────────────────────

function Step3Quick({
  format,
  handicap,
  coursePar,
  onNext,
}: {
  format: Format;
  handicap: number | null;
  coursePar: number;
  onNext: (data: {
    grossScore: string;
    playedWith: string;
    conditions: string;
    notes: string;
  }) => void;
}) {
  const [grossScore, setGrossScore] = useState("");
  const [playedWith, setPlayedWith] = useState("");
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");

  const gross = parseInt(grossScore, 10);
  const playingHandicap = Math.round(handicap ?? 0);
  const stablefordEstimate =
    !isNaN(gross) && format === "stableford"
      ? computeStablefordQuick(gross, coursePar, playingHandicap)
      : null;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-4 gap-5">
          <Text className="text-xl font-bold text-gray-900">Your Score</Text>

          {/* Gross score input */}
          <View className="items-center gap-2">
            <Text className="text-sm font-medium text-gray-500 uppercase tracking-widest">
              Gross Score
            </Text>
            <TextInput
              className="text-7xl font-bold text-gray-900 text-center w-40"
              value={grossScore}
              onChangeText={setGrossScore}
              keyboardType="number-pad"
              placeholder="72"
              placeholderTextColor="#d1d5db"
              maxLength={3}
            />
            {stablefordEstimate !== null && (
              <View className="bg-green-50 rounded-xl px-5 py-2 flex-row items-center gap-2">
                <Ionicons name="stats-chart" size={16} color="#16a34a" />
                <Text className="text-green-700 font-semibold text-sm">
                  ≈ {stablefordEstimate} Stableford points
                </Text>
              </View>
            )}
          </View>

          {/* Playing with */}
          <Input
            label="Playing with (optional)"
            placeholder="Names separated by commas"
            value={playedWith}
            onChangeText={setPlayedWith}
          />

          {/* Conditions */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-gray-700">Conditions</Text>
            <View className="flex-row gap-2">
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setConditions(conditions === c.key ? "" : c.key)}
                  className={`flex-1 py-2.5 rounded-xl items-center border ${
                    conditions === c.key
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text className="text-xl">{c.emoji}</Text>
                  <Text
                    className={`text-xs mt-0.5 ${
                      conditions === c.key ? "text-green-700 font-semibold" : "text-gray-500"
                    }`}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700">
              Notes (optional)
            </Text>
            <TextInput
              className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 min-h-20"
              value={notes}
              onChangeText={setNotes}
              placeholder="How did it go?"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <Button
            onPress={() => onNext({ grossScore, playedWith, conditions, notes })}
            disabled={!grossScore || isNaN(gross) || gross < 18}
            size="lg"
            className="mt-2 mb-8"
          >
            Review Round
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 3b: Full scorecard ──────────────────────────────────────────────────

function Step3Scorecard({
  format,
  handicap,
  onNext,
}: {
  format: Format;
  handicap: number | null;
  onNext: (data: {
    grossScore: string;
    holeScores: number[];
    playedWith: string;
    conditions: string;
    notes: string;
  }) => void;
}) {
  const [scores, setScores] = useState<(number | null)[]>(new Array(18).fill(null));
  const [playedWith, setPlayedWith] = useState("");
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");

  function updateScore(i: number, delta: number) {
    setScores((prev) => {
      const next = [...prev];
      const current = next[i] ?? STANDARD_PARS[i];
      next[i] = Math.max(1, current + delta);
      return next;
    });
  }

  const filledScores = scores.map((s, i) => s ?? STANDARD_PARS[i]);
  const total = filledScores.reduce((a, b) => a + b, 0);
  const playingHandicap = Math.round(handicap ?? 0);
  const stablefordTotal =
    format === "stableford"
      ? computeStableford(filledScores, STANDARD_PARS, playingHandicap)
      : null;

  const allEntered = scores.every((s) => s !== null);

  function handleNext() {
    onNext({
      grossScore: total.toString(),
      holeScores: filledScores,
      playedWith,
      conditions,
      notes,
    });
  }

  return (
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
      <View className="px-4 pt-4 gap-4">
        <Text className="text-xl font-bold text-gray-900">Scorecard</Text>

        {/* Running totals */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-green-600 rounded-xl p-3 items-center">
            <Text className="text-white text-2xl font-bold">{total}</Text>
            <Text className="text-green-200 text-xs">Gross</Text>
          </View>
          {stablefordTotal !== null && (
            <View className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 items-center">
              <Text className="text-green-700 text-2xl font-bold">{stablefordTotal}</Text>
              <Text className="text-green-500 text-xs">Stableford</Text>
            </View>
          )}
        </View>

        {/* Hole rows */}
        <Card>
          {/* Header */}
          <View className="flex-row px-3 py-2 border-b border-gray-100">
            <Text className="text-xs font-bold text-gray-400 w-8">Hole</Text>
            <Text className="text-xs font-bold text-gray-400 w-10">Par</Text>
            <Text className="text-xs font-bold text-gray-400 w-10">SI</Text>
            <Text className="text-xs font-bold text-gray-400 flex-1 text-center">Score</Text>
          </View>
          {STANDARD_PARS.map((par, i) => {
            const score = scores[i] ?? par;
            const diff = score - par;
            const diffColor =
              diff < 0
                ? "#16a34a"
                : diff === 0
                ? "#6b7280"
                : diff === 1
                ? "#3b82f6"
                : "#dc2626";
            return (
              <View
                key={i}
                className={`flex-row items-center px-3 py-2 ${
                  i < 17 ? "border-b border-gray-50" : ""
                } ${i === 8 ? "border-b-2 border-gray-200" : ""}`}
              >
                <Text className="text-sm font-bold text-gray-500 w-8">{i + 1}</Text>
                <Text className="text-sm text-gray-500 w-10">{par}</Text>
                <Text className="text-sm text-gray-400 w-10">{STANDARD_SI[i]}</Text>
                <View className="flex-1 flex-row items-center justify-center gap-3">
                  <TouchableOpacity
                    onPress={() => updateScore(i, -1)}
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                  >
                    <Ionicons name="remove" size={16} color="#6b7280" />
                  </TouchableOpacity>
                  <Text style={{ color: diffColor, fontWeight: "700", fontSize: 18, minWidth: 24, textAlign: "center" }}>
                    {score}
                  </Text>
                  <TouchableOpacity
                    onPress={() => updateScore(i, 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                  >
                    <Ionicons name="add" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </Card>

        {/* Playing with */}
        <Input
          label="Playing with (optional)"
          placeholder="Names separated by commas"
          value={playedWith}
          onChangeText={setPlayedWith}
        />

        {/* Conditions */}
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">Conditions</Text>
          <View className="flex-row gap-2">
            {CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c.key}
                onPress={() => setConditions(conditions === c.key ? "" : c.key)}
                className={`flex-1 py-2.5 rounded-xl items-center border ${
                  conditions === c.key
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <Text className="text-xl">{c.emoji}</Text>
                <Text className={`text-xs mt-0.5 ${conditions === c.key ? "text-green-700 font-semibold" : "text-gray-500"}`}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-gray-700">Notes (optional)</Text>
          <TextInput
            className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 min-h-20"
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it go?"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <Button onPress={handleNext} size="lg" className="mt-2 mb-8">
          Review Round
        </Button>
      </View>
    </ScrollView>
  );
}

// ─── Step 4: Review & Submit ──────────────────────────────────────────────────

function Step4Review({
  summary,
  onSubmit,
  submitting,
}: {
  summary: {
    courseName: string;
    date: string;
    tee: TeeColour;
    grossScore: string;
    courseRating: string;
    slopeRating: string;
    format: Format;
    handicap: number | null;
    holeScores?: number[];
  };
  onSubmit: () => void;
  submitting: boolean;
}) {
  const gross = parseInt(summary.grossScore, 10);
  const coursePar = 72;
  const playingHandicap = Math.round(summary.handicap ?? 0);
  const net = !isNaN(gross) ? gross - playingHandicap : null;

  const stableford =
    summary.format === "stableford" && !isNaN(gross)
      ? summary.holeScores
        ? computeStableford(summary.holeScores, STANDARD_PARS, playingHandicap)
        : computeStablefordQuick(gross, coursePar, playingHandicap)
      : null;

  const cr = parseFloat(summary.courseRating);
  const slope = parseFloat(summary.slopeRating);
  const diffPreview =
    !isNaN(gross) && !isNaN(cr) && !isNaN(slope)
      ? ((gross - cr) * (113 / slope)).toFixed(1)
      : null;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Course", value: summary.courseName || "—" },
    {
      label: "Date",
      value: new Date(summary.date).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    },
    { label: "Tees", value: summary.tee },
    { label: "Gross Score", value: summary.grossScore || "—" },
    ...(net !== null ? [{ label: "Net Score", value: net.toString() }] : []),
    ...(stableford !== null
      ? [{ label: "Stableford", value: `${stableford} pts` }]
      : []),
    ...(diffPreview !== null
      ? [{ label: "Differential (preview)", value: diffPreview }]
      : []),
    ...(summary.courseRating
      ? [
          { label: "Course Rating", value: summary.courseRating },
          { label: "Slope Rating", value: summary.slopeRating },
        ]
      : []),
  ];

  return (
    <ScrollView className="flex-1">
      <View className="px-4 pt-4 gap-4">
        <Text className="text-xl font-bold text-gray-900">Review</Text>

        <Card className="divide-y divide-gray-50">
          {rows.map((row) => (
            <View key={row.label} className="flex-row justify-between px-4 py-3 border-b border-gray-50">
              <Text className="text-sm text-gray-500">{row.label}</Text>
              <Text className="text-sm font-semibold text-gray-900">{row.value}</Text>
            </View>
          ))}
        </Card>

        <Button onPress={onSubmit} loading={submitting} size="lg">
          Submit Round
        </Button>

        <View className="items-center pb-8">
          <Text className="text-xs text-gray-400 text-center">
            This round will be submitted to your handicap record.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function NewRoundScreen() {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id ?? "";

  const handicap = useQuery(
    api.handicap.getLatest,
    userId ? { userId } : "skip"
  );

  const createRound = useMutation(api.rounds.create);

  const [step, setStep] = useState<Step>(1);

  // Collected data
  const [step1Data, setStep1Data] = useState<{
    club: GolfClub | null;
    courseNameFreetext: string;
    tee: TeeColour;
    courseRating: string;
    slopeRating: string;
    skipRatings: boolean;
  } | null>(null);

  const [step2Data, setStep2Data] = useState<{
    format: Format;
    entryMode: EntryMode;
    date: string;
  } | null>(null);

  const [step3Data, setStep3Data] = useState<{
    grossScore: string;
    holeScores?: number[];
    playedWith: string;
    conditions: string;
    notes: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  function handleStep1(data: NonNullable<typeof step1Data>) {
    setStep1Data(data);
    setStep(2);
  }

  function handleStep2(data: NonNullable<typeof step2Data>) {
    setStep2Data(data);
    setStep(3);
  }

  function handleStep3(data: NonNullable<typeof step3Data>) {
    setStep3Data(data);
    setStep(4);
  }

  async function handleSubmit() {
    if (!step1Data || !step2Data || !step3Data) return;
    setSubmitting(true);
    try {
      const gross = parseInt(step3Data.grossScore, 10);
      const cr = parseFloat(step1Data.courseRating);
      const slope = parseFloat(step1Data.slopeRating);

      await createRound({
        ...(step1Data.club ? { golfClubId: step1Data.club._id as any } : {}),
        courseNameFreetext: step1Data.courseNameFreetext,
        tees: step1Data.tee,
        ...(!step1Data.skipRatings && !isNaN(cr) ? { courseRating: cr } : {}),
        ...(!step1Data.skipRatings && !isNaN(slope) ? { slopeRating: slope } : {}),
        grossScore: gross,
        ...(step3Data.holeScores ? { holeScores: step3Data.holeScores } : {}),
        date: step2Data.date,
        ...(step3Data.playedWith.trim()
          ? {
              playedWith: step3Data.playedWith
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        isCountingRound: !step1Data.skipRatings,
        ...(step3Data.conditions ? { conditions: step3Data.conditions } : {}),
        ...(step3Data.notes ? { notes: step3Data.notes } : {}),
      });

      Alert.alert(
        "Round Logged!",
        "Your round has been saved. Your handicap index will update shortly.",
        [
          {
            text: "View Rounds",
            onPress: () => router.replace("/(app)/rounds"),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save round. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function goBack() {
    if (step > 1) setStep((s) => (s - 1) as Step);
    else router.back();
  }

  const totalSteps = step2Data?.entryMode === "full" ? 4 : 4;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Log New Round",
          headerLeft: () => (
            <TouchableOpacity onPress={goBack} className="ml-1">
              <Ionicons name="chevron-back" size={24} color="#166534" />
            </TouchableOpacity>
          ),
        }}
      />
      <View className="flex-1 bg-gray-50">
        <StepIndicator current={step} total={totalSteps} />
        {step === 1 && <Step1Course onNext={handleStep1} />}
        {step === 2 && <Step2Format onNext={handleStep2} />}
        {step === 3 && step2Data?.entryMode === "quick" && (
          <Step3Quick
            format={step2Data.format}
            handicap={handicap ?? null}
            coursePar={72}
            onNext={handleStep3}
          />
        )}
        {step === 3 && step2Data?.entryMode === "full" && (
          <Step3Scorecard
            format={step2Data.format}
            handicap={handicap ?? null}
            onNext={handleStep3}
          />
        )}
        {step === 4 && step1Data && step2Data && step3Data && (
          <Step4Review
            summary={{
              courseName: step1Data.courseNameFreetext,
              date: step2Data.date,
              tee: step1Data.tee,
              grossScore: step3Data.grossScore,
              courseRating: step1Data.courseRating,
              slopeRating: step1Data.slopeRating,
              format: step2Data.format,
              handicap: handicap ?? null,
              holeScores: step3Data.holeScores,
            }}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}
      </View>
    </>
  );
}
