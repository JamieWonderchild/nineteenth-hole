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
import { PlayedWithPicker } from "../../../components/PlayedWithPicker";
import { useDistanceUnit, DistanceUnit } from "../../../hooks/useDistanceUnit";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;
type Format = "strokeplay" | "stableford";
type EntryMode = "quick" | "full" | "hole_by_hole";
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
  const { fmtTotal } = useDistanceUnit();
  const preloadedCourse = useQuery(
    api.golfCourses.getWithTees,
    initialCourseId ? { courseId: initialCourseId as any } : "skip"
  );

  const [showPicker, setShowPicker] = useState(false);
  const [showMoreTees, setShowMoreTees] = useState(false);
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
    const allTees = course
      ? [...(course.tees ?? [])].sort((a: any, b: any) => {
          const ga = a.gender === "female" ? 1 : 0;
          const gb = b.gender === "female" ? 1 : 0;
          if (ga !== gb) return ga - gb;
          const ay = a.totalYards ?? (a.totalMeters ? Math.round(a.totalMeters / 0.9144) : -1);
          const by = b.totalYards ?? (b.totalMeters ? Math.round(b.totalMeters / 0.9144) : -1);
          return by - ay;
        })
      : [];
    // Deduplicate by colour — HNA registers same physical tee twice (men's + women's rating).
    // Males sort first so the first occurrence of each colour = men's version.
    const seen = new Set<string>();
    const dedupedTees = allTees.filter(t => {
      const key = (t.colour ?? "").toLowerCase() || t.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const tees = showMoreTees ? allTees : dedupedTees;
    const hiddenTeeCount = allTees.length - dedupedTees.length;

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
                          holes: (course as any).clubCourseHoles ?? tee.holes ?? [],
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
                        </View>
                        <Text className="text-xs text-gray-400 mt-0.5">
                          {[
                            tee.courseRating ? `CR ${tee.courseRating}` : null,
                            tee.slopeRating ? `Slope ${tee.slopeRating}` : null,
                            tee.par ? `Par ${tee.par}` : null,
                            fmtTotal(tee.totalYards, tee.totalMeters),
                          ].filter(Boolean).join("  ·  ")}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color="#16a34a" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {hiddenTeeCount > 0 && (
              <TouchableOpacity
                onPress={() => setShowMoreTees(v => !v)}
                className="flex-row items-center justify-center py-2.5 gap-1.5"
              >
                <Text className="text-sm font-medium text-green-700">
                  {showMoreTees ? "Show fewer" : `Women's ratings (${hiddenTeeCount} more)`}
                </Text>
                <Ionicons name={showMoreTees ? "chevron-up" : "chevron-down"} size={14} color="#15803d" />
              </TouchableOpacity>
            )}

            {allTees.length === 0 && course && (
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
                      {fmtTotal(courseSelection.totalYards, courseSelection.totalMeters) ? ` · ${fmtTotal(courseSelection.totalYards, courseSelection.totalMeters)}` : ""}
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
                      UK & SA courses with ratings
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
  const [entryMode, setEntryMode] = useState<EntryMode>("hole_by_hole");
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
                entryMode === "quick" ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"
              }`}
            >
              <Ionicons name="calculator-outline" size={20} color={entryMode === "quick" ? "#16a34a" : "#9ca3af"} />
              <Text className={`text-xs font-semibold mt-1 ${entryMode === "quick" ? "text-green-700" : "text-gray-500"}`}>
                Quick
              </Text>
              <Text className="text-xs text-gray-400 text-center mt-0.5">Total score only</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEntryMode("hole_by_hole")}
              className={`flex-1 py-3 px-2 rounded-xl items-center border-2 ${
                entryMode === "hole_by_hole" ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"
              }`}
            >
              <Ionicons name="golf-outline" size={20} color={entryMode === "hole_by_hole" ? "#16a34a" : "#9ca3af"} />
              <Text className={`text-xs font-semibold mt-1 ${entryMode === "hole_by_hole" ? "text-green-700" : "text-gray-500"}`}>
                Hole by hole
              </Text>
              <Text className="text-xs text-gray-400 text-center mt-0.5">Per hole scores</Text>
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
    playedWith: string[];
    conditions: string;
    notes: string;
  }) => void;
}) {
  const [grossScore, setGrossScore] = useState("");
  const [playedWith, setPlayedWith] = useState<string[]>([]);
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
          <PlayedWithPicker players={playedWith} onChange={setPlayedWith} />

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

// ─── Step 3b: Hole scoring (hole-by-hole + scorecard, shared state) ───────────

function Step3HoleScoring({
  format,
  handicap,
  holes: holesProp,
  roundId,
  initialScores,
  startHole,
  onNext,
  distUnit,
  fmtDist,
}: {
  format: Format;
  handicap: number | null;
  holes?: CourseHole[];
  distUnit?: DistanceUnit;
  fmtDist?: (y?: number | null, m?: number | null) => string | null;
  roundId?: string;
  initialScores?: (number | null)[];
  startHole?: number;
  onNext: (data: { grossScore: string; holeScores: number[]; playedWith: string[]; conditions: string; notes: string }) => void;
}) {
  const saveHoleScore = useMutation(api.rounds.saveHoleScore);
  const pars = holesProp?.length === 18 ? holesProp.map(h => h.par) : STANDARD_PARS;
  const strokeIndexes = holesProp?.length === 18 ? holesProp.map(h => h.strokeIndex) : STANDARD_SI;

  const [viewMode, setViewMode] = useState<"hole_by_hole" | "scorecard">("hole_by_hole");
  const [scores, setScores] = useState<(number | null)[]>(initialScores ?? new Array(18).fill(null));
  const [currentHole, setCurrentHole] = useState(startHole ?? 0);
  const [showExtras, setShowExtras] = useState(false);
  const [playedWith, setPlayedWith] = useState<string[]>([]);
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");

  const playingHandicap = Math.round(handicap ?? 0);

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

  function handleSubmit() {
    const filled = scores.map((s, i) => s ?? pars[i]);
    const total = filled.reduce((a, b) => a + b, 0);
    onNext({ grossScore: total.toString(), holeScores: filled, playedWith, conditions, notes });
  }

  // ── Extras screen (shown after all holes scored) ─────────────────────────────
  if (showExtras) {
    const filled = scores.map((s, i) => s ?? pars[i]);
    const total = filled.reduce((a, b) => a + b, 0);
    const stablefordFinal = computeStableford(filled, pars, playingHandicap, strokeIndexes);
    return (
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
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
          <Button onPress={handleSubmit} size="lg" className="mb-8">Continue</Button>
        </View>
      </ScrollView>
    );
  }

  // ── View toggle ──────────────────────────────────────────────────────────────
  const viewToggle = (
    <View className="flex-row mx-4 mt-2 mb-1 bg-gray-100 rounded-xl p-1">
      {(["hole_by_hole", "scorecard"] as const).map(mode => (
        <TouchableOpacity
          key={mode}
          onPress={() => setViewMode(mode)}
          className={`flex-1 py-1.5 rounded-lg items-center ${viewMode === mode ? "bg-white" : ""}`}
        >
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
      <View className="flex-1">
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
            <Card>
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
            </Card>
            <Button onPress={() => setShowExtras(true)} size="lg">Continue</Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Hole-by-hole view ────────────────────────────────────────────────────────
  const par = pars[currentHole];
  const si = strokeIndexes[currentHole];
  const score = scores[currentHole];
  const shotsReceived = Math.floor(playingHandicap / 18) + (si <= (playingHandicap % 18) ? 1 : 0);
  const diff = score !== null ? score - par : null;
  const diffLabel = diff === null ? "" : diff === -2 ? "Eagle" : diff === -1 ? "Birdie" : diff === 0 ? "Par" : diff === 1 ? "Bogey" : diff === 2 ? "Double" : `+${diff}`;
  const diffColor = diff === null ? "#d1d5db" : diff < 0 ? "#16a34a" : diff === 0 ? "#6b7280" : diff === 1 ? "#3b82f6" : "#dc2626";
  const enteredTotal = scores.slice(0, currentHole + 1).reduce<number>((a, s) => a + (s ?? 0), 0);

  return (
    <View className="flex-1 bg-white">
      {viewToggle}
      {/* Progress bar — tappable to jump to hole */}
      <View className="flex-row px-4 pt-1 gap-1">
        {pars.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => setCurrentHole(i)} className="flex-1 py-1">
            <View className={`h-1.5 rounded-full ${i < currentHole ? "bg-green-500" : i === currentHole ? "bg-green-300" : "bg-gray-100"}`} />
          </TouchableOpacity>
        ))}
      </View>
      {/* Running total */}
      <View className="flex-row px-4 pt-2 pb-1 gap-3">
        <View className="flex-1 bg-green-600 rounded-xl px-3 py-2 items-center">
          <Text className="text-white text-lg font-bold">{enteredTotal > 0 ? enteredTotal : "—"}</Text>
          <Text className="text-green-200 text-xs">Gross · {currentHole + (score !== null ? 1 : 0)}/18</Text>
        </View>
        <View className="flex-1 bg-green-50 border border-green-200 rounded-xl px-3 py-2 items-center">
          <Text className="text-green-700 text-lg font-bold">{stablefordTotal}</Text>
          <Text className="text-green-500 text-xs">Stableford</Text>
        </View>
      </View>
      {/* Hole info */}
      <View className="flex-1 items-center justify-center px-8 gap-6">
        <View className="items-center gap-1">
          <Text className="text-5xl font-bold text-gray-900">Hole {currentHole + 1}</Text>
          <View className="flex-row gap-4 mt-1 flex-wrap justify-center">
            <Text className="text-base text-gray-500">Par {par}</Text>
            <Text className="text-base text-gray-400">SI {si}</Text>
            {fmtDist && holesProp?.[currentHole] && fmtDist(holesProp[currentHole].yards, holesProp[currentHole].meters) && (
              <Text className="text-base text-gray-400">{fmtDist(holesProp[currentHole].yards, holesProp[currentHole].meters)}</Text>
            )}
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
      {/* Navigation */}
      <View className="flex-row px-4 pb-6 gap-3">
        <TouchableOpacity onPress={() => currentHole > 0 && setCurrentHole(h => h - 1)}
          disabled={currentHole === 0}
          className={`flex-1 py-3.5 rounded-xl items-center border ${currentHole === 0 ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"}`}>
          <Text className={`font-semibold ${currentHole === 0 ? "text-gray-300" : "text-gray-700"}`}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            // Auto-save this hole to Convex before advancing
            if (roundId && score !== null) {
              saveHoleScore({
                roundId: roundId as any,
                hole: currentHole + 1,
                par,
                strokeIndex: si,
                score,
              }).catch(() => {}); // fire-and-forget
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
  required = false,
}: {
  onNext: (data: { markerId?: string; markerName?: string }) => void;
  required?: boolean;
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
              {required
                ? "This round counts toward your handicap. A marker must confirm your score."
                : "Ask a playing partner to confirm your score. Attested rounds count toward your handicap index."}
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
            disabled={required && !selected}
            size="lg"
            className="mt-2"
          >
            {selected ? "Continue" : required ? "Select a marker to continue" : "Skip — submit without marker"}
          </Button>

          {!required && (
            <View className="items-center pb-8">
              <Text className="text-xs text-gray-400 text-center">
                Without a marker, this round is logged but won't update your handicap index.
              </Text>
            </View>
          )}
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
    holePars?: number[];
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
        ? computeStableford(summary.holeScores, summary.holePars ?? STANDARD_PARS, playingHandicap)
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
  const { unit: distUnit, fmt: fmtDist } = useDistanceUnit();

  const handicap = useQuery(
    api.handicap.getLatest,
    userId ? { userId } : "skip"
  );

  const inProgressRound = useQuery(api.rounds.getInProgress);

  // If there's already a round in progress, go straight to it
  useEffect(() => {
    if (inProgressRound) {
      router.replace(`/(app)/rounds/score?roundId=${inProgressRound._id}` as any);
    }
  }, [inProgressRound?._id]);

  const createRound = useMutation(api.rounds.create);
  const startRoundMutation = useMutation(api.rounds.startRound);
  const completeRoundMutation = useMutation(api.rounds.completeRound);

  const [step, setStep] = useState<Step>(1);
  const [inProgressRoundId, setInProgressRoundId] = useState<string | null>(null);

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
    playedWith: string[];
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

  async function handleStep2(data: NonNullable<typeof step2Data>) {
    setStep2Data(data);
    if (data.entryMode === "hole_by_hole" && step1Data) {
      try {
        const roundId = await startRoundMutation({
          courseNameFreetext: step1Data.courseName,
          ...(step1Data.golfCourseId ? { golfCourseId: step1Data.golfCourseId as any } : {}),
          ...(step1Data.teeId ? { teeId: step1Data.teeId as any } : {}),
          tees: step1Data.tee,
          ...(!step1Data.skipRatings && step1Data.courseRating ? { courseRating: parseFloat(step1Data.courseRating) } : {}),
          ...(!step1Data.skipRatings && step1Data.slopeRating ? { slopeRating: parseFloat(step1Data.slopeRating) } : {}),
          date: data.date,
          format: data.format,
          isCountingRound: !step1Data.skipRatings,
        });
        setInProgressRoundId(roundId);
      } catch (e) {
        // non-fatal — round still works, just won't be resumable
      }
    }
    setStep(3);
  }

  function handleStep3(data: NonNullable<typeof step3Data>) {
    setStep3Data(data);
    // Skip marker step entirely if round doesn't count toward handicap
    setStep(step1Data?.skipRatings ? 5 : 4);
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

      // Hole-by-hole rounds use completeRound (the round is already started in Convex)
      if (step2Data.entryMode === "hole_by_hole" && inProgressRoundId && step3Data.holeScores) {
        await completeRoundMutation({
          roundId: inProgressRoundId as any,
          holeScores: step3Data.holeScores.map((score, i) => ({
            hole: i + 1,
            par: step1Data.holes?.[i]?.par ?? 4,
            strokeIndex: step1Data.holes?.[i]?.strokeIndex ?? (i + 1),
            score,
          })),
          ...(step3Data.playedWith.length > 0 ? { playedWith: step3Data.playedWith } : {}),
          ...(step3Data.conditions ? { conditions: step3Data.conditions } : {}),
          ...(step3Data.notes ? { notes: step3Data.notes } : {}),
          ...(step4Data?.markerId ? { markerId: step4Data.markerId, markerName: step4Data.markerName } : {}),
        });

        Alert.alert(
          "Round Complete!",
          hasMarker
            ? `${step4Data?.markerName} has been notified to attest your score.`
            : "Your round has been saved.",
          [{ text: "View Rounds", onPress: () => router.replace("/(app)/rounds") }]
        );
        return;
      }

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
        ...(step3Data.playedWith.length > 0 ? { playedWith: step3Data.playedWith } : {}),
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
    if (step === 5 && step1Data?.skipRatings) {
      setStep(3);
    } else if (step > 1) {
      setStep((s) => (s - 1) as Step);
    } else {
      router.back();
    }
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
        {step === 3 && step2Data?.entryMode === "hole_by_hole" && (
          <Step3HoleScoring
            format={step2Data.format}
            handicap={handicap ?? null}
            holes={step1Data?.holes}
            roundId={inProgressRoundId ?? undefined}
            onNext={handleStep3}
            distUnit={distUnit}
            fmtDist={fmtDist}
          />
        )}
        {step === 4 && <Step4Marker onNext={handleStep4} required={!step1Data?.skipRatings} />}
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
              holePars: step1Data.holes?.map(h => h.par),
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
