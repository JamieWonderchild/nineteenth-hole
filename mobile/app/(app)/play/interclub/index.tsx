import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../../lib/convex";
import { LoadingSpinner } from "../../../../components/ui";

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function holeStateLabel(holeResults: any[]): string | null {
  const decided = (holeResults ?? []).filter((h: any) => h.holeWinner != null);
  if (decided.length === 0) return null;
  let homeUp = 0;
  for (const h of decided) {
    if (h.holeWinner === "home") homeUp++;
    else if (h.holeWinner === "away") homeUp--;
  }
  const remaining = 18 - decided.length;
  if (homeUp === 0) return `AS·${decided.length}`;
  const up = Math.abs(homeUp);
  if (up > remaining) return `${up}&${remaining}`;
  const side = homeUp > 0 ? "H" : "A";
  return `${side}${up}·${decided.length}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    scheduled: { bg: "#e0f2fe", text: "#0369a1", label: "Scheduled" },
    in_progress: { bg: "#dcfce7", text: "#166534", label: "Live" },
    complete: { bg: "#f3f4f6", text: "#6b7280", label: "Complete" },
    postponed: { bg: "#fef3c7", text: "#92400e", label: "Postponed" },
  };
  const c = map[status] ?? map.scheduled;
  return (
    <View style={{ backgroundColor: c.bg }} className="rounded-full px-2 py-0.5">
      <Text style={{ color: c.text }} className="text-xs font-medium">{c.label}</Text>
    </View>
  );
}

export default function InterclubScreen() {
  const router = useRouter();
  const { user } = useUser();
  const fixtures = useQuery(api.interclub.listMyFixtures, user ? {} : "skip");

  return (
    <>
      <Stack.Screen options={{ title: "Interclub Matches" }} />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-4 gap-4">
          {fixtures == null ? (
            <View className="py-12 items-center">
              <LoadingSpinner />
            </View>
          ) : fixtures.length === 0 ? (
            <View className="py-16 items-center gap-3">
              <Ionicons name="trophy-outline" size={40} color="#d1d5db" />
              <Text className="text-gray-500 font-medium">No fixtures yet</Text>
              <Text className="text-xs text-gray-400 text-center px-8">
                Once your captain selects you for a fixture, it will appear here.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {(fixtures as any[]).map(fixture => (
                <TouchableOpacity
                  key={fixture._id}
                  onPress={() => router.push(`/play/interclub/${fixture._id}` as any)}
                >
                  <View className="bg-white rounded-xl border border-gray-200 px-4 py-3 gap-2">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 min-w-0">
                        <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                          {fixture.homeTeam?.teamName} vs {fixture.awayTeam?.teamName}
                        </Text>
                        <Text className="text-xs text-gray-500 mt-0.5">
                          {fixture.league?.name}{fixture.date ? ` · ${formatDate(fixture.date)}` : ""}
                        </Text>
                      </View>
                      <StatusBadge status={fixture.status} />
                    </View>

                    {/* My matches */}
                    {(fixture.myMatchIds ?? []).map((matchId: string) => {
                      const m = (fixture.matches ?? []).find((x: any) => x._id === matchId);
                      if (!m) return null;
                      const state = holeStateLabel(m.holeResults ?? []);
                      const isBB = m.matchType === "betterball";
                      return (
                        <View key={matchId} className="flex-row items-center gap-2 bg-green-50 rounded-lg px-2.5 py-1.5">
                          <Ionicons name="golf" size={12} color="#16a34a" />
                          <Text className="text-xs text-gray-700 flex-1" numberOfLines={1}>
                            {m.homePlayer}{isBB && m.homePlayer2 ? ` / ${m.homePlayer2}` : ""}
                            {" vs "}
                            {m.awayPlayer}{isBB && m.awayPlayer2 ? ` / ${m.awayPlayer2}` : ""}
                          </Text>
                          {state && (
                            <Text className="text-xs text-green-700 font-semibold">{state}</Text>
                          )}
                          {m.result && !state && (
                            <Text className="text-xs text-gray-500">{m.result}</Text>
                          )}
                        </View>
                      );
                    })}

                    <View className="flex-row items-center justify-between">
                      {fixture.homePoints != null && (
                        <Text className="text-xs text-gray-400">
                          {fixture.homeTeam?.teamName} {fixture.homePoints} – {fixture.awayPoints} {fixture.awayTeam?.teamName}
                        </Text>
                      )}
                      <Text className="text-xs text-green-600 ml-auto">View →</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
