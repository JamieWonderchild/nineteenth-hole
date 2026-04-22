import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { api } from "../../lib/convex";
import { HandicapBadge, Card, Badge, LoadingSpinner } from "../../components/ui";

// ── Recent Courses pill strip ─────────────────────────────────────────────────

function RecentCoursesStrip({
  userId,
  router,
}: {
  userId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const recentCourses = useQuery(
    api.golfCourses.listRecentByUser,
    userId ? { userId, limit: 6 } : "skip"
  );

  if (!recentCourses || recentCourses.length === 0) return null;

  return (
    <View className="px-5 mb-5">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-bold text-gray-900">Recent Courses</Text>
        <TouchableOpacity onPress={() => router.push("/(app)/courses" as any)}>
          <Text className="text-green-600 font-medium text-sm">Browse</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 px-5"
      >
        <View className="flex-row gap-2.5">
          {recentCourses.map((course: any) => (
            <TouchableOpacity
              key={course._id}
              onPress={() => router.push(`/(app)/courses/${course._id}` as any)}
              activeOpacity={0.75}
              className="bg-white border border-gray-100 rounded-xl px-3 py-2.5"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
                maxWidth: 160,
              }}
            >
              <View className="flex-row items-center gap-1.5 mb-0.5">
                <Ionicons name="golf" size={12} color="#16a34a" />
                <Text className="text-xs text-green-700 font-semibold">Course</Text>
              </View>
              <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                {course.name}
              </Text>
              {course.county && (
                <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
                  {course.county}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")}${suffix}`;
}

// ── Club Member Home ──────────────────────────────────────────────────────────

function ClubMemberHome({
  greeting,
  firstName,
  userId,
  handicap,
  rounds,
  club,
  membership,
  refreshing,
  onRefresh,
  router,
}: {
  greeting: string;
  firstName: string;
  userId: string;
  handicap: number | null | undefined;
  rounds: any[] | undefined;
  club: any;
  membership: any;
  refreshing: boolean;
  onRefresh: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const activeComps = useQuery(
    api.competitions.listActiveForClub,
    club?._id ? { clubId: club._id } : "skip"
  );
  const myBookings = useQuery(
    api.teeTimes.listMyBookings,
    club?._id && userId ? { clubId: club._id, userId } : "skip"
  );

  const nextComp = activeComps?.[0] ?? null;
  const nextBooking = myBookings?.[0] ?? null;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />
      }
    >
      {/* Hero header */}
      <View
        className="px-5 pb-6"
        style={{
          backgroundColor: "#fff",
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <View className="flex-row items-start justify-between mb-5">
          <View>
            <Text className="text-sm text-gray-400 font-medium mb-0.5">{greeting}</Text>
            <Text className="text-3xl font-bold text-gray-900">{firstName}</Text>
          </View>
          <View className="items-end">
            {handicap !== undefined && handicap !== null ? (
              <>
                <View className="w-14 h-14 rounded-full bg-green-600 items-center justify-center mb-0.5"
                  style={{
                    shadowColor: "#16a34a",
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Text className="text-white font-bold text-xl">{handicap.toFixed(1)}</Text>
                </View>
                <Text className="text-xs text-gray-400">Handicap</Text>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => router.push("/(app)/rounds/new")}
                className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 items-center"
              >
                <Ionicons name="add-circle-outline" size={18} color="#16a34a" />
                <Text className="text-green-700 text-xs font-semibold mt-0.5">Log round</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Club banner */}
        <View
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "#15803d",
            shadowColor: "#166534",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 5,
          }}
        >
          <TouchableOpacity
            onPress={() => router.push("/(app)/club" as any)}
            activeOpacity={0.9}
          >
            {/* Club name bar */}
            <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-white/10">
              <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center mr-2.5">
                <Ionicons name="golf-outline" size={17} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-base">{club.name}</Text>
                <Text className="text-green-300 text-xs capitalize">{membership.role}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="text-green-300 text-xs">View club</Text>
                <Ionicons name="chevron-forward" size={13} color="#86efac" />
              </View>
            </View>

            {/* Stats row */}
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => router.push("/(app)/club/competitions" as any)}
                className="flex-1 px-4 py-3.5"
                activeOpacity={0.75}
              >
                <View className="flex-row items-center gap-1.5 mb-1.5">
                  <Ionicons name="trophy-outline" size={14} color="#86efac" />
                  <Text className="text-green-300 text-xs font-medium uppercase tracking-wide">Competition</Text>
                </View>
                <Text className="text-white font-semibold text-sm" numberOfLines={1}>
                  {activeComps === undefined ? "Loading…" : nextComp ? nextComp.name : "None today"}
                </Text>
                {nextComp && (
                  <View className="mt-1">
                    <Badge variant="success">
                      <Text className="text-green-800 text-xs">Live</Text>
                    </Badge>
                  </View>
                )}
              </TouchableOpacity>

              <View className="w-px bg-white/10 my-3" />

              <TouchableOpacity
                onPress={() => router.push("/(app)/club/tee-times" as any)}
                className="flex-1 px-4 py-3.5"
                activeOpacity={0.75}
              >
                <View className="flex-row items-center gap-1.5 mb-1.5">
                  <Ionicons name="calendar-outline" size={14} color="#86efac" />
                  <Text className="text-green-300 text-xs font-medium uppercase tracking-wide">Tee Time</Text>
                </View>
                <Text className="text-white font-semibold text-sm" numberOfLines={1}>
                  {myBookings === undefined
                    ? "Loading…"
                    : nextBooking
                    ? formatTime(nextBooking.time)
                    : "None booked"}
                </Text>
                {nextBooking && (
                  <Text className="text-green-300 text-xs mt-0.5">{formatDate(nextBooking.date)}</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* In-progress round */}
      <InProgressRoundBanner router={router} />

      {/* Quick Game */}
      <View className="px-5 mt-5 mb-5">
        <TouchableOpacity
          onPress={() => router.push("/(app)/play/games/new")}
          activeOpacity={0.85}
          className="flex-row items-center gap-3.5 bg-white rounded-2xl p-4 border border-gray-100"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View className="w-12 h-12 rounded-full bg-green-600 items-center justify-center"
            style={{
              shadowColor: "#16a34a",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.4,
              shadowRadius: 6,
            }}
          >
            <Ionicons name="play" size={20} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-900 font-bold text-base">Start a Quick Game</Text>
            <Text className="text-gray-400 text-xs mt-0.5">Skins, Stableford, Nassau & more</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      {/* Pending attestation requests */}
      <PendingAttestationsCard router={router} />

      {/* Recent Courses */}
      <RecentCoursesStrip userId={userId} router={router} />

      {/* Recent Rounds */}
      <View className="px-5">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-gray-900">Recent Rounds</Text>
          <TouchableOpacity onPress={() => router.push("/(app)/rounds")}>
            <Text className="text-green-600 font-medium text-sm">See all</Text>
          </TouchableOpacity>
        </View>

        {rounds === undefined ? (
          <View className="py-6 items-center"><LoadingSpinner /></View>
        ) : rounds.length === 0 ? (
          <TouchableOpacity
            onPress={() => router.push("/(app)/rounds/new")}
            className="bg-white rounded-2xl p-5 border border-dashed border-gray-200 items-center gap-2"
          >
            <Ionicons name="golf-outline" size={28} color="#d1d5db" />
            <Text className="text-gray-400 text-sm">No rounds yet — tap to log one</Text>
          </TouchableOpacity>
        ) : (
          rounds.slice(0, 2).map((round: any) => (
            <TouchableOpacity
              key={round._id}
              onPress={() => router.push(`/(app)/rounds/${round._id}`)}
              activeOpacity={0.7}
              className="mb-2.5 bg-white rounded-2xl p-4 border border-gray-100 flex-row items-center"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <View className="flex-1">
                <Text className="text-xs text-gray-400 mb-0.5">{formatDate(round.date)}</Text>
                <Text className="font-semibold text-gray-900" numberOfLines={1}>
                  {round.courseNameFreetext ?? "Course"}
                </Text>
                <View className="flex-row items-center gap-1.5 mt-1.5">
                  <View className="bg-gray-100 rounded-full px-2 py-0.5">
                    <Text className="text-xs text-gray-600 font-medium">{round.grossScore} gross</Text>
                  </View>
                  {round.stablefordPoints !== undefined && (
                    <View className="bg-green-100 rounded-full px-2 py-0.5">
                      <Text className="text-xs text-green-700 font-medium">{round.stablefordPoints} pts</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#e5e7eb" />
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ── In-Progress Round Banner ──────────────────────────────────────────────────

function InProgressRoundBanner({ router }: { router: ReturnType<typeof useRouter> }) {
  const round = useQuery(api.rounds.getInProgress);
  if (!round) return null;

  const holesScored = round.holeScores?.length ?? 0;
  const courseName = round.courseNameFreetext ?? "Golf course";

  return (
    <View className="px-5 mt-4">
      <TouchableOpacity
        onPress={() => router.push(`/(app)/rounds/score?roundId=${round._id}` as any)}
        activeOpacity={0.85}
        className="flex-row items-center gap-3 bg-green-600 rounded-2xl px-4 py-3.5"
        style={{
          shadowColor: "#16a34a",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 4,
        }}
      >
        <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center shrink-0">
          <Ionicons name="golf" size={20} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className="text-white font-bold text-sm">Round in progress</Text>
          <Text className="text-green-200 text-xs mt-0.5" numberOfLines={1}>
            {courseName} · {holesScored}/18 holes
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-green-200 text-xs font-medium">Resume</Text>
          <Ionicons name="chevron-forward" size={14} color="#86efac" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Pending Attestations Card ─────────────────────────────────────────────────

function PendingAttestationsCard({ router }: { router: ReturnType<typeof useRouter> }) {
  const pending = useQuery(api.rounds.pendingAttestations);
  const attest = useMutation(api.rounds.attest);

  if (!pending || pending.length === 0) return null;

  function handleAttest(roundId: string, decision: "confirmed" | "rejected") {
    const verb = decision === "confirmed" ? "confirm" : "reject";
    Alert.alert(
      decision === "confirmed" ? "Confirm score?" : "Reject score?",
      decision === "confirmed"
        ? "This will count towards their handicap index."
        : "This round will not count towards their handicap.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: decision === "confirmed" ? "Confirm" : "Reject",
          style: decision === "rejected" ? "destructive" : "default",
          onPress: () =>
            attest({ roundId: roundId as any, decision }).catch((e: any) =>
              Alert.alert("Error", e?.message ?? "Failed to attest round")
            ),
        },
      ]
    );
  }

  return (
    <View className="px-5 mt-4">
      <View className="flex-row items-center gap-2 mb-2">
        <Ionicons name="shield-checkmark-outline" size={16} color="#d97706" />
        <Text className="text-sm font-bold text-amber-700">Attestation requests</Text>
      </View>
      {pending.map((round: any) => (
        <View
          key={round._id}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-2"
        >
          <Text className="text-xs text-amber-600 mb-0.5">Score to attest</Text>
          <Text className="font-semibold text-gray-900" numberOfLines={1}>
            {round.courseNameFreetext ?? "Golf course"}
          </Text>
          <Text className="text-xs text-gray-500 mb-3">
            {new Date(round.date + "T00:00:00").toLocaleDateString("en-GB", {
              weekday: "short", day: "numeric", month: "short",
            })} · {round.grossScore} gross
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => handleAttest(round._id, "confirmed")}
              className="flex-1 bg-green-600 rounded-xl py-2.5 items-center"
            >
              <Text className="text-white font-semibold text-sm">Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleAttest(round._id, "rejected")}
              className="flex-1 bg-white border border-gray-200 rounded-xl py-2.5 items-center"
            >
              <Text className="text-gray-600 font-semibold text-sm">Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Individual Home ───────────────────────────────────────────────────────────

function IndividualHome({
  greeting,
  firstName,
  userId,
  handicap,
  rounds,
  refreshing,
  onRefresh,
  router,
}: {
  greeting: string;
  firstName: string;
  userId: string;
  handicap: number | null | undefined;
  rounds: any[] | undefined;
  refreshing: boolean;
  onRefresh: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const roundCount = rounds?.length ?? 0;
  const roundsNeeded = Math.max(0, 3 - roundCount);
  const hasHandicap = handicap !== null && handicap !== undefined;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />
      }
    >
      {/* Hero header */}
      <View
        className="px-5 pb-6"
        style={{
          backgroundColor: "#fff",
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <View className="flex-row items-center justify-between mb-5">
          <View>
            <Text className="text-sm text-gray-400 font-medium mb-0.5">{greeting}</Text>
            <Text className="text-2xl font-bold text-gray-900">{firstName}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(app)/rounds" as any)}
            className="items-center"
          >
            <Text className="text-xs text-gray-400 mb-1 uppercase tracking-wide font-medium">
              Handicap
            </Text>
            <View
              style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: hasHandicap ? "#16a34a" : "#f3f4f6",
                alignItems: "center", justifyContent: "center",
                shadowColor: hasHandicap ? "#16a34a" : "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: hasHandicap ? 0.35 : 0.08,
                shadowRadius: 8, elevation: 4,
              }}
            >
              {hasHandicap ? (
                <Text className="text-white font-bold text-lg">{handicap!.toFixed(1)}</Text>
              ) : (
                <Text className="text-gray-400 font-bold text-lg">–</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Handicap hero card */}
        {hasHandicap ? (
          <TouchableOpacity
            onPress={() => router.push("/(app)/rounds/new" as any)}
            activeOpacity={0.88}
            className="rounded-2xl p-5 flex-row items-center justify-between"
            style={{
              backgroundColor: "#16a34a",
              shadowColor: "#16a34a",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 14,
              elevation: 6,
            }}
          >
            <View>
              <Text className="text-green-200 text-xs font-medium mb-1 uppercase tracking-wide">
                WHS Handicap Index
              </Text>
              <Text className="text-white text-4xl font-bold">{handicap!.toFixed(1)}</Text>
              <Text className="text-green-300 text-xs mt-1">Updated automatically · Tap to log a round</Text>
            </View>
            <View className="w-14 h-14 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="add" size={28} color="#fff" />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push("/(app)/rounds/new" as any)}
            activeOpacity={0.88}
            className="rounded-2xl p-5 items-center"
            style={{
              backgroundColor: "#16a34a",
              shadowColor: "#16a34a",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 14,
              elevation: 6,
            }}
          >
            <Text className="text-green-200 text-xs font-medium mb-3 uppercase tracking-wide">
              WHS Handicap Index
            </Text>
            {/* Progress dots */}
            <View className="flex-row gap-2 mb-3">
              {[0, 1, 2].map(i => (
                <View
                  key={i}
                  style={{
                    width: 28, height: 8, borderRadius: 4,
                    backgroundColor: i < roundCount ? "#fff" : "rgba(255,255,255,0.25)",
                  }}
                />
              ))}
            </View>
            <Text className="text-white text-xl font-bold text-center">
              {roundsNeeded === 0
                ? "Calculating your handicap…"
                : `${roundsNeeded} more round${roundsNeeded !== 1 ? "s" : ""} to go`}
            </Text>
            <Text className="text-green-300 text-xs mt-1 text-center">
              Log {roundsNeeded > 0 ? `${roundsNeeded} more` : "rounds"} with course & slope data for your official WHS index
            </Text>
            <View className="mt-4 bg-white/20 rounded-xl py-2.5 px-6 flex-row items-center gap-2">
              <Ionicons name="add" size={16} color="#fff" />
              <Text className="text-white font-semibold text-sm">Log a Round</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* In-progress round */}
      <InProgressRoundBanner router={router} />

      {/* Pending attestation requests */}
      <PendingAttestationsCard router={router} />

      {/* Recent Courses */}
      <RecentCoursesStrip userId={userId} router={router} />

      {/* Recent Rounds */}
      <View className="px-5 mt-5 mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-gray-900">Recent Rounds</Text>
          <TouchableOpacity onPress={() => router.push("/(app)/rounds" as any)}>
            <Text className="text-green-600 font-medium text-sm">See all</Text>
          </TouchableOpacity>
        </View>

        {rounds === undefined ? (
          <View className="py-8 items-center"><LoadingSpinner /></View>
        ) : rounds.length === 0 ? (
          <TouchableOpacity
            onPress={() => router.push("/(app)/rounds/new" as any)}
            className="bg-white rounded-2xl p-5 border border-dashed border-gray-200 items-center gap-2"
          >
            <Ionicons name="golf-outline" size={28} color="#d1d5db" />
            <Text className="text-gray-400 text-sm">No rounds yet — tap to log one</Text>
          </TouchableOpacity>
        ) : (
          <>
            {rounds.map((round: any) => (
              <TouchableOpacity
                key={round._id}
                onPress={() => router.push(`/(app)/rounds/${round._id}` as any)}
                activeOpacity={0.7}
                className="mb-2.5 bg-white rounded-2xl p-4 border border-gray-100 flex-row items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View className="flex-1">
                  <Text className="text-xs text-gray-400 mb-0.5">{formatDate(round.date)}</Text>
                  <Text className="font-semibold text-gray-900" numberOfLines={1}>
                    {round.courseNameFreetext ?? "Course"}
                  </Text>
                  <View className="flex-row items-center gap-1.5 mt-1.5">
                    <View className="bg-gray-100 rounded-full px-2 py-0.5">
                      <Text className="text-xs text-gray-600 font-medium">{round.grossScore} gross</Text>
                    </View>
                    {round.differential !== undefined && (
                      <View className="bg-blue-50 rounded-full px-2 py-0.5">
                        <Text className="text-xs text-blue-600 font-medium">
                          {round.differential > 0 ? "+" : ""}{round.differential?.toFixed(1)} diff
                        </Text>
                      </View>
                    )}
                    {round.stablefordPoints !== undefined && (
                      <View className="bg-green-100 rounded-full px-2 py-0.5">
                        <Text className="text-xs text-green-700 font-medium">{round.stablefordPoints} pts</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#e5e7eb" />
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>

      {/* Quick Games — secondary */}
      <View className="px-5 mb-4">
        <TouchableOpacity
          onPress={() => router.push("/(app)/play/games/new" as any)}
          activeOpacity={0.85}
          className="flex-row items-center gap-3 bg-white rounded-2xl p-4 border border-gray-100"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center">
            <Ionicons name="flash-outline" size={20} color="#d97706" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 text-sm">Quick Games</Text>
            <Text className="text-xs text-gray-400 mt-0.5">Skins · Stableford · Nassau · more</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      {/* Club upsell */}
      <View className="px-5">
        <TouchableOpacity
          activeOpacity={0.8}
          className="bg-white rounded-2xl p-4 border border-gray-100 flex-row items-center gap-3"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
          }}
        >
          <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center">
            <Ionicons name="people-outline" size={20} color="#16a34a" />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 text-sm">Bring your club</Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              Competitions, tee times & messaging — together.
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const userId = user?.id ?? "";
  const handicap = useQuery(api.handicap.getLatest, userId ? { userId } : "skip");
  const rounds = useQuery(api.rounds.list, userId ? { userId, limit: 3 } : "skip");
  const myClubs = useQuery(api.clubMembers.myActiveClubs, userId ? {} : "skip");

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const firstName = user?.firstName ?? user?.username ?? "Golfer";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (rounds === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <LoadingSpinner fullScreen />
      </SafeAreaView>
    );
  }

  const firstClub = myClubs && myClubs.length > 0 ? myClubs[0] : null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {firstClub ? (
        <ClubMemberHome
          greeting={greeting}
          firstName={firstName}
          userId={userId}
          handicap={handicap}
          rounds={rounds}
          club={firstClub.club}
          membership={firstClub.membership}
          refreshing={refreshing}
          onRefresh={onRefresh}
          router={router}
        />
      ) : (
        <IndividualHome
          greeting={greeting}
          firstName={firstName}
          userId={userId}
          handicap={handicap}
          rounds={rounds}
          refreshing={refreshing}
          onRefresh={onRefresh}
          router={router}
        />
      )}
    </SafeAreaView>
  );
}
