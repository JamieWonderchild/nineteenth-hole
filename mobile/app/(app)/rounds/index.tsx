import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  HandicapBadge,
  StatRow,
  SectionHeader,
  EmptyState,
  LoadingSpinner,
  Card,
  Badge,
} from "../../../components/ui";
import { api } from "../../../lib/convex";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Simple sparkline: array of heights (0–1 normalised), rendered as vertical bars
function HandicapSparkline({ history }: { history: Array<{ handicapIndex: number }> }) {
  if (!history || history.length < 2) return null;

  const values = history.map((h) => h.handicapIndex);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const barHeight = 40;

  return (
    <View className="mt-4">
      <Text className="text-xs text-green-200 mb-2 uppercase tracking-widest">
        Trend (last {values.length})
      </Text>
      <View className="flex-row items-end gap-1" style={{ height: barHeight }}>
        {values.map((v, i) => {
          const normalised = (v - min) / range;
          // Lower handicap = better = taller bar in green
          const heightPx = Math.max(4, (1 - normalised) * barHeight);
          const isLast = i === values.length - 1;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: heightPx,
                borderRadius: 2,
                backgroundColor: isLast ? "#ffffff" : "rgba(255,255,255,0.4)",
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function DifferentialChip({
  differential,
  handicap,
}: {
  differential?: number;
  handicap?: number | null;
}) {
  if (differential === undefined || differential === null) return null;
  const isGood = handicap === null || handicap === undefined || differential <= handicap;
  return (
    <View
      className={`rounded-full px-2 py-0.5 ${
        isGood ? "bg-green-100" : "bg-red-100"
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          isGood ? "text-green-700" : "text-red-700"
        }`}
      >
        {differential.toFixed(1)}
      </Text>
    </View>
  );
}

type Round = {
  _id: string;
  date: string;
  courseNameFreetext?: string;
  grossScore: number;
  stablefordPoints?: number;
  netScore?: number;
  differential?: number;
  attestationStatus?: string;
  markerName?: string;
};

function RoundRow({
  round,
  handicap,
  onPress,
}: {
  round: Round;
  handicap: number | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white border-b border-gray-100 px-4 py-3.5 flex-row items-center"
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-xs text-gray-400 font-medium">
          {formatDate(round.date)}
        </Text>
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {round.courseNameFreetext ?? "Course"}
        </Text>
        <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
          <Badge variant="muted">{round.grossScore} gross</Badge>
          {round.stablefordPoints !== undefined && (
            <Badge variant="success">{round.stablefordPoints} pts</Badge>
          )}
          {round.netScore !== undefined && round.stablefordPoints === undefined && (
            <Badge variant="default">Net {round.netScore}</Badge>
          )}
          <DifferentialChip
            differential={round.differential}
            handicap={handicap}
          />
          {round.attestationStatus === "pending" && (
            <Badge variant="warning">Pending</Badge>
          )}
          {round.attestationStatus === "confirmed" && (
            <Badge variant="success">Attested</Badge>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
    </Pressable>
  );
}

export default function RoundsScreen() {
  const { user } = useUser();
  const router = useRouter();
  const userId = user?.id ?? "";

  const handicap = useQuery(
    api.handicap.getLatest,
    userId ? { userId } : "skip"
  );
  const handicapHistory = useQuery(
    api.handicap.getHistory,
    userId ? { userId, limit: 10 } : "skip"
  );
  const rounds = useQuery(api.rounds.list, userId ? { userId } : "skip");
  const stats = useQuery(
    api.rounds.getStats,
    userId ? { userId } : "skip"
  );
  const inProgress = useQuery(api.rounds.getInProgress);

  const isLoading =
    handicap === undefined ||
    rounds === undefined ||
    stats === undefined;

  const roundCount = rounds?.length ?? 0;
  const needsMoreRounds = roundCount < 3;

  // Determine direction from handicap history
  let direction: "up" | "down" | "same" | undefined;
  if (handicapHistory && handicapHistory.length >= 2) {
    const latest = handicapHistory[handicapHistory.length - 1]?.handicapIndex;
    const prev = handicapHistory[handicapHistory.length - 2]?.handicapIndex;
    if (latest !== undefined && prev !== undefined) {
      direction =
        latest < prev ? "down" : latest > prev ? "up" : "same";
    }
  }

  const statItems = [
    { label: "Rounds", value: stats?.totalRounds ?? roundCount },
    {
      label: "Avg Score",
      value: stats?.avgGross ? stats.avgGross.toFixed(1) : "–",
    },
    {
      label: "Best Score",
      value: stats?.bestGross ?? "–",
    },
  ];

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Rounds & Handicap",
            headerRight: () => (
              <Pressable
                onPress={() => {
                  if (inProgress) {
                    Alert.alert(
                      "Round in progress",
                      "Finish or cancel your current round before starting a new one.",
                      [
                        { text: "Resume", onPress: () => router.push(`/(app)/rounds/score?roundId=${inProgress._id}` as any) },
                        { text: "OK", style: "cancel" },
                      ]
                    );
                    return;
                  }
                  router.push("/(app)/rounds/new");
                }}
                className="mr-2"
              >
                <Ionicons name="add" size={26} color="#166634" />
              </Pressable>
            ),
          }}
        />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Rounds & Handicap",
          headerRight: () => (
            <Pressable
              onPress={() => {
                if (inProgress) {
                  Alert.alert(
                    "Round in progress",
                    "Finish or cancel your current round before starting a new one.",
                    [
                      { text: "Resume", onPress: () => router.push(`/(app)/rounds/score?roundId=${inProgress._id}` as any) },
                      { text: "OK", style: "cancel" },
                    ]
                  );
                  return;
                }
                router.push("/(app)/rounds/new");
              }}
              className="mr-2"
            >
              <Ionicons name="add" size={26} color="#166634" />
            </Pressable>
          ),
        }}
      />
      <FlatList
        className="flex-1 bg-gray-50"
        data={rounds ?? []}
        keyExtractor={(item: Round) => item._id}
        ListHeaderComponent={
          <View>
            {/* In-progress round banner */}
            {inProgress && (
              <View className="px-4 pt-4 pb-0">
                <TouchableOpacity
                  onPress={() => router.push(`/(app)/rounds/score?roundId=${inProgress._id}` as any)}
                  activeOpacity={0.85}
                  className="flex-row items-center gap-3 bg-green-600 rounded-2xl px-4 py-3.5 mb-1"
                  style={{
                    shadowColor: "#16a34a",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                    elevation: 4,
                  }}
                >
                  <View className="w-9 h-9 rounded-full bg-white/20 items-center justify-center shrink-0">
                    <Ionicons name="golf" size={18} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-bold text-sm">Round in progress</Text>
                    <Text className="text-green-200 text-xs mt-0.5" numberOfLines={1}>
                      {inProgress.courseNameFreetext ?? "Golf course"} · {inProgress.holeScores?.length ?? 0}/18 holes
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-green-200 text-xs font-medium">Resume</Text>
                    <Ionicons name="chevron-forward" size={14} color="#86efac" />
                  </View>
                </TouchableOpacity>
              </View>
            )}
            {/* Hero: Handicap card */}
            <View className="px-4 pt-5 pb-4">
              <View className="bg-green-600 rounded-2xl p-6">
                <HandicapBadge
                  index={handicap ?? null}
                  direction={direction}
                  size="lg"
                />
                {handicapHistory && handicapHistory.length >= 2 && (
                  <HandicapSparkline history={handicapHistory} />
                )}
              </View>
            </View>

            {/* Stats row */}
            {!needsMoreRounds && (
              <View className="mx-4 mb-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <StatRow stats={statItems} />
              </View>
            )}

            {/* Empty state for <3 rounds */}
            {needsMoreRounds && (
              <View className="px-4 mb-4">
                <View className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex-row gap-3">
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color="#d97706"
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-amber-800">
                      {3 - roundCount} more round
                      {3 - roundCount !== 1 ? "s" : ""} needed
                    </Text>
                    <Text className="text-xs text-amber-700 mt-0.5 leading-4">
                      WHS requires 3 submitted rounds to calculate your
                      handicap index.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Section header */}
            <View className="px-4 mb-1">
              <SectionHeader
                title="My Rounds"
                action={{
                  label: "+ New",
                  onPress: () => {
                    if (inProgress) {
                      Alert.alert(
                        "Round in progress",
                        "Finish or cancel your current round before starting a new one.",
                        [
                          { text: "Resume", onPress: () => router.push(`/(app)/rounds/score?roundId=${inProgress._id}` as any) },
                          { text: "OK", style: "cancel" },
                        ]
                      );
                      return;
                    }
                    router.push("/(app)/rounds/new");
                  },
                }}
              />
            </View>
          </View>
        }
        renderItem={({ item }: { item: Round }) => (
          <RoundRow
            round={item}
            handicap={handicap ?? null}
            onPress={() => router.push(`/(app)/rounds/${item._id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="golf-outline"
            title="No rounds logged yet"
            description="Log your first 3 rounds to unlock your WHS handicap index."
            action={{
              label: "Log your first round",
              onPress: () => router.push("/(app)/rounds/new"),
            }}
          />
        }
        contentContainerStyle={
          (rounds ?? []).length === 0 ? { flexGrow: 1 } : { paddingBottom: 32 }
        }
      />
    </>
  );
}
