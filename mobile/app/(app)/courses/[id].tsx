import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useAction } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../lib/convex";
import { LoadingSpinner, Badge, SectionHeader } from "../../../components/ui";

// ── Tee colour helpers ────────────────────────────────────────────────────────

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

const TEE_ORDER_MALE = ["white", "yellow", "blue", "black"];
const TEE_ORDER_FEMALE = ["red", "gold"];

function TeeCircle({ colour, size = 20 }: { colour: string; size?: number }) {
  const bg = TEE_HEX[colour] ?? TEE_HEX.other;
  const border = colour === "white" ? "#d1d5db" : bg;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor: border,
      }}
    />
  );
}

function sortTees(tees: any[]): any[] {
  const male = tees.filter((t) => t.gender === "male" || t.gender === "both");
  const female = tees.filter((t) => t.gender === "female");

  function orderIndex(tee: any, order: string[]) {
    const idx = order.indexOf(tee.colour);
    return idx === -1 ? order.length : idx;
  }

  male.sort((a, b) => orderIndex(a, TEE_ORDER_MALE) - orderIndex(b, TEE_ORDER_MALE));
  female.sort((a, b) => orderIndex(a, TEE_ORDER_FEMALE) - orderIndex(b, TEE_ORDER_FEMALE));

  return [...male, ...female];
}

// ── Tee row ───────────────────────────────────────────────────────────────────

