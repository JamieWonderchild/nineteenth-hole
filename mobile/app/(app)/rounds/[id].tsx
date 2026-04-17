import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/convex";
import {
  HandicapBadge,
  StatRow,
  ScoreChip,
  LoadingSpinner,
  Card,
  Badge,
  Button,
} from "../../../components/ui";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const CONDITIONS_MAP: Record<string, { emoji: string; label: string }> = {
  dry: { emoji: "☀️", label: "Dry" },
  overcast: { emoji: "🌤", label: "Overcast" },
  wet: { emoji: "🌧", label: "Wet" },
  windy: { emoji: "💨", label: "Windy" },
};

// Standard par layout for scorecard display when no course-specific data
const STANDARD_PARS = [4, 4, 4, 3, 5, 4, 3, 4, 5, 4, 3, 5, 4, 4, 5, 3, 4, 4];
const STANDARD_SI = [1, 7, 11, 15, 3, 13, 17, 5, 9, 8, 16, 4, 12, 6, 2, 18, 10, 14];

// ─── Scorecard table ──────────────────────────────────────────────────────────

function ScorecardTable({ holeScores }: { holeScores: number[] }) {
  const front = holeScores.slice(0, 9);
  const back = holeScores.slice(9, 18);
  const frontTotal = front.reduce((a, b) => a + b, 0);
  const backTotal = back.reduce((a, b) => a + b, 0);
  const total = frontTotal + backTotal;

  function HalfTable({
    scores,
    label,
    subtotal,
    offset,
  }: {
    scores: number[];
    label: string;
    subtotal: number;
    offset: number;
  }) {
    return (
      <View className="mb-3">
        {/* Header row */}
        <View className="flex-row bg-gray-50 rounded-t-lg px-2 py-2">
          <Text className="text-sm font-bold text-gray-400 w-9">H</Text>
          <Text className="text-sm font-bold text-gray-400 w-10">Par</Text>
          <Text className="text-sm font-bold text-gray-400 w-10">SI</Text>
          <View className="flex-1 items-center">
            <Text className="text-sm font-bold text-gray-400">{label}</Text>
          </View>
        </View>
        {/* Hole rows */}
        {scores.map((score, i) => {
          const holeNum = offset + i + 1;
          const par = STANDARD_PARS[offset + i];
          const si = STANDARD_SI[offset + i];
          return (
            <View
              key={holeNum}
              className={`flex-row items-center px-2 py-2.5 ${
                i < scores.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              <Text className="text-base font-semibold text-gray-700 w-9">{holeNum}</Text>
              <Text className="text-base text-gray-500 w-10">{par}</Text>
              <Text className="text-base text-gray-300 w-10">{si}</Text>
              <View className="flex-1 items-center">
                <ScoreChip score={score} par={par} size="md" />
              </View>
            </View>
          );
        })}
        {/* Subtotal row */}
        <View className="flex-row items-center px-2 py-2.5 bg-gray-50 rounded-b-lg border-t border-gray-100">
          <Text className="text-base font-bold text-gray-500 flex-1">
            {label} Total
          </Text>
          <Text className="text-lg font-bold text-gray-900 mr-1">{subtotal}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-1">
      <HalfTable scores={front} label="Front 9" subtotal={frontTotal} offset={0} />
      <HalfTable scores={back} label="Back 9" subtotal={backTotal} offset={9} />
      {/* Grand total */}
      <View className="bg-green-600 rounded-xl px-4 py-3 flex-row justify-between items-center">
        <Text className="text-white font-bold text-base">Total</Text>
        <Text className="text-white font-bold text-xl">{total}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RoundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();

  const round = useQuery(
    api.rounds.get,
    id ? { roundId: id as any } : "skip"
  );
  const deleteRound = useMutation(api.rounds.deleteRound);
  const attestRound = useMutation(api.rounds.attest);

  function handleDelete() {
    Alert.alert(
      "Delete Round",
      "This round will be permanently removed and your handicap will recalculate. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRound({ roundId: id as any });
              router.replace("/(app)/rounds");
            } catch (e: any) {
              Alert.alert(
                "Error",
                e?.message ?? "Failed to delete round."
              );
            }
          },
        },
      ]
    );
  }

  function handleAttest(decision: "confirmed" | "rejected") {
    Alert.alert(
      decision === "confirmed" ? "Confirm this score?" : "Reject this score?",
      decision === "confirmed"
        ? "This round will count towards their WHS handicap index."
        : "This round will not count towards their handicap.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: decision === "confirmed" ? "Confirm" : "Reject",
          style: decision === "rejected" ? "destructive" : "default",
          onPress: async () => {
            try {
              await attestRound({ roundId: id as any, decision });
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to attest round.");
            }
          },
        },
      ]
    );
  }

  if (round === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Round Detail" }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  if (round === null) {
    return (
      <>
        <Stack.Screen options={{ title: "Round Detail" }} />
        <View className="flex-1 items-center justify-center bg-gray-50 px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#9ca3af" />
          <Text className="text-lg font-semibold text-gray-700 mt-3 text-center">
            Round not found
          </Text>
          <Text className="text-gray-400 text-sm text-center mt-1">
            This round may have been deleted.
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

  const conditionInfo = round.conditions
    ? CONDITIONS_MAP[round.conditions]
    : null;

  const statItems = [
    { label: "Gross", value: round.grossScore },
    {
      label: "Net",
      value:
        round.netScore !== undefined && round.netScore !== null
          ? round.netScore
          : "–",
    },
    {
      label: "Stableford",
      value:
        round.stablefordPoints !== undefined && round.stablefordPoints !== null
          ? `${round.stablefordPoints} pts`
          : "–",
    },
    {
      label: "Differential",
      value:
        round.differential !== undefined && round.differential !== null
          ? round.differential.toFixed(1)
          : "–",
    },
  ];

  const courseName =
    round.courseNameFreetext ?? "Course";

  return (
    <>
      <Stack.Screen
        options={{
          title: courseName,
          headerBackTitle: "Rounds",
        }}
      />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header card */}
        <View className="bg-white border-b border-gray-100 px-4 pt-5 pb-4 gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900" numberOfLines={2}>
                {courseName}
              </Text>
              <Text className="text-sm text-gray-400 mt-0.5">
                {formatDate(round.date)}
              </Text>
              {round.tees && (
                <View className="flex-row items-center gap-1 mt-1">
                  <Ionicons name="flag-outline" size={13} color="#9ca3af" />
                  <Text className="text-xs text-gray-400">{round.tees} tees</Text>
                </View>
              )}
            </View>
            <View className="items-end gap-1.5">
              {conditionInfo && (
                <View className="flex-row items-center gap-1 bg-gray-50 rounded-full px-3 py-1">
                  <Text>{conditionInfo.emoji}</Text>
                  <Text className="text-xs text-gray-500 font-medium">
                    {conditionInfo.label}
                  </Text>
                </View>
              )}
              {round.handicapAtTime !== undefined &&
                round.handicapAtTime !== null && (
                  <HandicapBadge index={round.handicapAtTime} size="sm" />
                )}
            </View>
          </View>

          {/* Played with */}
          {round.playedWith && round.playedWith.length > 0 && (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="people-outline" size={14} color="#9ca3af" />
              <Text className="text-xs text-gray-400">
                Played with {round.playedWith.join(", ")}
              </Text>
            </View>
          )}
        </View>

        {/* Attestation banner */}
        {round.markerId && (
          <View className={`mx-4 mt-4 rounded-xl p-4 ${
            round.attestationStatus === "confirmed" ? "bg-green-50 border border-green-200" :
            round.attestationStatus === "rejected" ? "bg-red-50 border border-red-200" :
            "bg-amber-50 border border-amber-200"
          }`}>
            <View className="flex-row items-center gap-2 mb-1">
              <Ionicons
                name={
                  round.attestationStatus === "confirmed" ? "shield-checkmark" :
                  round.attestationStatus === "rejected" ? "shield-outline" :
                  "time-outline"
                }
                size={16}
                color={
                  round.attestationStatus === "confirmed" ? "#16a34a" :
                  round.attestationStatus === "rejected" ? "#dc2626" :
                  "#d97706"
                }
              />
              <Text className={`text-sm font-semibold ${
                round.attestationStatus === "confirmed" ? "text-green-800" :
                round.attestationStatus === "rejected" ? "text-red-800" :
                "text-amber-800"
              }`}>
                {round.attestationStatus === "confirmed" ? "Score attested" :
                 round.attestationStatus === "rejected" ? "Score rejected" :
                 "Awaiting attestation"}
              </Text>
            </View>
            <Text className={`text-xs ${
              round.attestationStatus === "confirmed" ? "text-green-600" :
              round.attestationStatus === "rejected" ? "text-red-600" :
              "text-amber-600"
            }`}>
              {round.attestationStatus === "confirmed"
                ? `Confirmed by ${round.markerName} · counts toward handicap`
                : round.attestationStatus === "rejected"
                ? `Rejected by ${round.markerName} · does not count toward handicap`
                : `Waiting for ${round.markerName} to confirm`}
            </Text>
            {/* Marker can confirm/reject if status is pending */}
            {round.attestationStatus === "pending" && round.markerId === user?.id && (
              <View className="flex-row gap-2 mt-3">
                <TouchableOpacity
                  onPress={() => handleAttest("confirmed")}
                  className="flex-1 bg-green-600 rounded-xl py-2.5 items-center"
                >
                  <Text className="text-white font-semibold text-sm">Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleAttest("rejected")}
                  className="flex-1 bg-white border border-gray-200 rounded-xl py-2.5 items-center"
                >
                  <Text className="text-gray-600 font-semibold text-sm">Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Stats row */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <StatRow stats={statItems} />
        </View>

        {/* Course ratings row */}
        {(round.courseRating !== undefined || round.slopeRating !== undefined) && (
          <View className="mx-4 mt-3 flex-row gap-3">
            {round.courseRating !== undefined && (
              <View className="flex-1 bg-white rounded-xl border border-gray-100 p-3 items-center">
                <Text className="text-lg font-bold text-gray-900">
                  {round.courseRating}
                </Text>
                <Text className="text-xs text-gray-400">Course Rating</Text>
              </View>
            )}
            {round.slopeRating !== undefined && (
              <View className="flex-1 bg-white rounded-xl border border-gray-100 p-3 items-center">
                <Text className="text-lg font-bold text-gray-900">
                  {round.slopeRating}
                </Text>
                <Text className="text-xs text-gray-400">Slope Rating</Text>
              </View>
            )}
          </View>
        )}

        {/* Counting round badge */}
        <View className="mx-4 mt-3 flex-row gap-2">
          <Badge
            variant={round.isCountingRound ? "success" : "muted"}
          >
            {round.isCountingRound ? "Counting round" : "Non-counting round"}
          </Badge>
        </View>

        {/* Scorecard */}
        {round.holeScores && round.holeScores.length === 18 && (
          <View className="px-4 mt-5">
            <Text className="text-lg font-bold text-gray-900 mb-3">Scorecard</Text>
            <ScorecardTable holeScores={(round.holeScores as any[]).map((h) => h.score)} />
          </View>
        )}

        {/* Notes */}
        {round.notes ? (
          <View className="mx-4 mt-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Notes</Text>
            <Card className="p-4">
              <Text className="text-sm text-gray-600 leading-5">{round.notes}</Text>
            </Card>
          </View>
        ) : null}

        {/* Delete button */}
        <View className="mx-4 mt-8">
          <Button variant="destructive" onPress={handleDelete} size="lg">
            Delete Round
          </Button>
          <Text className="text-xs text-gray-400 text-center mt-2">
            This action cannot be undone. Your handicap will recalculate.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
