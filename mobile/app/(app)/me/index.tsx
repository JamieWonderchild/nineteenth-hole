import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useUser, useClerk } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/convex";
import {
  HandicapBadge,
  LoadingSpinner,
  SectionHeader,
  StatRow,
} from "../../../components/ui";

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── edit profile modal ────────────────────────────────────────────────────────

function EditProfileModal({
  visible,
  onClose,
  currentDisplayName,
  currentHomeClub,
  currentGoals,
}: {
  visible: boolean;
  onClose: () => void;
  currentDisplayName: string;
  currentHomeClub?: string;
  currentGoals?: string;
}) {
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [homeClub, setHomeClub] = useState(currentHomeClub ?? "");
  const [goals, setGoals] = useState(currentGoals ?? "");
  const [saving, setSaving] = useState(false);

  const upsertProfile = useMutation(api.golferProfiles.upsert);

  async function handleSave() {
    if (!displayName.trim()) {
      Alert.alert("Name required", "Please enter your display name.");
      return;
    }
    setSaving(true);
    try {
      await upsertProfile({
        displayName: displayName.trim(),
        homeClub: homeClub.trim() || undefined,
        goals: goals || undefined,
      });
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  const goalOptions = ["Casual", "Competitive", "Social"];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center justify-between px-4 pt-6 pb-4 border-b border-gray-100">
          <Text className="text-lg font-bold text-gray-900">Edit Profile</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 20 }}>
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1">
              Display Name
            </Text>
            <View className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
              <TextInput
                className="text-base text-gray-900"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1">
              Home Club
            </Text>
            <View className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
              <TextInput
                className="text-base text-gray-900"
                value={homeClub}
                onChangeText={setHomeClub}
                placeholder="e.g. Finchley Golf Club"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              Goals
            </Text>
            <View className="flex-row gap-2">
              {goalOptions.map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGoals(g.toLowerCase())}
                  className={`flex-1 py-2.5 rounded-xl border items-center ${
                    goals === g.toLowerCase()
                      ? "bg-green-600 border-green-600"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      goals === g.toLowerCase() ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View className="px-4 pb-10 pt-4 border-t border-gray-100">
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className={`rounded-full py-4 items-center ${
              saving ? "bg-green-300" : "bg-green-600"
            }`}
          >
            <Text className="text-white font-semibold text-base">
              {saving ? "Saving…" : "Save Profile"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── menu item ─────────────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  onPress,
  destructive,
  rightText,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  rightText?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center px-4 py-4 bg-white border-b border-gray-50"
    >
      <View
        className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
          destructive ? "bg-red-50" : "bg-gray-50"
        }`}
      >
        <Ionicons
          name={icon}
          size={18}
          color={destructive ? "#ef4444" : "#6b7280"}
        />
      </View>
      <Text
        className={`flex-1 text-base font-medium ${
          destructive ? "text-red-600" : "text-gray-900"
        }`}
      >
        {label}
      </Text>
      {rightText ? (
        <Text className="text-sm text-gray-400 mr-1">{rightText}</Text>
      ) : null}
      {!destructive && (
        <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
      )}
    </TouchableOpacity>
  );
}

// ── main screen ────────────────────────────────────────────────────────────────

