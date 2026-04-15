import { View, Text, FlatList } from "react-native";
import { Stack } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/convex";
import { EmptyState, LoadingSpinner, Badge } from "../../../components/ui";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return "–";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// ── sub-components ─────────────────────────────────────────────────────────────

function PodiumBadge({ position }: { position?: number }) {
  if (!position || position > 3) return null;

  const colors: Record<number, { bg: string; text: string; icon: string }> = {
    1: { bg: "bg-yellow-100", text: "text-yellow-700", icon: "🥇" },
    2: { bg: "bg-gray-100", text: "text-gray-600", icon: "🥈" },
    3: { bg: "bg-orange-100", text: "text-orange-700", icon: "🥉" },
  };

  const style = colors[position];
  if (!style) return null;

  return (
    <View className={`rounded-full px-2.5 py-1 ${style.bg}`}>
      <Text className={`text-xs font-bold ${style.text}`}>
        {style.icon} {ordinal(position)}
      </Text>
    </View>
  );
}

type CompResult = {
  _id: string;
  competitionName: string;
  competitionDate?: string;
  position?: number;
  stablefordPoints?: number;
  grossScore?: number;
  netScore?: number;
  handicap: number;
};

function ResultRow({ result }: { result: CompResult }) {
  const hasScore =
    result.stablefordPoints !== undefined ||
    result.grossScore !== undefined;

  return (
    <View className="bg-white border-b border-gray-50 px-4 py-4">
      <View className="flex-row items-start gap-3">
        {/* Trophy icon */}
        <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mt-0.5">
          <Ionicons name="trophy-outline" size={20} color="#16a34a" />
        </View>

        {/* Details */}
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900 mb-0.5" numberOfLines={1}>
            {result.competitionName}
          </Text>
          <Text className="text-xs text-gray-400 mb-2">
            {formatDate(result.competitionDate)}
          </Text>

          {/* Scores + position */}
          <View className="flex-row flex-wrap gap-2 items-center">
            {result.position ? (
              <PodiumBadge position={result.position} />
            ) : result.position !== undefined ? (
              <View className="bg-gray-100 rounded-full px-2.5 py-1">
                <Text className="text-xs font-semibold text-gray-600">
                  {ordinal(result.position)}
                </Text>
              </View>
            ) : null}

            {result.stablefordPoints !== undefined && (
              <Badge variant="success">{result.stablefordPoints} pts</Badge>
            )}
            {result.grossScore !== undefined && (
              <Badge variant="muted">{result.grossScore} gross</Badge>
            )}
            {result.netScore !== undefined && result.stablefordPoints === undefined && (
              <Badge variant="default">Net {result.netScore}</Badge>
            )}
            <View className="bg-gray-100 rounded-full px-2.5 py-1">
              <Text className="text-xs text-gray-500">HCP {result.handicap}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function CompetitionHistoryScreen() {
  const { user } = useUser();
  const userId = user?.id ?? "";

  const results = useQuery(
    api.competitions.listResultsForUser,
    userId ? { userId, limit: 50 } : "skip"
  );

  const isLoading = results === undefined;

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Competition History" }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Competition History" }} />
      <FlatList
        className="flex-1 bg-gray-50"
        data={results ?? []}
        keyExtractor={item => item._id}
        renderItem={({ item }) => <ResultRow result={item as CompResult} />}
        ListHeaderComponent={
          results && results.length > 0 ? (
            <View className="px-4 py-3 bg-white border-b border-gray-100">
              <Text className="text-sm text-gray-500">
                {results.length} competition{results.length !== 1 ? "s" : ""} entered
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="trophy-outline"
            title="No competition history"
            description="Your competition results will appear here after you enter club competitions."
          />
        }
        contentContainerStyle={
          (results ?? []).length === 0 ? { flexGrow: 1 } : { paddingBottom: 32 }
        }
      />
    </>
  );
}
