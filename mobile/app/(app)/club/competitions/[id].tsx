import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../lib/convex";
import { Badge, LoadingSpinner, SectionHeader } from "../../../../components/ui";

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── score entry modal ──────────────────────────────────────────────────────────

function ScoreEntryModal({
  visible,
  onClose,
  competition,
  membership,
}: {
  visible: boolean;
  onClose: () => void;
  competition: any;
  membership: any;
}) {
  const [grossInput, setGrossInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const format = competition?.scoringFormat ?? "stableford";
  const handicap = membership?.handicap ?? 0;

  const submitOwnScore = useMutation(api.scoring.submitOwnScore);

  const netScore =
    grossInput && !isNaN(Number(grossInput))
      ? Number(grossInput) - Math.round(handicap)
      : null;

  async function handleSubmit() {
    if (!grossInput || isNaN(Number(grossInput))) {
      Alert.alert("Missing score", "Please enter your gross score.");
      return;
    }

    setSubmitting(true);
    try {
      await submitOwnScore({
        competitionId: competition._id,
        grossScore: Number(grossInput),
      });
      Alert.alert("Score submitted!", "Your score has been recorded.");
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to submit score.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center justify-between px-4 pt-6 pb-4 border-b border-gray-100">
          <Text className="text-lg font-bold text-gray-900">Submit Score</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingVertical: 20 }}
        >
          <View className="mb-5">
            <Text className="text-sm font-semibold text-gray-700 mb-1">
              Competition
            </Text>
            <Text className="text-base text-gray-900">{competition?.name}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              Format: {format.charAt(0).toUpperCase() + format.slice(1)} ·
              Handicap: {handicap}
            </Text>
          </View>

          {/* Gross score — always show */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1">
              Gross Score (total strokes)
            </Text>
            <View className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
              <TextInput
                className="text-lg text-gray-900"
                placeholder="e.g. 82"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                value={grossInput}
                onChangeText={setGrossInput}
              />
            </View>
            {netScore !== null && (
              <Text className="text-xs text-green-600 mt-1 ml-1">
                Net score: {netScore}
              </Text>
            )}
          </View>
        </ScrollView>

        <View className="px-4 pb-10 pt-4 border-t border-gray-100">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className={`rounded-full py-4 items-center ${
              submitting ? "bg-green-300" : "bg-green-600"
            }`}
          >
            <Text className="text-white font-semibold text-base">
              {submitting ? "Submitting…" : "Submit Score"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── leaderboard row ────────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  isCurrentUser,
  format,
  idx,
}: {
  entry: any;
  isCurrentUser: boolean;
  format: string;
  idx: number;
}) {
  const position = entry.position ?? idx + 1;
  const primaryScore =
    format === "stableford"
      ? entry.stablefordPoints != null
        ? `${entry.stablefordPoints} pts`
        : "–"
      : entry.netScore != null
      ? `Net ${entry.netScore}`
      : entry.grossScore != null
      ? `${entry.grossScore}`
      : "–";

  const secondaryScore =
    format !== "stableford" && entry.grossScore != null
      ? `Gross ${entry.grossScore}`
      : null;

  return (
    <View
      className={`flex-row items-center px-4 py-3 border-b border-gray-50 ${
        isCurrentUser ? "bg-green-50" : "bg-white"
      }`}
    >
      {/* position */}
      <View className="w-8 items-center">
        <Text
          className={`font-bold ${
            position === 1
              ? "text-amber-500"
              : position === 2
              ? "text-gray-400"
              : position === 3
              ? "text-amber-700"
              : "text-gray-400"
          } text-sm`}
        >
          {position}
        </Text>
      </View>

      {/* name */}
      <View className="flex-1 ml-3">
        <Text
          className={`font-semibold text-sm ${
            isCurrentUser ? "text-green-700" : "text-gray-900"
          }`}
          numberOfLines={1}
        >
          {entry.displayName}
          {isCurrentUser ? " (you)" : ""}
        </Text>
        {secondaryScore && (
          <Text className="text-xs text-gray-400">{secondaryScore}</Text>
        )}
      </View>

      {/* score */}
      <Text
        className={`font-bold text-sm ml-2 ${
          isCurrentUser ? "text-green-700" : "text-gray-800"
        }`}
      >
        {primaryScore}
      </Text>
    </View>
  );
}

// ── main screen ────────────────────────────────────────────────────────────────

export default function CompetitionLeaderboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const userId = user?.id ?? "";

  const [scoreModalVisible, setScoreModalVisible] = useState(false);

  const competition = useQuery(
    api.competitions.get,
    id ? { competitionId: id as any } : "skip"
  );

  const leaderboard = useQuery(
    api.scoring.leaderboard,
    id ? { competitionId: id as any } : "skip"
  );

  const clubs = useQuery(api.clubMembers.myActiveClubs, {});

  // Find the relevant club membership for handicap
  const membership = clubs?.find(
    (c: any) => c.club._id === competition?.clubId
  )?.membership;

  const myExistingScore = leaderboard?.find(
    (e: any) => e.userId === userId
  );

  const isLoading =
    competition === undefined || leaderboard === undefined || clubs === undefined;

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Leaderboard" }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  if (!competition) {
    return (
      <>
        <Stack.Screen options={{ title: "Leaderboard" }} />
        <View className="flex-1 items-center justify-center bg-gray-50">
          <Text className="text-gray-500">Competition not found.</Text>
        </View>
      </>
    );
  }

  const format = competition.scoringFormat ?? "stableford";
  const isLive = competition.status === "live" || competition.status === "open";
  const canEnterScore = isLive && !myExistingScore;

  const entries = (leaderboard ?? []) as any[];

  return (
    <>
      <Stack.Screen options={{ title: competition.name }} />
      <ScrollView className="flex-1 bg-gray-50">
        {/* hero card */}
        <View className="bg-white border-b border-gray-100 px-4 pt-5 pb-5">
          <Text className="text-xl font-bold text-gray-900 mb-2">
            {competition.name}
          </Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            <Badge variant={isLive ? "success" : "muted"}>
              {competition.status === "live"
                ? "Live"
                : competition.status === "open"
                ? "Open"
                : competition.status === "draft"
                ? "Upcoming"
                : "Complete"}
            </Badge>
            <Badge variant="default">
              {format.charAt(0).toUpperCase() + format.slice(1)}
            </Badge>
          </View>
          <View className="flex-row gap-4">
            <View className="flex-row items-center gap-1">
              <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
              <Text className="text-xs text-gray-500">
                {formatDate(competition.startDate)}
              </Text>
            </View>
            {competition.endDate !== competition.startDate && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="flag-outline" size={14} color="#9ca3af" />
                <Text className="text-xs text-gray-500">
                  Ends {formatDate(competition.endDate)}
                </Text>
              </View>
            )}
          </View>

          {canEnterScore && (
            <TouchableOpacity
              onPress={() => setScoreModalVisible(true)}
              className="mt-4 bg-green-600 rounded-full py-3 items-center"
            >
              <Text className="text-white font-semibold">
                Enter My Score
              </Text>
            </TouchableOpacity>
          )}

          {myExistingScore && (
            <View className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3 flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text className="text-green-700 text-sm font-medium">
                Your score is submitted
              </Text>
            </View>
          )}
        </View>

        {/* leaderboard */}
        <View className="px-4 pt-5 pb-2">
          <SectionHeader title={`Leaderboard · ${entries.length} players`} />
        </View>

        {entries.length === 0 ? (
          <View className="px-4 py-8 items-center">
            <Text className="text-gray-400 text-sm">
              No scores submitted yet
            </Text>
          </View>
        ) : (
          <View className="bg-white rounded-xl mx-4 overflow-hidden border border-gray-100 shadow-sm mb-8">
            {/* table header */}
            <View className="flex-row items-center px-4 py-2 bg-gray-50 border-b border-gray-100">
              <View className="w-8">
                <Text className="text-xs font-semibold text-gray-400">#</Text>
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-xs font-semibold text-gray-400">
                  Player
                </Text>
              </View>
              <Text className="text-xs font-semibold text-gray-400">
                Score
              </Text>
            </View>
            {entries.map((entry: any, idx: number) => (
              <LeaderboardRow
                key={entry._id}
                entry={entry}
                isCurrentUser={entry.userId === userId}
                format={format}
                idx={idx}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {competition && membership && (
        <ScoreEntryModal
          visible={scoreModalVisible}
          onClose={() => setScoreModalVisible(false)}
          competition={competition}
          membership={membership}
        />
      )}
    </>
  );
}