export default function MeScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const userId = user?.id ?? "";

  const [editModalVisible, setEditModalVisible] = useState(false);

  const profile = useQuery(
    api.golferProfiles.get,
    userId ? { userId } : "skip"
  );
  const handicap = useQuery(
    api.handicap.getLatest,
    userId ? { userId } : "skip"
  );
  const handicapHistory = useQuery(
    api.handicap.getHistory,
    userId ? { userId, limit: 5 } : "skip"
  );
  const stats = useQuery(
    api.rounds.getStats,
    userId ? { userId } : "skip"
  );

  const isLoading =
    profile === undefined || handicap === undefined || stats === undefined;

  const displayName =
    profile?.displayName ?? user?.fullName ?? user?.firstName ?? "Golfer";
  const homeClub = profile?.homeClub;
  const initials = getInitials(displayName);

  // Handicap direction from last 2 history entries
  let direction: "up" | "down" | "same" | undefined;
  if (handicapHistory && handicapHistory.length >= 2) {
    const latest = handicapHistory[0];
    const prev = handicapHistory[1];
    if (latest && prev) {
      direction =
        latest.handicapIndex < prev.handicapIndex
          ? "down"
          : latest.handicapIndex > prev.handicapIndex
          ? "up"
          : "same";
    }
  }

  const statItems = stats
    ? [
        { label: "Rounds", value: stats.totalRounds },
        { label: "Avg Score", value: stats.avgGross?.toFixed(1) ?? "–" },
        { label: "Best", value: stats.bestGross ?? "–" },
      ]
    : [];

  function handleSignOut() {
    Alert.alert("Sign out?", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () =>
          signOut().catch(() => Alert.alert("Error", "Could not sign out.")),
      },
    ]);
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "My Profile", headerShown: false }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Me", headerShown: false }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* profile card */}
        <View className="bg-white border-b border-gray-100 px-4 pt-14 pb-6">
          <View className="flex-row items-center gap-4 mb-4">
            {/* avatar */}
            <View className="w-20 h-20 rounded-full bg-green-600 items-center justify-center">
              <Text className="text-white text-3xl font-bold">{initials}</Text>
            </View>
            {/* info */}
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {displayName}
              </Text>
              {homeClub && (
                <View className="flex-row items-center gap-1 mt-0.5">
                  <Ionicons name="golf-outline" size={13} color="#9ca3af" />
                  <Text className="text-sm text-gray-500">{homeClub}</Text>
                </View>
              )}
              <View className="mt-2">
                <HandicapBadge
                  index={handicap ?? null}
                  direction={direction}
                  size="sm"
                />
              </View>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setEditModalVisible(true)}
            className="border border-gray-200 rounded-full py-2.5 items-center"
          >
            <Text className="text-gray-700 font-semibold text-sm">
              Edit Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* stats */}
        {stats && (
          <View className="mx-4 mt-4 mb-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Stats
            </Text>
            <StatRow stats={statItems} />
            {(stats.girPct !== null ||
              stats.fairwayPct !== null ||
              stats.avgPutts !== null) && (
              <View className="mt-3 pt-3 border-t border-gray-50 flex-row gap-4">
                {stats.girPct !== null && (
                  <View className="items-center flex-1">
                    <Text className="text-base font-bold text-gray-900">
                      {stats.girPct}%
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">GIR</Text>
                  </View>
                )}
                {stats.fairwayPct !== null && (
                  <View className="items-center flex-1">
                    <Text className="text-base font-bold text-gray-900">
                      {stats.fairwayPct}%
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      Fairways
                    </Text>
                  </View>
                )}
                {stats.avgPutts !== null && (
                  <View className="items-center flex-1">
                    <Text className="text-base font-bold text-gray-900">
                      {stats.avgPutts}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      Avg Putts
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* handicap history */}
        {handicapHistory && handicapHistory.length > 0 && (
          <View className="mx-4 mb-4">
            <SectionHeader title="Handicap History" />
            <View className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {handicapHistory.slice(0, 5).map((entry: any, i: number) => {
                const change = entry.change ?? 0;
                return (
                  <View
                    key={entry._id ?? i}
                    className="flex-row items-center px-4 py-3 border-b border-gray-50"
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900">
                        {entry.handicapIndex?.toFixed(1) ?? "–"}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {entry.date ? formatDate(entry.date) : "–"}
                      </Text>
                    </View>
                    {change !== 0 && (
                      <View
                        className={`flex-row items-center gap-0.5 rounded-full px-2 py-0.5 ${
                          change < 0 ? "bg-green-100" : "bg-red-100"
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            change < 0 ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {change < 0 ? "↓" : "↑"}{" "}
                          {Math.abs(change).toFixed(1)}
                        </Text>
                      </View>
                    )}
                    {change === 0 && (
                      <Text className="text-xs text-gray-300">–</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* menu */}
        <View className="mx-4 mb-4">
          <SectionHeader title="More" />
          <View className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => router.push("/(app)/me/settings" as any)}
            />
            <MenuItem
              icon="golf-outline"
              label="My Rounds"
              onPress={() => router.push("/(app)/rounds" as any)}
            />
            <MenuItem
              icon="trophy-outline"
              label="Competition History"
              onPress={() => router.push("/(app)/me/competition-history" as any)}
            />
            <MenuItem
              icon="card-outline"
              label="Subscription"
              rightText="Free"
              onPress={() =>
                Alert.alert(
                  "Coming soon",
                  "Subscription management coming soon."
                )
              }
            />
            <MenuItem
              icon="help-circle-outline"
              label="Help & Support"
              onPress={() =>
                Linking.openURL("mailto:support@playthepool.golf")
              }
            />
          </View>
        </View>

        {/* sign out */}
        <View className="mx-4">
          <View className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
            <MenuItem
              icon="log-out-outline"
              label="Sign Out"
              onPress={handleSignOut}
              destructive
            />
          </View>
        </View>
      </ScrollView>

      <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        currentDisplayName={displayName}
        currentHomeClub={homeClub}
        currentGoals={profile?.goals}
      />
    </>
  );
}
