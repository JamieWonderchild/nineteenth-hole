import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { api } from "../../lib/convex";
import { HandicapBadge, Card, Badge, LoadingSpinner } from "../../components/ui";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function ConditionsIcon({ conditions }: { conditions?: string }) {
  const map: Record<string, string> = {
    dry: "☀️",
    overcast: "🌤",
    wet: "🌧",
    windy: "💨",
  };
  if (!conditions) return null;
  return <Text className="text-sm">{map[conditions] ?? ""}</Text>;
}

function RoundCard({
  round,
  onPress,
}: {
  round: {
    _id: string;
    date: string;
    courseNameFreetext?: string;
    golfClubId?: string;
    grossScore: number;
    stablefordPoints?: number;
    netScore?: number;
    differential?: number;
    previousHandicap?: number;
    tees?: string;
    conditions?: string;
  };
  onPress: () => void;
}) {
  const diffArrow =
    round.differential !== undefined && round.previousHandicap !== undefined
      ? round.differential < round.previousHandicap
        ? "↓"
        : round.differential > round.previousHandicap
        ? "↑"
        : "→"
      : null;
  const arrowColor =
    diffArrow === "↓" ? "#16a34a" : diffArrow === "↑" ? "#dc2626" : "#9ca3af";

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card className="p-4 mb-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 gap-0.5">
            <Text className="text-xs text-gray-400 font-medium">
              {formatDate(round.date)}
            </Text>
            <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
              {round.courseNameFreetext ?? "Course"}
            </Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Badge variant="muted">
                <Text className="text-xs text-gray-700">
                  {round.grossScore} gross
                </Text>
              </Badge>
              {round.stablefordPoints !== undefined && (
                <Badge variant="success">
                  <Text className="text-xs text-green-800">
                    {round.stablefordPoints} pts
                  </Text>
                </Badge>
              )}
              {round.netScore !== undefined && round.stablefordPoints === undefined && (
                <Badge variant="default">
                  <Text className="text-xs text-green-800">
                    Net {round.netScore}
                  </Text>
                </Badge>
              )}
            </View>
          </View>
          <View className="items-end gap-1">
            {diffArrow && (
              <Text style={{ color: arrowColor, fontSize: 18, fontWeight: "700" }}>
                {diffArrow}
              </Text>
            )}
            {round.differential !== undefined && (
              <Text className="text-xs text-gray-400">
                {round.differential.toFixed(1)} diff
              </Text>
            )}
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function InviteClubCard() {
  return (
    <Card className="p-5 mb-4 border-dashed border-green-200 bg-green-50">
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
          <Ionicons name="people-outline" size={20} color="#16a34a" />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-900 text-sm">
            Bring your club to The 19th Hole
          </Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            Competitions, leaderboards, and tee times — together.
          </Text>
        </View>
        <Ionicons name="arrow-forward-circle-outline" size={22} color="#16a34a" />
      </View>
    </Card>
  );
}

export default function HomeScreen() {
  const { user } = useUser();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const userId = user?.id ?? "";
  const handicap = useQuery(api.handicap.getLatest, userId ? { userId } : "skip");
  const rounds = useQuery(api.rounds.list, userId ? { userId, limit: 3 } : "skip");
  const profile = useQuery(api.golferProfiles.get, userId ? { userId } : "skip");

  const isLoading = handicap === undefined || rounds === undefined;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Convex reactivity handles re-fetches; just reset after a beat
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const firstName = user?.firstName ?? user?.username ?? "Golfer";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const hasNoClub = !profile?.homeClub;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#16a34a"
          />
        }
      >
        {/* Header */}
        <View className="px-4 pt-5 pb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-gray-500 font-medium">{greeting},</Text>
            <Text className="text-2xl font-bold text-gray-900">{firstName}</Text>
          </View>
          {isLoading ? (
            <LoadingSpinner />
          ) : handicap !== null && handicap !== undefined ? (
            <HandicapBadge index={handicap} size="sm" />
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/(app)/rounds/new")}
              className="bg-green-50 border border-green-200 rounded-full px-3 py-1.5 flex-row items-center gap-1"
            >
              <Ionicons name="add-circle-outline" size={15} color="#16a34a" />
              <Text className="text-green-700 text-xs font-semibold">Log a round</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Game CTA */}
        <View className="px-4 mb-5">
          <TouchableOpacity
            onPress={() => router.push("/(app)/play/games/new")}
            activeOpacity={0.85}
            className="bg-green-600 rounded-2xl p-5 flex-row items-center justify-between"
            style={{
              shadowColor: "#16a34a",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <View>
              <Text className="text-white text-xs font-medium opacity-80 mb-0.5">
                Ready to play?
              </Text>
              <Text className="text-white text-xl font-bold">Quick Game</Text>
              <Text className="text-green-200 text-xs mt-0.5">
                Start scoring right now
              </Text>
            </View>
            <View className="w-14 h-14 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="play-circle" size={36} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent Rounds */}
        <View className="px-4 mb-2">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-900">Recent Rounds</Text>
            <TouchableOpacity onPress={() => router.push("/(app)/rounds")}>
              <Text className="text-green-600 font-medium text-sm">See all</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View className="py-8 items-center">
              <LoadingSpinner />
            </View>
          ) : !rounds || rounds.length === 0 ? (
            <Card className="p-5 items-center gap-3">
              <View className="w-14 h-14 rounded-full bg-green-50 items-center justify-center">
                <Ionicons name="golf-outline" size={28} color="#16a34a" />
              </View>
              <View className="items-center gap-1">
                <Text className="font-semibold text-gray-900">No rounds yet</Text>
                <Text className="text-gray-500 text-sm text-center">
                  Log your first round to start tracking your handicap.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/(app)/rounds/new")}
                className="bg-green-600 rounded-full px-5 py-2.5 flex-row items-center gap-1.5"
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text className="text-white font-semibold text-sm">Log a Round</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            rounds.map((round: any) => (
              <RoundCard
                key={round._id}
                round={round}
                onPress={() => router.push(`/(app)/rounds/${round._id}`)}
              />
            ))
          )}
        </View>

        {/* Log new round shortcut if rounds exist */}
        {rounds && rounds.length > 0 && (
          <View className="px-4 mb-5">
            <TouchableOpacity
              onPress={() => router.push("/(app)/rounds/new")}
              className="border border-green-200 bg-green-50 rounded-xl p-4 flex-row items-center justify-center gap-2"
            >
              <Ionicons name="add-circle-outline" size={20} color="#16a34a" />
              <Text className="text-green-700 font-semibold text-sm">
                Log another round
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Invite club card */}
        {hasNoClub && (
          <View className="px-4">
            <InviteClubCard />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