function TeeRow({ tee, expanded, onPress }: { tee: any; expanded: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-3.5 border-b border-gray-100 ${expanded ? "bg-green-50" : "bg-white"}`}
    >
      <View className="flex-row items-center gap-3">
        <TeeCircle colour={tee.colour} />
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-semibold text-gray-900">{tee.name}</Text>
            {tee.gender !== "both" && (
              <View className="bg-gray-100 rounded-full px-2 py-0.5">
                <Text className="text-xs text-gray-500 capitalize">{tee.gender}</Text>
              </View>
            )}
          </View>
          <View className="flex-row gap-3 mt-0.5 flex-wrap">
            {tee.courseRating && (
              <Text className="text-xs text-gray-500">CR {tee.courseRating}</Text>
            )}
            {tee.slopeRating && (
              <Text className="text-xs text-gray-500">Slope {tee.slopeRating}</Text>
            )}
            {tee.par && (
              <Text className="text-xs text-gray-500">Par {tee.par}</Text>
            )}
            {tee.totalYards && (
              <Text className="text-xs text-gray-500">{tee.totalYards} yds</Text>
            )}
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color="#9ca3af"
        />
      </View>

      {expanded && (
        <View className="mt-3 ml-8 gap-2">
          {tee.holes && tee.holes.length > 0 && (
            <View>
              <Text className="text-xs font-medium text-gray-500 mb-1.5">Holes</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {tee.holes.map((hole: any) => (
                  <View
                    key={hole.number}
                    className="bg-white border border-gray-200 rounded-lg px-2 py-1 items-center"
                    style={{ minWidth: 44 }}
                  >
                    <Text className="text-xs text-gray-400">H{hole.number}</Text>
                    <Text className="text-xs font-semibold text-gray-800">P{hole.par}</Text>
                    {hole.yards && (
                      <Text className="text-xs text-gray-400">{hole.yards}y</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ── Playing Handicap Calculator ───────────────────────────────────────────────

function HandicapCalculator({ tees, coursePar }: { tees: any[]; coursePar?: number }) {
  const [handicapInput, setHandicapInput] = useState("");

  const teesWithRatings = tees.filter((t) => t.courseRating && t.slopeRating && t.par);
  const handicapIndex = parseFloat(handicapInput);
  const validIndex = !isNaN(handicapIndex) && handicapInput.length > 0;

  function calcPlayingHandicap(tee: any): number {
    const par = tee.par ?? coursePar ?? 72;
    return Math.round(handicapIndex * (tee.slopeRating / 113) + (tee.courseRating - par));
  }

  return (
    <View>
      <View className="px-4 pt-5 pb-2">
        <SectionHeader title="Playing Handicap" />
      </View>
      <View className="bg-white mx-4 rounded-xl border border-gray-100 overflow-hidden">
        <View className="px-4 py-3 border-b border-gray-100">
          <Text className="text-xs text-gray-500 mb-1.5">Your handicap index</Text>
          <TextInput
            className="text-base text-gray-900 font-semibold"
            placeholder="e.g. 14.5"
            placeholderTextColor="#9ca3af"
            value={handicapInput}
            onChangeText={setHandicapInput}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />
        </View>

        {teesWithRatings.length === 0 ? (
          <View className="px-4 py-4">
            <Text className="text-sm text-gray-400">No rating data available</Text>
          </View>
        ) : validIndex ? (
          sortTees(teesWithRatings).map((tee) => (
            <View
              key={tee._id}
              className="flex-row items-center px-4 py-3 border-b border-gray-50"
            >
              <TeeCircle colour={tee.colour} size={16} />
              <Text className="text-sm text-gray-700 ml-2 flex-1">{tee.name}</Text>
              <Text className="text-sm font-bold text-green-700">
                {calcPlayingHandicap(tee)}
              </Text>
            </View>
          ))
        ) : (
          <View className="px-4 py-4">
            <Text className="text-sm text-gray-400">
              Enter your handicap index above to see playing handicaps for each tee
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Round History ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RoundHistorySection({
  userId,
  courseId,
  router,
}: {
  userId: string;
  courseId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const rounds = useQuery(
    api.golfCourses.listRoundsForCourse,
    userId && courseId ? { userId, courseId: courseId as any } : "skip"
  );

  if (!rounds || rounds.length === 0) return null;

  return (
    <View>
      <View className="px-4 pt-5 pb-2">
        <SectionHeader title="Your rounds here" />
      </View>
      <View className="bg-white mx-4 rounded-xl border border-gray-100 overflow-hidden">
        {rounds.map((round: any) => (
          <TouchableOpacity
            key={round._id}
            onPress={() => router.push(`/(app)/rounds/${round._id}` as any)}
            className="flex-row items-center px-4 py-3.5 border-b border-gray-50"
          >
            <View className="flex-1">
              <Text className="text-xs text-gray-400">{formatDate(round.date)}</Text>
              <View className="flex-row items-center gap-1.5 mt-1">
                <View className="bg-gray-100 rounded-full px-2 py-0.5">
                  <Text className="text-xs text-gray-600 font-medium">
                    {round.grossScore} gross
                  </Text>
                </View>
                {round.stablefordPoints !== undefined && (
                  <View className="bg-green-100 rounded-full px-2 py-0.5">
                    <Text className="text-xs text-green-700 font-medium">
                      {round.stablefordPoints} pts
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id ?? "";

  const [expandedTeeId, setExpandedTeeId] = useState<string | null>(null);

  const courseWithTees = useQuery(
    api.golfCourses.getWithTees,
    id ? { courseId: id as any } : "skip"
  );

  const ensureDetail = useAction(api.golfCourses.ensureDetail);
  const [fetchingDetail, setFetchingDetail] = useState(false);

  // Lazy-fetch tees if none available
  useEffect(() => {
    if (!courseWithTees || courseWithTees.tees.length > 0 || fetchingDetail) return;
    setFetchingDetail(true);
    ensureDetail({ courseId: id as any }).finally(() => setFetchingDetail(false));
  }, [courseWithTees?.tees.length, id]);

  if (courseWithTees === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Course", headerBackTitle: "Courses" }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  if (courseWithTees === null) {
    return (
      <>
        <Stack.Screen options={{ title: "Course", headerBackTitle: "Courses" }} />
        <View className="flex-1 items-center justify-center bg-gray-50 px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
          <Text className="text-lg font-semibold text-gray-700 mt-3 text-center">
            Course not found
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-5 bg-green-600 rounded-full px-6 py-3"
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const course = courseWithTees;
  const tees = sortTees(course.tees ?? []);
  const defaultPar = tees[0]?.par ?? course.par;

  return (
    <>
      <Stack.Screen
        options={{
          title: course.name,
          headerBackTitle: "Courses",
          headerStyle: { backgroundColor: "#14532d" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700", color: "#fff" },
        }}
      />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Hero header */}
        <View
          style={{ backgroundColor: "#14532d" }}
          className="px-5 pt-4 pb-7"
        >
          <Text className="text-2xl font-bold text-white mb-0.5" numberOfLines={2}>
            {course.name}
          </Text>
          {course.venueName && course.venueName !== course.name && (
            <Text className="text-green-300 text-sm mb-0.5">{course.venueName}</Text>
          )}
          {(course.city || course.county) && (
            <Text className="text-green-400 text-xs mb-3">
              {[course.city, course.county].filter(Boolean).join(", ")}
            </Text>
          )}

          <View className="flex-row items-center gap-2 flex-wrap">
            {course.courseType && (
              <View className="bg-white/20 rounded-full px-3 py-1">
                <Text className="text-white text-xs font-medium capitalize">
                  {course.courseType}
                </Text>
              </View>
            )}
            {(defaultPar || course.holes) && (
              <View className="bg-white/10 rounded-full px-3 py-1">
                <Text className="text-green-200 text-xs">
                  {[
                    defaultPar ? `Par ${defaultPar}` : null,
                    course.holes ? `${course.holes} holes` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Tee Sets */}
        <View>
          <View className="px-4 pt-5 pb-2">
            <SectionHeader title="Tee Sets" />
          </View>
          <View className="bg-white border-t border-b border-gray-100">
            {tees.length === 0 ? (
              <View className="px-4 py-8 items-center">
                {fetchingDetail ? (
                  <LoadingSpinner />
                ) : (
                  <Text className="text-sm text-gray-400 text-center">
                    No tee data available for this course
                  </Text>
                )}
              </View>
            ) : (
              tees.map((tee) => (
                <TeeRow
                  key={tee._id}
                  tee={tee}
                  expanded={expandedTeeId === tee._id}
                  onPress={() =>
                    setExpandedTeeId(expandedTeeId === tee._id ? null : tee._id)
                  }
                />
              ))
            )}
          </View>
        </View>

        {/* Handicap Calculator */}
        <HandicapCalculator tees={tees} coursePar={defaultPar} />

        {/* Round History */}
        {userId ? (
          <RoundHistorySection
            userId={userId}
            courseId={id ?? ""}
            router={router}
          />
        ) : null}

        {/* Info section */}
        {(course.website || course.phone) && (
          <View>
            <View className="px-4 pt-5 pb-2">
              <SectionHeader title="Info" />
            </View>
            <View className="bg-white mx-4 rounded-xl border border-gray-100 overflow-hidden">
              {course.website && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(course.website)}
                  className="flex-row items-center px-4 py-3.5 border-b border-gray-50"
                >
                  <Ionicons name="globe-outline" size={18} color="#16a34a" />
                  <Text className="text-sm text-green-700 ml-3 flex-1" numberOfLines={1}>
                    {course.website.replace(/^https?:\/\//, "")}
                  </Text>
                  <Ionicons name="open-outline" size={14} color="#9ca3af" />
                </TouchableOpacity>
              )}
              {course.phone && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${course.phone}`)}
                  className="flex-row items-center px-4 py-3.5"
                >
                  <Ionicons name="call-outline" size={18} color="#16a34a" />
                  <Text className="text-sm text-green-700 ml-3 flex-1">{course.phone}</Text>
                  <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Start a round CTA */}
        <View className="px-4 pt-6">
          <TouchableOpacity
            onPress={() =>
              router.push(`/(app)/rounds/new?courseId=${id}` as any)
            }
            className="bg-green-600 rounded-2xl py-4 items-center"
            style={{
              shadowColor: "#16a34a",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 5,
            }}
            activeOpacity={0.85}
          >
            <Text className="text-white font-bold text-base">Start a Round Here</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}
