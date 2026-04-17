/**
 * Interclub match scoring screen.
 * Route: /play/interclub/score/[matchId]
 *
 * Scorer picks W / H / L per hole (from their own team's perspective).
 * Running matchplay state is shown live.
 */
import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../../../lib/convex";
import type { Id } from "../../../../../lib/convex";
import { LoadingSpinner } from "../../../../../components/ui";

type HoleWinner = "home" | "away" | "halved";

function computeState(results: Record<number, HoleWinner>) {
  const entries = Object.entries(results)
    .map(([h, w]) => ({ hole: Number(h), winner: w }))
    .sort((a, b) => a.hole - b.hole);
  let homeUp = 0;
  for (const e of entries) {
    if (e.winner === "home") homeUp++;
    else if (e.winner === "away") homeUp--;
  }
  const holesPlayed = entries.length;
  const holesRemaining = 18 - holesPlayed;
  const margin = Math.abs(homeUp);
  const closed = margin > holesRemaining;
  return { homeUp, holesPlayed, holesRemaining, margin, closed };
}

function stateDisplay(
  homeUp: number,
  holesPlayed: number,
  holesRemaining: number,
  closed: boolean,
  side: "home" | "away" | null,
) {
  if (holesPlayed === 0) return { label: "Not started", sub: "Pick W / H / L for each hole", colour: "#6b7280" };
  if (homeUp === 0) return { label: "All Square", sub: `Through ${holesPlayed}`, colour: "#6b7280" };

  const margin = Math.abs(homeUp);
  const leadingSide = homeUp > 0 ? "home" : "away";
  const colour = leadingSide === side ? "#16a34a" : "#dc2626";

  if (closed) {
    const resultStr = `${margin}&${holesRemaining}`;
    return {
      label: leadingSide === side ? `You win ${resultStr}` : `You lose ${resultStr}`,
      sub: "Match closed — tap Finish",
      colour,
    };
  }
  if (margin === holesRemaining) {
    return {
      label: leadingSide === side ? `${margin} Up — Dormie` : `${margin} Down — Dormie`,
      sub: `Through ${holesPlayed}`,
      colour,
    };
  }
  return {
    label: leadingSide === side ? `${margin} UP` : `${margin} DOWN`,
    sub: `Through ${holesPlayed} · ${holesRemaining} remaining`,
    colour,
  };
}

