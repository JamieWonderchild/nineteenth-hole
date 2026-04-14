import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../../lib/convex";
import { Badge, Card, EmptyState, LoadingSpinner, SectionHeader } from "../../../../components/ui";

type Game = {
  _id: string;
  name: string;
  type: string;
  date: string;
  status: string;
  stakePerPlayer?: number;
  players: Array<{ id: string; name: string; handicap?: number }>;
  resultSummary?: string;
};

function typeBadgeVariant(type: string): "default" | "warning" | "muted" {
  if (type === "skins") return "warning";
  if (type === "nassau") return "muted";
  return "default";
}

function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function GamesScreen() {
  const router = useRouter();
  const { user } = useUser();

  const games = useQuery(
    api.quickGames.listByUser,
    user?.id ? { userId: user.id } : "skip"
  );

  if (games == null) {
    return (
      <View className="flex-1 bg-gray-50">
        <LoadingSpinner fullScreen />
      </View>
    );
  }

  const active = games.filter((g: Game) => g.status === "active");
  const complete = games.filter((g: Game) => g.status === "complete");

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header with FAB */}
      <View className="flex-row items-center justify-between px-4 pt-6 pb-2">
        <Text className="text-2xl font-bold text-gray-900">My Games</Text>
        <TouchableOpacity
          onPress={() => router.push("/play/games/new" as any)}
          className="w-10 h-10 rounded-full bg-green-600 items-center justify-center shadow-sm"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {games.length === 0 ? (
        <EmptyState
          icon="golf"
          title="No games yet"
          description="Start a quick game with friends and track your scores live."
          action={{
            label: "Start a Game",
            onPress: () => router.push("/play/games/new" as any),
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}>
          {active.length > 0 && (
            <View className="mb-6">
              <SectionHeader title="Active" />
              <View className="gap-3">
                {active.map((game: Game) => (
                  <GameCard key={game._id} game={game} onPress={() => router.push(`/play/games/${game._id}` as any)} />
                ))}
              </View>
            </View>
          )}

          {complete.length > 0 && (
            <View>
              <SectionHeader title="Complete" />
              <View className="gap-3">
                {complete.map((game: Game) => (
                  <GameCard key={game._id} game={game} onPress={() => router.push(`/play/games/${game._id}` as any)} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function GameCard({ game, onPress }: { game: Game; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Card className="px-4 py-3">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-2">
            <Text className="font-bold text-gray-900 text-base">{game.name}</Text>
          </View>
          <View className="flex-row gap-2 items-center">
            <Badge variant={typeBadgeVariant(game.type)}>{formatType(game.type)}</Badge>
            <Badge variant={game.status === "active" ? "success" : "muted"}>
              {game.status === "active" ? "Active" : "Done"}
            </Badge>
          </View>
        </View>

        <View className="flex-row items-center gap-3 mt-1">
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
            <Text className="text-xs text-gray-500">{formatDate(game.date)}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="people-outline" size={13} color="#9ca3af" />
            <Text className="text-xs text-gray-500">{game.players.length} players</Text>
          </View>
          {game.stakePerPlayer != null && game.stakePerPlayer > 0 && (
            <View className="flex-row items-center gap-1">
              <Ionicons name="cash-outline" size={13} color="#9ca3af" />
              <Text className="text-xs text-gray-500">
                £{(game.stakePerPlayer / 100).toFixed(2)}/player
              </Text>
            </View>
          )}
        </View>

        {game.status === "complete" && game.resultSummary && (
          <View className="mt-2 pt-2 border-t border-gray-100">
            <Text className="text-xs text-green-700 font-medium">{game.resultSummary}</Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}
