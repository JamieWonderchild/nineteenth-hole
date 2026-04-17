import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../../lib/convex";
import type { Id } from "../../../../lib/convex";
import { LoadingSpinner } from "../../../../components/ui";

function computeMatchState(holeResults: any[]): { label: string; colour: string } {
  const decided = (holeResults ?? []).filter((h: any) => h.holeWinner != null);
  let homeUp = 0;
  for (const h of decided) {
    if (h.holeWinner === "home") homeUp++;
    else if (h.holeWinner === "away") homeUp--;
  }
  const holesPlayed = decided.length;
  const remaining = 18 - holesPlayed;
  if (holesPlayed === 0) return { label: "Not started", colour: "#9ca3af" };
  if (homeUp === 0) return { label: `AS · ${holesPlayed}`, colour: "#6b7280" };
  const margin = Math.abs(homeUp);
  const side = homeUp > 0 ? "Home" : "Away";
  if (margin > remaining) return { label: `${side} wins ${margin}&${remaining}`, colour: "#16a34a" };
  if (margin === remaining) return { label: `${side} ${margin} Up — Dormie`, colour: "#d97706" };
  return { label: `${side} ${margin} Up · thru ${holesPlayed}`, colour: "#16a34a" };
}

export default function FixtureDetailScreen() {
  const { fixtureId } = useLocalSearchParams<{ fixtureId: string }>();
  const router = useRouter();
  const { user } = useUser();

  const fixture = useQuery(
    api.interclub.getFixture,
    fixtureId ? { fixtureId: fixtureId as Id<"interclubFixtures"> } : "skip"
  );

  if (!fixture) {
    return (
      <>
        <Stack.Screen options={{ title: "Fixture" }} />
        <View className="flex-1 items-center justify-center bg-gray-50">
          <LoadingSpinner />
        </View>
      </>
    );
  }

  const matches = ((fixture.matches ?? []) as any[]).sort((a, b) => a.matchNumber - b.matchNumber);
  const userId = user?.id;
  const homeTotal = matches.reduce((s, m) => s + (m.homePoints ?? 0), 0);
  const awayTotal = matches.reduce((s, m) => s + (m.awayPoints ?? 0), 0);

  function isMyMatch(m: any) {
    return userId && [m.homeUserId, m.homeUserId2, m.awayUserId, m.awayUserId2].includes(userId);
  }

  return (
    <>
      <Stack.Screen options={{
        title: `${(fixture as any).homeTeam?.teamName ?? "Home"} vs ${(fixture as any).awayTeam?.teamName ?? "Away"}`,
        headerShown: true,
      }} />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-4 gap-4">
          {/* Fixture info card */}
          <View className="bg-white rounded-xl border border-gray-200 px-4 py-4 gap-1">
            <Text className="text-xs text-gray-400">{(fixture as any).league?.name}</Text>
            <Text className="text-base font-bold text-gray-900">
              {(fixture as any).homeTeam?.clubName} {(fixture as any).homeTeam?.teamName}
              {"  "}
              <Text className="text-gray-400 font-normal">vs</Text>
              {"  "}
              {(fixture as any).awayTeam?.clubName} {(fixture as any).awayTeam?.teamName}
            </Text>
            {(fixture as any).date && (
              <Text className="text-sm text-gray-500">
                {new Date((fixture as any).date + "T00:00:00").toLocaleDateString("en-GB", {
                  weekday: "long", day: "numeric", month: "long",
                })}
                {(fixture as any).venue ? ` · ${(fixture as any).venue}` : ""}
              </Text>
            )}
          </View>

          {/* Running score */}
          {matches.some(m => m.winner || (m.holeResults ?? []).length > 0) && (
            <View className={`rounded-xl px-4 py-4 items-center ${(fixture as any).status === "complete" ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-100"}`}>
              <Text className="text-xs text-gray-500 mb-1">Match score</Text>
              <Text className="text-3xl font-bold text-gray-900">{homeTotal} – {awayTotal}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                {(fixture as any).homeTeam?.teamName} – {(fixture as any).awayTeam?.teamName}
              </Text>
            </View>
          )}

          {/* Matches list */}
          <View>
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Matches ({matches.length})
            </Text>
            <View className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {matches.length === 0 ? (
                <View className="px-4 py-8 items-center">
                  <Text className="text-gray-400 text-sm">No matches set up yet</Text>
                </View>
              ) : (
                matches.map((m: any, idx: number) => {
                  const state = computeMatchState(m.holeResults ?? []);
                  const mine = isMyMatch(m);
                  const isBB = m.matchType === "betterball";
                  const canScore = mine && m.matchStatus !== "complete";

                  return (
                    <View
                      key={m._id}
                      className={`px-4 py-3 ${idx < matches.length - 1 ? "border-b border-gray-100" : ""} ${mine ? "bg-green-50" : ""}`}
                    >
                      <View className="flex-row items-start justify-between gap-2">
                        <View className="flex-1 min-w-0">
                          <Text className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">
                            Match {m.matchNumber} · {isBB ? "4-Ball BB" : "Singles"}
                          </Text>
                          <Text
                            className={`text-sm font-semibold ${m.winner === "home" ? "text-green-700" : "text-gray-900"}`}
                            numberOfLines={1}
                          >
                            {m.winner === "home" ? "🏆 " : ""}{m.homePlayer}
                            {isBB && m.homePlayer2 ? ` / ${m.homePlayer2}` : ""}
                          </Text>
                          <Text className="text-xs text-gray-400 my-0.5">vs</Text>
                          <Text
                            className={`text-sm font-semibold ${m.winner === "away" ? "text-green-700" : "text-gray-900"}`}
                            numberOfLines={1}
                          >
                            {m.winner === "away" ? "🏆 " : ""}{m.awayPlayer}
                            {isBB && m.awayPlayer2 ? ` / ${m.awayPlayer2}` : ""}
                          </Text>
                          <View className="flex-row items-center gap-2 mt-1.5">
                            <Text style={{ color: state.colour }} className="text-xs font-medium">
                              {state.label}
                            </Text>
                            {m.result && m.matchStatus === "complete" && (
                              <View className="bg-gray-100 rounded px-1.5 py-0.5">
                                <Text className="text-xs text-gray-700 font-medium">{m.result}</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {canScore && (
                          <TouchableOpacity
                            onPress={() => router.push(`/play/interclub/score/${m._id}` as any)}
                            className="bg-green-600 rounded-xl px-4 py-2 flex-shrink-0 mt-1"
                          >
                            <Text className="text-white text-xs font-bold">Score</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
