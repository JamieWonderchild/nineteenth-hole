/**
 * CoursePickerSheet
 *
 * A full-screen modal for searching the global golf course database and
 * selecting a tee set. Returns everything the caller needs for WHS calc
 * and per-hole scoring.
 *
 * Usage:
 *   <CoursePickerSheet
 *     visible={showPicker}
 *     onClose={() => setShowPicker(false)}
 *     onSelect={(sel) => { setCourse(sel); setShowPicker(false); }}
 *   />
 */

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useQuery } from "convex/react";
import { api } from "../lib/convex";
import { useDistanceUnit } from "../hooks/useDistanceUnit";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CourseHole {
  number: number;
  par: number;
  strokeIndex: number;
  yards?: number;
  meters?: number;
}

export interface CourseSelection {
  golfCourseId: string;
  teeId: string;
  courseName: string;
  venueName?: string;
  teeName: string;
  teeColour: string;
  gender: string;
  courseRating?: number;
  slopeRating?: number;
  par: number;
  totalYards?: number;
  totalMeters?: number;
  holes: CourseHole[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (selection: CourseSelection) => void;
  /** Optional country filter — omit to search all countries */
  country?: string;
}

// ── Tee colour → display hex ──────────────────────────────────────────────────

const TEE_HEX: Record<string, string> = {
  white: "#f9fafb",
  yellow: "#fbbf24",
  red: "#ef4444",
  blue: "#3b82f6",
  black: "#111827",
  gold: "#d97706",
  silver: "#9ca3af",
  green: "#16a34a",
  other: "#6b7280",
};

function TeeCircle({ colour }: { colour: string }) {
  const bg = TEE_HEX[colour] ?? TEE_HEX.other;
  const border = colour === "white" ? "#d1d5db" : bg;
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor: border,
      }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CoursePickerSheet({ visible, onClose, onSelect, country }: Props) {
  const { fmtTotal } = useDistanceUnit();
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const [showAllTees, setShowAllTees] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ensureDetail = useAction(api.golfCourses.ensureDetail);

  const searchResults = useQuery(
    api.golfCourses.search,
    debouncedQuery.length >= 2
      ? { query: debouncedQuery, country, limit: 15 }
      : "skip"
  );

  const courseWithTees = useQuery(
    api.golfCourses.getWithTees,
    selectedCourseId ? { courseId: selectedCourseId as any } : "skip"
  );

  // Debounce search input
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(rawQuery), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [rawQuery]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setRawQuery("");
      setDebouncedQuery("");
      setSelectedCourseId(null);
      setFetchingDetail(false);
      setShowAllTees(false);
    }
  }, [visible]);

  // Lazy-fetch tees if the course has none yet
  useEffect(() => {
    if (!courseWithTees || courseWithTees.tees.length > 0 || fetchingDetail) return;
    setFetchingDetail(true);
    ensureDetail({ courseId: selectedCourseId as any })
      .finally(() => setFetchingDetail(false));
  }, [courseWithTees?.tees.length, selectedCourseId]);

  const isSearching = debouncedQuery.length >= 2 && searchResults === undefined;

  function handleSelectCourse(courseId: string) {
    setSelectedCourseId(courseId);
  }

  function handleSelectTee(tee: any) {
    if (!courseWithTees) return;
    onSelect({
      golfCourseId: courseWithTees._id,
      teeId: tee._id,
      courseName: courseWithTees.name,
      venueName: courseWithTees.venueName,
      teeName: tee.name,
      teeColour: tee.colour,
      gender: tee.gender,
      courseRating: tee.courseRating,
      slopeRating: tee.slopeRating,
      par: tee.par,
      totalYards: tee.totalYards,
      totalMeters: tee.totalMeters,
      holes: courseWithTees.clubCourseHoles ?? tee.holes ?? [],
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity
            onPress={selectedCourseId ? () => setSelectedCourseId(null) : onClose}
            className="mr-3 p-1"
          >
            <Ionicons
              name={selectedCourseId ? "arrow-back" : "close"}
              size={22}
              color="#374151"
            />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-gray-900 flex-1">
            {selectedCourseId ? "Select tees" : "Search courses"}
          </Text>
        </View>

        {/* Phase 1: Course search */}
        {!selectedCourseId && (
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                gap: 8,
              }}>
                <Ionicons name="search" size={18} color="#9ca3af" />
                <TextInput
                  style={{ flex: 1, fontSize: 16, color: "#111827" }}
                  placeholder="e.g. Finchley Golf Club"
                  placeholderTextColor="#9ca3af"
                  value={rawQuery}
                  onChangeText={setRawQuery}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {rawQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setRawQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {isSearching && (
              <View className="items-center py-8">
                <ActivityIndicator color="#16a34a" />
              </View>
            )}

            {!isSearching && debouncedQuery.length >= 2 && searchResults?.length === 0 && (
              <View className="items-center py-12 px-6">
                <Ionicons name="golf-outline" size={40} color="#d1d5db" />
                <Text className="text-gray-500 mt-3 text-center text-sm">
                  No courses found for "{debouncedQuery}"
                </Text>
                <Text className="text-gray-400 text-xs text-center mt-1">
                  The database is growing — try a shorter name or different spelling
                </Text>
              </View>
            )}

            {debouncedQuery.length < 2 && (
              <View className="items-center py-12 px-6">
                <Ionicons name="search-outline" size={40} color="#d1d5db" />
                <Text className="text-gray-400 text-sm text-center mt-3">
                  Type at least 2 characters to search
                </Text>
              </View>
            )}

            {searchResults && searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item: any) => item._id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }: { item: any }) => (
                  <TouchableOpacity
                    onPress={() => handleSelectCourse(item._id)}
                    className="flex-row items-center px-4 py-3.5 border-b border-gray-50"
                  >
                    <View className="w-8 h-8 rounded-full bg-green-50 items-center justify-center mr-3">
                      <Ionicons name="golf" size={16} color="#16a34a" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-gray-900">{item.name}</Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {[item.venueName, item.city, item.county]
                          .filter(v => v && v !== "0")
                          .join(" · ")}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}

        {/* Phase 2: Tee selection */}
        {selectedCourseId && (
          <View className="flex-1">
            {courseWithTees === undefined && (
              <View className="items-center py-8">
                <ActivityIndicator color="#16a34a" />
              </View>
            )}

            {courseWithTees && (
              <>
                {/* Course summary */}
                <View className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <Text className="text-base font-semibold text-gray-900">
                    {courseWithTees.name}
                  </Text>
                  {courseWithTees.venueName && (
                    <Text className="text-xs text-gray-500 mt-0.5">
                      {courseWithTees.venueName}
                    </Text>
                  )}
                  <Text className="text-xs text-gray-400 mt-0.5">
                    {[courseWithTees.city, courseWithTees.county]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                </View>

                {courseWithTees.tees.length === 0 && (
                  <View className="items-center py-12 px-6">
                    {fetchingDetail ? (
                      <>
                        <ActivityIndicator color="#16a34a" />
                        <Text className="text-gray-500 text-sm text-center mt-3">
                          Fetching tee data…
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="information-circle-outline" size={40} color="#d1d5db" />
                        <Text className="text-gray-500 text-sm text-center mt-3">
                          No tee data available for this course
                        </Text>
                      </>
                    )}
                  </View>
                )}

                {courseWithTees.tees.length > 0 && (() => {
                  const allTees: any[] = courseWithTees.tees;

                  // Pick the "back" men's tee (highest CR among male/both)
                  const mensTees = allTees.filter((t: any) => t.gender === "male" || t.gender === "both");
                  const backTee = mensTees.sort((a: any, b: any) =>
                    (b.courseRating ?? b.totalYards ?? 0) - (a.courseRating ?? a.totalYards ?? 0)
                  )[0];

                  // Pick the ladies' / forward tee (highest CR among female, fallback to lowest CR)
                  const ladiesTees = allTees.filter((t: any) => t.gender === "female");
                  const forwardTee = ladiesTees.length > 0
                    ? ladiesTees.sort((a: any, b: any) => (b.courseRating ?? 0) - (a.courseRating ?? 0))[0]
                    : allTees.sort((a: any, b: any) => (a.courseRating ?? a.totalYards ?? 99) - (b.courseRating ?? b.totalYards ?? 99))[0];

                  const featuredIds = [backTee?._id, forwardTee?._id].filter(Boolean);
                  const remainingCount = allTees.filter((t: any) => !featuredIds.includes(t._id)).length;
                  const visibleTees = showAllTees ? allTees : allTees.filter((t: any) => featuredIds.includes(t._id));

                  const TeeRow = ({ tee }: { tee: any }) => (
                    <TouchableOpacity
                      onPress={() => handleSelectTee(tee)}
                      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f9fafb" }}
                    >
                      <TeeCircle colour={tee.colour} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
                            {tee.name}
                          </Text>
                          {tee._id === backTee?._id && !showAllTees && (
                            <View style={{ backgroundColor: "#dcfce7", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 11, color: "#16a34a", fontWeight: "600" }}>Men's</Text>
                            </View>
                          )}
                          {tee._id === forwardTee?._id && !showAllTees && (
                            <View style={{ backgroundColor: "#fef9c3", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 11, color: "#854d0e", fontWeight: "600" }}>Forward</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: "row", gap: 12, marginTop: 3 }}>
                          {tee.par && <Text style={{ fontSize: 12, color: "#6b7280" }}>Par {tee.par}</Text>}
                          {fmtTotal(tee.totalYards, tee.totalMeters) && (
                            <Text style={{ fontSize: 12, color: "#6b7280" }}>{fmtTotal(tee.totalYards, tee.totalMeters)}</Text>
                          )}
                          {tee.courseRating && (
                            <Text style={{ fontSize: 12, color: "#6b7280" }}>CR {tee.courseRating} / S {tee.slopeRating}</Text>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                    </TouchableOpacity>
                  );

                  return (
                    <>
                      <Text style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontSize: 11, fontWeight: "500", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Select tees
                      </Text>
                      {visibleTees.map((tee: any) => <TeeRow key={tee._id} tee={tee} />)}
                      {!showAllTees && remainingCount > 0 && (
                        <TouchableOpacity
                          onPress={() => setShowAllTees(true)}
                          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, gap: 6 }}
                        >
                          <Text style={{ fontSize: 13, color: "#16a34a", fontWeight: "600" }}>
                            More tees ({remainingCount})
                          </Text>
                          <Ionicons name="chevron-down" size={14} color="#16a34a" />
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