export default function MatchScoringScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { user } = useUser();

  const match = useQuery(
    api.interclub.getMatch,
    matchId ? { matchId: matchId as Id<"interclubMatches"> } : "skip"
  );
  const saveHole = useMutation(api.interclub.saveMatchHoleResult);
  const finishMutation = useMutation(api.interclub.finishMatch);

  const [holeResults, setHoleResults] = useState<Record<number, HoleWinner>>({});
  const [activeHole, setActiveHole] = useState(1);
  const [saving, setSaving] = useState(false);

  // Hydrate from server on load
  useEffect(() => {
    if (!match?.holeResults) return;
    const map: Record<number, HoleWinner> = {};
    for (const h of match.holeResults) {
      if (h.holeWinner) map[h.hole] = h.holeWinner as HoleWinner;
    }
    setHoleResults(map);
    // Start at first unscored hole
    for (let i = 1; i <= 18; i++) {
      if (!map[i]) { setActiveHole(i); return; }
    }
    setActiveHole(18);
  }, [match?._id]);

  if (!match) {
    return (
      <>
        <Stack.Screen options={{ title: "Scoring" }} />
        <View className="flex-1 items-center justify-center bg-gray-50">
          <LoadingSpinner />
        </View>
      </>
    );
  }

  const userId = user?.id;
  const side: "home" | "away" | null =
    userId && (match.homeUserId === userId || match.homeUserId2 === userId) ? "home"
    : userId && (match.awayUserId === userId || match.awayUserId2 === userId) ? "away"
    : null;

  const isBB = (match as any).fixture?.league?.matchType === "betterball" || match.matchType === "betterball";

  const myLabel = side === "home"
    ? match.homePlayer + (match.homePlayer2 ? ` / ${match.homePlayer2}` : "")
    : match.awayPlayer + (match.awayPlayer2 ? ` / ${match.awayPlayer2}` : "");
  const oppLabel = side === "home"
    ? match.awayPlayer + (match.awayPlayer2 ? ` / ${match.awayPlayer2}` : "")
    : match.homePlayer + (match.homePlayer2 ? ` / ${match.homePlayer2}` : "");

  const { homeUp, holesPlayed, holesRemaining, margin, closed } = computeState(holeResults);
  const { label: stateLabel, sub: stateSub, colour: stateColour } = stateDisplay(homeUp, holesPlayed, holesRemaining, closed, side);

  const matchDone = closed || holesPlayed === 18 || match.matchStatus === "complete";

  async function handleHole(pick: "win" | "halve" | "lose") {
    // Convert from scorer's perspective to absolute
    let absolute: HoleWinner;
    if (pick === "halve") {
      absolute = "halved";
    } else if (pick === "win") {
      absolute = side === "away" ? "away" : "home";
    } else {
      absolute = side === "away" ? "home" : "away";
    }

    const updated = { ...holeResults, [activeHole]: absolute };
    setHoleResults(updated);
    setSaving(true);
    try {
      await saveHole({
        matchId: matchId as Id<"interclubMatches">,
        hole: activeHole,
        holeWinner: absolute,
      });
      // Advance to next unscored hole
      for (let i = activeHole + 1; i <= 18; i++) {
        if (!updated[i]) { setActiveHole(i); return; }
      }
      // All scored
      setActiveHole(18);
    } catch (e) {
      Alert.alert("Save failed", String(e));
      setHoleResults(prev => { const n = { ...prev }; delete n[activeHole]; return n; });
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    const { homeUp, holesPlayed, holesRemaining, closed } = computeState(holeResults);
    let resultDesc = "";
    if (homeUp === 0) resultDesc = "Halved";
    else {
      const m = Math.abs(homeUp);
      const lead = homeUp > 0 ? "home" : "away";
      const mySide = lead === side;
      const prefix = mySide ? "You win" : "You lose";
      resultDesc = closed ? `${prefix} ${m}&${holesRemaining}` : `${prefix} ${m} up (${holesPlayed} holes)`;
    }

    Alert.alert("Finish match?", resultDesc, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await finishMutation({ matchId: matchId as Id<"interclubMatches"> });
            router.back();
          } catch (e) {
            Alert.alert("Error", String(e));
          }
        },
      },
    ]);
  }

  // Hole dot colours from scorer's perspective
  function holeDotStyle(hole: number) {
    const w = holeResults[hole];
    const isActive = hole === activeHole;
    const base = { width: 26, height: 26, borderRadius: 13, alignItems: "center" as const, justifyContent: "center" as const };
    if (isActive) return { ...base, backgroundColor: "#1d4ed8" };
    if (!w) return { ...base, backgroundColor: "#e5e7eb" };
    const won = side === "away" ? w === "away" : w === "home";
    const lost = side === "away" ? w === "home" : w === "away";
    if (won) return { ...base, backgroundColor: "#16a34a" };
    if (lost) return { ...base, backgroundColor: "#dc2626" };
    return { ...base, backgroundColor: "#9ca3af" }; // halved
  }
  function holeDotTextColor(hole: number) {
    const w = holeResults[hole];
    const isActive = hole === activeHole;
    return isActive || w ? "#fff" : "#6b7280";
  }

  return (
    <>
      <Stack.Screen options={{ title: "Scoring", headerShown: true }} />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header & state */}
        <View className="bg-white border-b border-gray-200 px-4 pt-4 pb-4 gap-3">
          <View>
            <Text className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
              Match {match.matchNumber} · {isBB ? "4-Ball BB" : "Singles"}
            </Text>
            <Text className="text-base font-bold text-gray-900" numberOfLines={1}>{myLabel}</Text>
            <Text className="text-sm text-gray-400" numberOfLines={1}>vs {oppLabel}</Text>
          </View>
          <View className="bg-gray-50 rounded-xl py-3 items-center">
            <Text style={{ color: stateColour, fontSize: 26, fontWeight: "800" }}>{stateLabel}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">{stateSub}</Text>
          </View>
        </View>

        <View className="px-4 pt-4 gap-4">
          {/* Hole scoring */}
          {match.matchStatus !== "complete" && (
            <View className="bg-white rounded-xl border border-gray-200 p-4 gap-4">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest text-center">
                Hole {activeHole} of 18
              </Text>

              {/* W / H / L */}
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => handleHole("win")}
                  disabled={saving}
                  style={{ flex: 1, backgroundColor: "#16a34a", borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: saving ? 0.5 : 1 }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Win</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleHole("halve")}
                  disabled={saving}
                  style={{ flex: 1, backgroundColor: "#6b7280", borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: saving ? 0.5 : 1 }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Halve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleHole("lose")}
                  disabled={saving}
                  style={{ flex: 1, backgroundColor: "#dc2626", borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: saving ? 0.5 : 1 }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Lose</Text>
                </TouchableOpacity>
              </View>

              {/* Hole dots */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {Array.from({ length: 18 }, (_, i) => i + 1).map(h => (
                  <TouchableOpacity key={h} onPress={() => setActiveHole(h)}>
                    <View style={holeDotStyle(h)}>
                      <Text style={{ color: holeDotTextColor(h), fontSize: 10, fontWeight: "700" }}>{h}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Scorecard */}
          {holesPlayed > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Scorecard</Text>
              <View className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {Array.from({ length: 18 }, (_, i) => i + 1)
                  .filter(h => holeResults[h] != null)
                  .map((h, idx, arr) => {
                    const w = holeResults[h];
                    const won = side === "away" ? w === "away" : w === "home";
                    const lost = side === "away" ? w === "home" : w === "away";
                    const label = won ? "W" : lost ? "L" : "H";
                    const colour = won ? "#16a34a" : lost ? "#dc2626" : "#6b7280";
                    return (
                      <TouchableOpacity
                        key={h}
                        onPress={() => setActiveHole(h)}
                        className={`flex-row items-center px-4 py-2.5 ${idx < arr.length - 1 ? "border-b border-gray-50" : ""}`}
                      >
                        <Text className="text-sm text-gray-600 w-16">Hole {h}</Text>
                        <View style={{ backgroundColor: colour + "22", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 2 }}>
                          <Text style={{ color: colour, fontWeight: "700", fontSize: 13 }}>{label}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>
          )}

          {/* Finish / complete */}
          {matchDone && match.matchStatus !== "complete" && (
            <TouchableOpacity onPress={handleFinish} className="bg-green-600 rounded-xl py-4 items-center">
              <Text className="text-white font-bold text-base">Finish Match</Text>
            </TouchableOpacity>
          )}

          {match.matchStatus === "complete" && (
            <View className="bg-green-50 border border-green-200 rounded-xl py-4 items-center">
              <Text className="text-green-700 font-bold">
                {match.result ? `Result: ${match.result}` : "Match complete"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
