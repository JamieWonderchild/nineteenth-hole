import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../../lib/convex";
import { Badge, Button, Card, LoadingSpinner, StatRow } from "../../../../components/ui";

// ── Types ──────────────────────────────────────────────────────────────────────

type PrizeRow = { position: number; percentage: number; amount?: number };

type Competition = {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  status: "open" | "live" | "complete" | string;
  startDate?: string;
  endDate?: string;
  entryDeadline?: string;
  entryFee?: number;
  entryCount?: number;
  prizeStructure?: PrizeRow[];
  format?: string;
};

type Player = {
  _id: string;
  name: string;
  tier?: number;
  worldRanking?: number;
  position?: number;
  scoreToPar?: number;
};

type Entry = {
  _id: string;
  userId: string;
  displayName?: string;
  playerIds?: string[];
  totalScore?: number;
  bestPlayerName?: string;
  bestPlayerScore?: number;
  rank?: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusVariant(status: string): "success" | "warning" | "muted" {
  if (status === "live") return "success";
  if (status === "open") return "warning";
  return "muted";
}

function formatDate(ts?: string): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function scoreToPar(n?: number): string {
  if (n == null) return "—";
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PoolDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useUser();

  // We need the competition ID from slug — listPlatform and filter
  const allComps = useQuery(api.competitions.listPlatform, {});
  const competition: Competition | undefined = (allComps as any[])?.find(
    (c: any) => c.slug === slug
  ) as Competition | undefined;

  const competitionId = competition?._id;

  const players = useQuery(
    api.players.listByCompetition,
    competitionId ? { competitionId: competitionId as any } : "skip"
  );

  const myEntry = useQuery(
    api.entries.getByCompetitionAndUser,
    competitionId && user?.id
      ? { competitionId: competitionId as any, userId: user.id }
      : "skip"
  );

  const allEntries = useQuery(
    api.entries.listByCompetition,
    competitionId ? { competitionId: competitionId as any } : "skip"
  );

  if (allComps == null) {
    return <LoadingSpinner fullScreen />;
  }

  if (!competition) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-8">
        <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
        <Text className="text-gray-900 font-bold text-lg mt-3">Pool not found</Text>
        <Text className="text-gray-500 text-center mt-1">
          This pool may have been removed or the link is invalid.
        </Text>
      </View>
    );
  }

  const hasEntered = myEntry != null;

  return (
    <>
      <Stack.Screen options={{ title: competition.name }} />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Hero header */}
        <View className="px-4 pt-5 pb-4 bg-white border-b border-gray-100">
          <View className="flex-row items-start justify-between mb-2">
            <Text className="text-2xl font-bold text-gray-900 flex-1 mr-3">
              {competition.name}
            </Text>
            <Badge variant={statusVariant(competition.status)}>
              {competition.status.charAt(0).toUpperCase() + competition.status.slice(1)}
            </Badge>
          </View>
          {competition.description && (
            <Text className="text-gray-500 text-sm leading-5 mb-3">
              {competition.description}
            </Text>
          )}

          <StatRow
            stats={[
              { label: "Entries", value: competition.entryCount ?? allEntries?.length ?? 0 },
              { label: "Entry fee", value: competition.entryFee ? `£${(competition.entryFee / 100).toFixed(0)}` : "Free" },
              { label: "Starts", value: formatDate(competition.startDate) },
            ]}
          />
        </View>

        <View className="px-4 pt-4 gap-5">
          {/* ─── NOT ENTERED ─── */}
          {!hasEntered && (
            <>
              {/* Competition details */}
              <Card className="overflow-hidden">
                <View className="px-4 py-3 border-b border-gray-50">
                  <Text className="font-bold text-gray-900">Details</Text>
                </View>
                {[
                  { label: "Start", value: formatDate(competition.startDate) },
                  { label: "End", value: formatDate(competition.endDate) },
                  { label: "Entry closes", value: formatDate(competition.entryDeadline) },
                  { label: "Format", value: competition.format ?? "Fantasy golf" },
                ].map((row, i, arr) => (
                  <View
                    key={row.label}
                    className={`flex-row justify-between px-4 py-3 ${
                      i < arr.length - 1 ? "border-b border-gray-50" : ""
                    }`}
                  >
                    <Text className="text-gray-500 text-sm">{row.label}</Text>
                    <Text className="text-gray-900 text-sm font-medium">{row.value}</Text>
                  </View>
                ))}
              </Card>

              {/* Prize structure */}
              {competition.prizeStructure && competition.prizeStructure.length > 0 && (
                <Card className="overflow-hidden">
                  <View className="px-4 py-3 border-b border-gray-50">
                    <Text className="font-bold text-gray-900">Prize structure</Text>
                  </View>
                  {competition.prizeStructure.map((row, i) => (
                    <View
                      key={row.position}
                      className={`flex-row items-center justify-between px-4 py-3 ${
                        i < competition.prizeStructure!.length - 1 ? "border-b border-gray-50" : ""
                      }`}
                    >
                      <Text className="text-gray-500 text-sm">{ordinal(row.position)} place</Text>
                      <View className="flex-row items-center gap-2">
                        {row.amount != null && (
                          <Text className="text-gray-900 font-bold text-sm">
                            £{(row.amount / 100).toFixed(0)}
                          </Text>
                        )}
                        <Badge variant="muted">{row.percentage}%</Badge>
                      </View>
                    </View>
                  ))}
                </Card>
              )}

              {/* Player tiers */}
              {players != null && players.length > 0 && (
                <PlayerTiersSection players={players as any} />
              )}

              {/* Enter button */}
              <Button
                size="lg"
                onPress={() =>
                  Alert.alert(
                    "Coming soon",
                    "Entry via the app is coming soon. Please enter on the website."
                  )
                }
              >
                {competition.entryFee && competition.entryFee > 0
                  ? `Enter — £${(competition.entryFee / 100).toFixed(0)}`
                  : "Enter"}
              </Button>
            </>
          )}

          {/* ─── ENTERED ─── */}
          {hasEntered && myEntry && (
            <>
              {/* My squad */}
              <Card className="overflow-hidden">
                <View className="px-4 py-3 border-b border-gray-50 flex-row items-center gap-2">
                  <Ionicons name="person-circle-outline" size={18} color="#16a34a" />
                  <Text className="font-bold text-gray-900">My Squad</Text>
                </View>
                {((myEntry as any).playerNames ?? []).map((name: string, i: number) => {
                  // Find matching player for live score
                  const livePlayer = players?.find(
                    (p: Player) => p.name === name
                  );
                  return (
                    <View
                      key={i}
                      className="flex-row items-center px-4 py-3 border-b border-gray-50"
                    >
                      <Text className="flex-1 text-gray-900 font-medium text-sm">{name}</Text>
                      {livePlayer?.position != null && (
                        <Text className="text-xs text-gray-400 mr-2">
                          {ordinal(livePlayer.position)}
                        </Text>
                      )}
                      {livePlayer?.scoreToPar != null && (
                        <Text
                          className={`text-sm font-bold ${
                            livePlayer.scoreToPar < 0
                              ? "text-red-500"
                              : livePlayer.scoreToPar === 0
                              ? "text-gray-700"
                              : "text-gray-500"
                          }`}
                        >
                          {scoreToPar(livePlayer.scoreToPar)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </Card>

              {/* Live leaderboard */}
              {allEntries != null && allEntries.length > 0 && (
                <Card className="overflow-hidden">
                  <View className="px-4 py-3 border-b border-gray-50">
                    <Text className="font-bold text-gray-900">Leaderboard</Text>
                  </View>
                  {allEntries.map((entry: Entry, i: number) => {
                    const isMe = entry.userId === user?.id;
                    return (
                      <View
                        key={entry._id}
                        className={`flex-row items-center px-4 py-3 border-b border-gray-50 ${
                          isMe ? "bg-green-50" : ""
                        }`}
                      >
                        {/* Position */}
                        <View
                          className={`w-7 h-7 rounded-full items-center justify-center mr-3 ${
                            i === 0
                              ? "bg-amber-100"
                              : i === 1
                              ? "bg-gray-200"
                              : i === 2
                              ? "bg-orange-100"
                              : "bg-gray-50"
                          }`}
                        >
                          <Text
                            className={`text-xs font-bold ${
                              i === 0
                                ? "text-amber-700"
                                : i === 1
                                ? "text-gray-600"
                                : i === 2
                                ? "text-orange-700"
                                : "text-gray-400"
                            }`}
                          >
                            {entry.rank ?? i + 1}
                          </Text>
                        </View>

                        {/* Name + best player */}
                        <View className="flex-1">
                          <Text
                            className={`text-sm font-semibold ${
                              isMe ? "text-green-700" : "text-gray-900"
                            }`}
                          >
                            {entry.displayName ?? "Player"}
                            {isMe && (
                              <Text className="text-green-500 font-normal"> (you)</Text>
                            )}
                          </Text>
                          {entry.bestPlayerName && (
                            <Text className="text-xs text-gray-400">
                              Best: {entry.bestPlayerName}
                            </Text>
                          )}
                        </View>

                        {/* Score */}
                        <Text
                          className={`text-sm font-bold ${
                            (entry.bestPlayerScore ?? 0) < 0
                              ? "text-red-500"
                              : "text-gray-700"
                          }`}
                        >
                          {scoreToPar(entry.bestPlayerScore)}
                        </Text>
                      </View>
                    );
                  })}
                </Card>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

// ── Player tiers section ──────────────────────────────────────────────────────

function PlayerTiersSection({ players }: { players: Player[] }) {
  // Group by tier
  const tiers = players.reduce<Record<string, Player[]>>((acc, p) => {
    const tier = p.tier ?? "Other";
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(p);
    return acc;
  }, {});

  const tierOrder = Object.keys(tiers).sort();

  return (
    <Card className="overflow-hidden">
      <View className="px-4 py-3 border-b border-gray-50">
        <Text className="font-bold text-gray-900">Players</Text>
      </View>
      {tierOrder.map((tier) => (
        <View key={tier}>
          <View className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {tier}
            </Text>
          </View>
          {tiers[tier].map((p: Player, i: number, arr: Player[]) => (
            <View
              key={p._id}
              className={`flex-row items-center px-4 py-3 ${
                i < arr.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              <Text className="flex-1 text-gray-900 text-sm">{p.name}</Text>
              {p.worldRanking != null && (
                <Text className="text-xs text-gray-400">
                  WR #{p.worldRanking}
                </Text>
              )}
            </View>
          ))}
        </View>
      ))}
    </Card>
  );
}
