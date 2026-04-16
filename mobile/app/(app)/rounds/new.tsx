import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/convex";
import { Button, Input, Card, Badge } from "../../../components/ui";
import { CoursePickerSheet, CourseSelection, CourseHole } from "../../../components/CoursePickerSheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;
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
  playingHandicap: number,
  strokeIndexes: number[] = STANDARD_SI
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

type Step1Data = {
  golfCourseId?: string;
  teeId?: string;
  courseName: string;
  tee: string;
  courseRating: string;
  slopeRating: string;
  skipRatings: boolean;
  holes?: CourseHole[];
  par?: number;
};

const TEE_HEX_MAP: Record<string, string> = {
  white: "#f9fafb", yellow: "#fbbf24", red: "#ef4444",
  blue: "#3b82f6", black: "#111827", gold: "#d97706",
  silver: "#9ca3af", green: "#16a34a", other: "#6b7280",
};

function Step1Course({ onNext, initialCourseId }: {
  onNext: (data: Step1Data) => void;
  initialCourseId?: string;
}) {
  const preloadedCourse = useQuery(
    api.golfCourses.getWithTees,
    initialCourseId ? { courseId: initialCourseId as any } : "skip"
  );

  const [showPicker, setShowPicker] = useState(false);
  const [courseSelection, setCourseSelection] = useState<CourseSelection | null>(null);
  const [freetext, setFreetext] = useState("");
  const [useFreetext, setUseFreetext] = useState(false);
  const [freeTee, setFreeTee] = useState<TeeColour>("Yellow");
  const [courseRating, setCourseRating] = useState("");
  const [slopeRating, setSlopeRating] = useState("");
  const [skipRatings, setSkipRatings] = useState(false);

  const hasRatings = courseSelection
    ? !!(courseSelection.courseRating && courseSelection.slopeRating)
    : !!(courseRating && slopeRating);

  const canAdvance = useFreetext ? freetext.trim().length > 0 : courseSelection !== null;

  function handleNext() {
    if (courseSelection) {
      onNext({
        golfCourseId: courseSelection.golfCourseId,
        teeId: courseSelection.teeId,
        courseName: courseSelection.venueName
          ? `${courseSelection.venueName} — ${courseSelection.courseName}`
          : courseSelection.courseName,
        tee: courseSelection.teeName,
        courseRating: skipRatings ? "" : (courseSelection.courseRating?.toString() ?? ""),
        slopeRating: skipRatings ? "" : (courseSelection.slopeRating?.toString() ?? ""),
        skipRatings,
        holes: courseSelection.holes,
        par: courseSelection.par,
      });
    } else {
      onNext({
        courseName: freetext,
        tee: freeTee,
        courseRating: skipRatings ? "" : courseRating,
        slopeRating: skipRatings ? "" : slopeRating,
        skipRatings,
      });
    }
  }

  // ── Pre-loaded course tee picker (when arriving from course detail) ──────
  if (initialCourseId && preloadedCourse !== null && !useFreetext) {
    const course = preloadedCourse;
    const tees = course
      ? [...(course.tees ?? [])].sort((a: any, b: any) => {
          const ga = a.gender === "female" ? 1 : 0;
          const gb = b.gender === "female" ? 1 : 0;
          if (ga !== gb) return ga - gb;
          return (b.totalYards ?? -1) - (a.totalYards ?? -1);
        })
      : [];

    return (
      <>
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="px-4 pt-4 gap-4">
            <Text className="text-xl font-bold text-gray-900">Choose Tee</Text>

            {/* Course name chip */}
            {course && (
              <View className="flex-row items-center bg-green-50 border border-green-200 rounded-xl px-3 py-3 gap-2">
                <Ionicons name="golf" size={18} color="#16a34a" />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-green-900">{course.name}</Text>
                  {(course.city || course.county) && (
                    <Text className="text-xs text-green-600">
                      {[course.city, course.county].filter(Boolean).join(", ")}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Loading */}
            {!course && (
              <View className="py-6 items-center">
                <ActivityIndicator color="#16a34a" />
              </View>
            )}

            {/* Tee list */}
            {tees.length > 0 && (
              <View className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {tees.map((tee: any) => {
                  const isSelected = courseSelection?.teeId === tee._id;
                  return (
                    <TouchableOpacity
                      key={tee._id}
                      onPress={() => {
                        setCourseSelection({
                          golfCourseId: course!._id,
                          teeId: tee._id,
                          courseName: course!.name,
                          venueName: course!.venueName,
                          teeName: tee.name,
                          teeColour: tee.colour,
                          gender: tee.gender,
                          courseRating: tee.courseRating,
                          slopeRating: tee.slopeRating,
                          par: tee.par,
                          totalYards: tee.totalYards,
                          holes: tee.holes ?? [],
                        });
                      }}
                      className={`flex-row items-center px-4 py-3.5 border-b border-gray-50 ${isSelected ? "bg-green-50" : ""}`}
                    >
                      <View
                        style={{
                          width: 18, height: 18, borderRadius: 9,
                          backgroundColor: TEE_HEX_MAP[tee.colour] ?? TEE_HEX_MAP.other,
                          borderWidth: 1.5,
                          borderColor: tee.colour === "white" ? "#d1d5db" : (TEE_HEX_MAP[tee.colour] ?? TEE_HEX_MAP.other),
                          marginRight: 10,
                        }}
                      />
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-semibold text-gray-900">{tee.name}</Text>
                          <View className="bg-gray-100 rounded-full px-1.5 py-0.5">
                            <Text className="text-xs text-gray-500 capitalize">{tee.gender}</Text>
                          </View>
                        </View>
                        <Text className="text-xs text-gray-400 mt-0.5">
                          {[
                            tee.courseRating ? `CR ${tee.courseRating}` : null,
                            tee.slopeRating ? `Slope ${tee.slopeRating}` : null,
                            tee.par ? `Par ${tee.par}` : null,
                            tee.totalYards ? `${tee.totalYards} yds` : null,
                          ].filter(Boolean).join("  ·  ")}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color="#16a34a" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {tees.length === 0 && course && (
              <View className="bg-gray-50 rounded-xl px-4 py-5 items-center">
                <Text className="text-sm text-gray-400 text-center">
                  No tee data loaded yet — searching other courses instead
                </Text>
                <TouchableOpacity onPress={() => setShowPicker(true)} className="mt-3">
                  <Text className="text-green-600 font-medium text-sm">Search database →</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setSkipRatings(!skipRatings)}
              className="flex-row items-center gap-2"
            >
              <View className={`w-4 h-4 rounded border ${skipRatings ? "bg-gray-400 border-gray-400" : "border-gray-300"}`}>
                {skipRatings && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text className="text-sm text-gray-500">Skip ratings (round won't count to handicap)</Text>
            </TouchableOpacity>

            <Button
              onPress={handleNext}
              disabled={!courseSelection && !skipRatings}
              size="lg"
              className="mt-2 mb-8"
            >
              Continue
            </Button>
          </View>
        </ScrollView>
        <CoursePickerSheet
          visible={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={(sel) => { setCourseSelection(sel); setUseFreetext(false); setShowPicker(false); }}
        />
      </>
    );
  }

  return (
    <>
      <CoursePickerSheet
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(sel) => {
          setCourseSelection(sel);
          setUseFreetext(false);
          setShowPicker(false);
        }}
      />
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-4 gap-4">
          <Text className="text-xl font-bold text-gray-900">Course</Text>

          {!useFreetext ? (
            <View className="gap-2">
              {courseSelection ? (
                <View className="flex-row items-center bg-green-50 border border-green-200 rounded-xl px-3 py-3 gap-2">
                  <Ionicons name="golf" size={18} color="#16a34a" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-green-900">
                      {courseSelection.courseName}
                    </Text>
                    <Text className="text-xs text-green-700">
                      {courseSelection.teeName} tees · Par {courseSelection.par}
                      {courseSelection.totalYards ? ` · ${courseSelection.totalYards} yds` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setCourseSelection(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color="#16a34a" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowPicker(true)}
                  className="flex-row items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3.5"
                >
                  <Ionicons name="search-outline" size={20} color="#9ca3af" />
                  <View className="flex-1">
                    <Text className="text-sm text-gray-500">Search for a course</Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      2,000+ UK courses with ratings
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => { setUseFreetext(true); setCourseSelection(null); }}
              >
                <Text className="text-green-600 text-sm font-medium">
                  My course isn't listed →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-3">
              <Input
                label="Course name"
                placeholder="e.g. Millfield Golf Club"
                value={freetext}
                onChangeText={setFreetext}
              />
              {/* Manual tee colour when freetext */}
              <View className="gap-2">
                <Text className="text-sm font-medium text-gray-700">Tees</Text>
                <View className="flex-row gap-2">
                  {TEE_COLOURS.map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setFreeTee(t)}
                      className={`flex-1 py-2.5 rounded-xl items-center border-2 ${
                        freeTee === t ? "border-green-500" : "border-gray-200"
                      }`}
                      style={{ backgroundColor: freeTee === t ? "#f0fdf4" : "#f9fafb" }}
                    >
                      <View
                        className="w-5 h-5 rounded-full border border-gray-300 mb-1"
                        style={{ backgroundColor: TEE_HEX[t] }}
                      />
                      <Text
                        className={`text-xs font-medium ${
                          freeTee === t ? "text-green-700" : "text-gray-500"
                        }`}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity onPress={() => { setUseFreetext(false); setFreetext(""); }}>
                <Text className="text-green-600 text-sm font-medium">← Search instead</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ratings — auto-filled from DB, or manual entry for freetext */}
          {!skipRatings && (
            courseSelection?.courseRating ? (
              <View className="flex-row items-center gap-2 bg-green-50 rounded-xl px-3 py-2.5">
                <Ionicons name="checkmark-circle-outline" size={14} color="#16a34a" />
                <Text className="text-xs text-green-700">
                  CR {courseSelection.courseRating} / Slope {courseSelection.slopeRating} — auto-filled
                </Text>
              </View>
            ) : (
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
            )
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

          <Button onPress={handleNext} disabled={!canAdvance} size="lg" className="mt-2 mb-8">
            Continue
          </Button>
        </View>
      </ScrollView>
    </>
  );
}

// ─── Step 2: Format ───────────────────────────────────────────────────────────

function Step2Format({
  onNext,
}: {
  onNext: (data: { format: Format; entryMode: EntryMode; date: string }) => void;
}) {
  const [format, setFormat] = useState<Format>("stableford");
  const [entryMode, setEntryMode] = useState<EntryMode>("full");

  function handleFormatChange(f: Format) {
    setFormat(f);
    if (f === "stableford") setEntryMode("full");
  }
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
                onPress={() => handleFormatChange(f)}
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
              onPress={() => format === "strokeplay" && setEntryMode("quick")}
              disabled={format === "stableford"}
              className={`flex-1 py-3 px-2 rounded-xl items-center border-2 ${
                entryMode === "quick"
                  ? "border-green-500 bg-green-50"
                  : format === "stableford"
                  ? "border-gray-100 bg-gray-50 opacity-40"
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
                {format === "stableford" ? "Strokeplay only" : "Total score only"}
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
  holes: holesProp,
  onNext,
}: {
  format: Format;
  handicap: number | null;
  holes?: CourseHole[];
  onNext: (data: {
    grossScore: string;
    holeScores: number[];
    playedWith: string;
    conditions: string;
    notes: string;
  }) => void;
}) {
  // Use real course hole data when available, fall back to standard layout
  const pars = holesProp?.length === 18
    ? holesProp.map(h => h.par)
    : STANDARD_PARS;
  const strokeIndexes = holesProp?.length === 18
    ? holesProp.map(h => h.strokeIndex)
    : STANDARD_SI;

  const [scores, setScores] = useState<(number | null)[]>(new Array(18).fill(null));
  const [playedWith, setPlayedWith] = useState("");
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");

  function updateScore(i: number, delta: number) {
    setScores((prev) => {
      const next = [...prev];
      const current = next[i] ?? pars[i];
      next[i] = Math.max(1, current + delta);
      return next;
    });
  }

  const filledScores = scores.map((s, i) => s ?? pars[i]);
  const total = filledScores.reduce((a, b) => a + b, 0);
  const playingHandicap = Math.round(handicap ?? 0);
  const stablefordTotal =
    format === "stableford"
      ? computeStableford(filledScores, pars, playingHandicap, strokeIndexes)
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
          {pars.map((par, i) => {
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
                <Text className="text-sm text-gray-400 w-10">{strokeIndexes[i]}</Text>
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

// ─── Step 4: Marker selection ─────────────────────────────────────────────────

interface MarkerProfile {
  _id: string;
  userId: string;
  displayName: string;
  handicapIndex?: number;
}

function Step4Marker({
  onNext,
}: {
  onNext: (data: { markerId?: string; markerName?: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MarkerProfile | null>(null);

  const results = useQuery(
    api.golferProfiles.search,
    search.trim().length >= 2 ? { term: search } : "skip"
  ) as MarkerProfile[] | undefined;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-4 gap-5">
          <View>
            <Text className="text-xl font-bold text-gray-900">Add a Marker</Text>
            <Text className="text-sm text-gray-500 mt-1">
              Ask a playing partner to confirm your score. Attested rounds count toward your handicap index.
            </Text>
          </View>

          {selected ? (
            <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-green-600 items-center justify-center">
                <Text className="text-white font-bold text-base">
                  {selected.displayName[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-green-900 font-semibold">{selected.displayName}</Text>
                {selected.handicapIndex !== undefined && (
                  <Text className="text-green-600 text-xs">HCP {selected.handicapIndex.toFixed(1)}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close-circle" size={22} color="#16a34a" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Input
                label="Search by name"
                placeholder="e.g. Jamie"
                value={search}
                onChangeText={setSearch}
              />

              {results && results.length > 0 && (
                <View className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {results.map((p, i) => (
                    <TouchableOpacity
                      key={p._id}
                      onPress={() => { setSelected(p); setSearch(""); }}
                      className={`flex-row items-center px-4 py-3 gap-3 ${i > 0 ? "border-t border-gray-100" : ""}`}
                    >
                      <View className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
                        <Text className="text-gray-600 font-bold">
                          {p.displayName[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-gray-900 font-medium">{p.displayName}</Text>
                        {p.handicapIndex !== undefined && (
                          <Text className="text-gray-400 text-xs">HCP {p.handicapIndex.toFixed(1)}</Text>
                        )}
                      </View>
                      <Ionicons name="add-circle-outline" size={20} color="#16a34a" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {search.trim().length >= 2 && results !== undefined && results.length === 0 && (
                <Text className="text-gray-400 text-sm text-center">No players found</Text>
              )}
            </>
          )}

          <Button
            onPress={() =>
              onNext(selected ? { markerId: selected.userId, markerName: selected.displayName } : {})
            }
            size="lg"
            className="mt-2"
          >
            {selected ? "Continue" : "Skip — submit without marker"}
          </Button>

          <View className="items-center pb-8">
            <Text className="text-xs text-gray-400 text-center">
              Without a marker, this round is logged but won't update your handicap index.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Step 5: Review & Submit ──────────────────────────────────────────────────

function Step4Review({
  summary,
  onSubmit,
  submitting,
}: {
  summary: {
    courseName: string;
    date: string;
    tee: string;
    grossScore: string;
    courseRating: string;
    slopeRating: string;
    format: Format;
    handicap: number | null;
    holeScores?: number[];
    markerName?: string;
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
    { label: "Marker", value: summary.markerName ?? "None (won't count to handicap)" },
  ];

  return (
    <ScrollView className="flex-1">
      <View className="px-4 pt-4 gap-4">
        <Text className="text-xl font-bold text-gray-900">Review</Text>

        <Card className="divide-y divide-gray-50">
          {rows.map((row) => (
            <View key={row.label} className="flex-row justify-between px-4 py-3 border-b border-gray-50">
              <Text className="text-sm text-gray-500">{row.label}</Text>
              <Text className={`text-sm font-semibold ${row.label === "Marker" && !summary.markerName ? "text-amber-600" : "text-gray-900"}`}>
                {row.value}
              </Text>
            </View>
          ))}
        </Card>

        <Button onPress={onSubmit} loading={submitting} size="lg">
          Submit Round
        </Button>

        <View className="items-center pb-8">
          <Text className="text-xs text-gray-400 text-center">
            {summary.markerName
              ? `${summary.markerName} will receive a notification to confirm your score.`
              : "This round will be logged but won't count toward your handicap index without a marker."}
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
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();

  const handicap = useQuery(
    api.handicap.getLatest,
    userId ? { userId } : "skip"
  );

  const createRound = useMutation(api.rounds.create);

  const [step, setStep] = useState<Step>(1);

  // Collected data
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);

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

  const [step4Data, setStep4Data] = useState<{
    markerId?: string;
    markerName?: string;
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

  function handleStep4(data: { markerId?: string; markerName?: string }) {
    setStep4Data(data);
    setStep(5);
  }

  async function handleSubmit() {
    if (!step1Data || !step2Data || !step3Data) return;
    setSubmitting(true);
    try {
      const gross = parseInt(step3Data.grossScore, 10);
      const cr = parseFloat(step1Data.courseRating);
      const slope = parseFloat(step1Data.slopeRating);
      const hasMarker = !!step4Data?.markerId;

      await createRound({
        ...(step1Data.golfCourseId ? { golfCourseId: step1Data.golfCourseId as any } : {}),
        ...(step1Data.teeId ? { teeId: step1Data.teeId as any } : {}),
        courseNameFreetext: step1Data.courseName,
        tees: step1Data.tee,
        ...(!step1Data.skipRatings && !isNaN(cr) ? { courseRating: cr } : {}),
        ...(!step1Data.skipRatings && !isNaN(slope) ? { slopeRating: slope } : {}),
        grossScore: gross,
        ...(step3Data.holeScores ? { holeScores: step3Data.holeScores as any } : {}),
        date: step2Data.date,
        ...(step3Data.playedWith.trim()
          ? {
              playedWith: step3Data.playedWith
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        // Only count without marker if ratings were provided (handled by backend when marker present)
        isCountingRound: !step1Data.skipRatings,
        ...(step3Data.conditions ? { conditions: step3Data.conditions } : {}),
        ...(step3Data.notes ? { notes: step3Data.notes } : {}),
        ...(step4Data?.markerId ? { markerId: step4Data.markerId, markerName: step4Data.markerName } : {}),
      });

      Alert.alert(
        "Round Logged!",
        hasMarker
          ? `${step4Data?.markerName} has been notified to attest your score.`
          : "Your round has been saved.",
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

  const totalSteps = 5;

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
        {step === 1 && <Step1Course onNext={handleStep1} initialCourseId={courseId} />}
        {step === 2 && <Step2Format onNext={handleStep2} />}
        {step === 3 && step2Data?.entryMode === "quick" && (
          <Step3Quick
            format={step2Data.format}
            handicap={handicap ?? null}
            coursePar={step1Data?.par ?? 72}
            onNext={handleStep3}
          />
        )}
        {step === 3 && step2Data?.entryMode === "full" && (
          <Step3Scorecard
            format={step2Data.format}
            handicap={handicap ?? null}
            holes={step1Data?.holes}
            onNext={handleStep3}
          />
        )}
        {step === 4 && <Step4Marker onNext={handleStep4} />}
        {step === 5 && step1Data && step2Data && step3Data && (
          <Step4Review
            summary={{
              courseName: step1Data.courseName,
              date: step2Data.date,
              tee: step1Data.tee,
              grossScore: step3Data.grossScore,
              courseRating: step1Data.courseRating,
              slopeRating: step1Data.slopeRating,
              format: step2Data.format,
              handicap: handicap ?? null,
              holeScores: step3Data.holeScores,
              markerName: step4Data?.markerName,
            }}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}
      </View>
    </>
  );
}
