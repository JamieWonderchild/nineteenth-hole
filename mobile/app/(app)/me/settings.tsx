import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from "react-native";
import { Stack } from "expo-router";
import { useUser, useClerk } from "@clerk/clerk-expo";
import { useMutation, useQuery } from "convex/react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../lib/convex";
import { LoadingSpinner } from "../../../components/ui";

// ── storage keys ──────────────────────────────────────────────────────────────

const NOTIF_KEYS = {
  newCompetition: "notif_new_competition",
  myResults: "notif_my_results",
  messages: "notif_messages",
  teeTimeReminders: "notif_tee_time_reminders",
};

// ── toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-50">
      <Text className="text-base text-gray-900">{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#e5e7eb", true: "#86efac" }}
        thumbColor={value ? "#16a34a" : "#9ca3af"}
      />
    </View>
  );
}

// ── section label ─────────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 pt-6 pb-2">
      {title}
    </Text>
  );
}

// ── link row ───────────────────────────────────────────────────────────────────

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-50"
    >
      <Text className="text-base text-gray-900">{label}</Text>
      <Ionicons name="open-outline" size={16} color="#9ca3af" />
    </TouchableOpacity>
  );
}

// ── main screen ────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const userId = user?.id ?? "";

  const profile = useQuery(
    api.golferProfiles.get,
    userId ? { userId } : "skip"
  );
  const upsertProfile = useMutation(api.golferProfiles.upsert);

  // Notification toggles (stored in AsyncStorage)
  const [notifNewComp, setNotifNewComp] = useState(true);
  const [notifMyResults, setNotifMyResults] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifTeeTime, setNotifTeeTime] = useState(true);

  // Profile fields
  const [homeClub, setHomeClub] = useState("");
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState("");

  const appVersion =
    Constants.expoConfig?.version ?? Constants.manifest?.version ?? "1.0.0";

  // Load notification prefs from AsyncStorage
  useEffect(() => {
    async function load() {
      try {
        const [nc, mr, ms, tt] = await Promise.all([
          AsyncStorage.getItem(NOTIF_KEYS.newCompetition),
          AsyncStorage.getItem(NOTIF_KEYS.myResults),
          AsyncStorage.getItem(NOTIF_KEYS.messages),
          AsyncStorage.getItem(NOTIF_KEYS.teeTimeReminders),
        ]);
        if (nc !== null) setNotifNewComp(nc === "true");
        if (mr !== null) setNotifMyResults(mr === "true");
        if (ms !== null) setNotifMessages(ms === "true");
        if (tt !== null) setNotifTeeTime(tt === "true");
      } catch {
        // ignore
      }
    }
    load();
  }, []);

  // Load profile fields
  useEffect(() => {
    if (profile) {
      setHomeClub(profile.homeClub ?? "");
      setSelectedGoal(profile.goals ?? "");
    }
  }, [profile]);

  async function saveNotif(key: string, value: boolean) {
    try {
      await AsyncStorage.setItem(key, value ? "true" : "false");
    } catch {
      // ignore
    }
  }

  async function saveGoal(goal: string) {
    setSelectedGoal(goal);
    if (!profile) return;
    setGoalsSaving(true);
    try {
      await upsertProfile({
        displayName: profile.displayName,
        homeClub: profile.homeClub,
        goals: goal || undefined,
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save.");
    } finally {
      setGoalsSaving(false);
    }
  }

  async function saveHomeClub() {
    if (!profile) return;
    try {
      await upsertProfile({
        displayName: profile.displayName,
        homeClub: homeClub.trim() || undefined,
        goals: profile.goals,
      });
      Alert.alert("Saved", "Home club updated.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to save.");
    }
  }

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

  if (profile === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Settings" }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  const goalOptions = [
    { label: "Casual", value: "casual" },
    { label: "Competitive", value: "competitive" },
    { label: "Social", value: "social" },
  ];

  return (
    <>
      <Stack.Screen options={{ title: "Settings" }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* notifications */}
        <SectionLabel title="Notifications" />
        <View className="rounded-xl overflow-hidden mx-0 border-t border-gray-100">
          <ToggleRow
            label="New competition opens"
            value={notifNewComp}
            onChange={(v) => {
              setNotifNewComp(v);
              saveNotif(NOTIF_KEYS.newCompetition, v);
            }}
          />
          <ToggleRow
            label="My results"
            value={notifMyResults}
            onChange={(v) => {
              setNotifMyResults(v);
              saveNotif(NOTIF_KEYS.myResults, v);
            }}
          />
          <ToggleRow
            label="Messages"
            value={notifMessages}
            onChange={(v) => {
              setNotifMessages(v);
              saveNotif(NOTIF_KEYS.messages, v);
            }}
          />
          <ToggleRow
            label="Tee time reminders"
            value={notifTeeTime}
            onChange={(v) => {
              setNotifTeeTime(v);
              saveNotif(NOTIF_KEYS.teeTimeReminders, v);
            }}
          />
        </View>

        {/* profile */}
        <SectionLabel title="Profile" />
        <View className="border-t border-gray-100">
          {/* goals picker */}
          <View className="px-4 py-4 bg-white border-b border-gray-50">
            <Text className="text-sm font-semibold text-gray-700 mb-3">
              Goals
            </Text>
            <View className="flex-row gap-2">
              {goalOptions.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  onPress={() => saveGoal(g.value)}
                  disabled={goalsSaving}
                  className={`flex-1 py-2.5 rounded-xl border items-center ${
                    selectedGoal === g.value
                      ? "bg-green-600 border-green-600"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selectedGoal === g.value ? "text-white" : "text-gray-700"
                    }`}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* home club */}
          <View className="px-4 py-4 bg-white border-b border-gray-50">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              Home Club
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50">
                <TextInput
                  className="text-base text-gray-900"
                  value={homeClub}
                  onChangeText={setHomeClub}
                  placeholder="e.g. Finchley Golf Club"
                  placeholderTextColor="#9ca3af"
                  returnKeyType="done"
                  onSubmitEditing={saveHomeClub}
                />
              </View>
              <TouchableOpacity
                onPress={saveHomeClub}
                className="bg-green-600 rounded-xl px-4 py-2.5"
              >
                <Text className="text-white font-semibold text-sm">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* account */}
        <SectionLabel title="Account" />
        <View className="border-t border-gray-100">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-50">
            <Text className="text-base text-gray-900">Email</Text>
            <Text className="text-sm text-gray-400" numberOfLines={1}>
              {user?.emailAddresses?.[0]?.emailAddress ?? "–"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSignOut}
            className="flex-row items-center px-4 py-4 bg-white border-b border-gray-50"
          >
            <Text className="text-base font-medium text-red-600">Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* app */}
        <SectionLabel title="App" />
        <View className="border-t border-gray-100">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-50">
            <Text className="text-base text-gray-900">Version</Text>
            <Text className="text-sm text-gray-400">{appVersion}</Text>
          </View>
          <LinkRow
            label="Privacy Policy"
            onPress={() =>
              Linking.openURL("https://nineteenth-hole.com/privacy")
            }
          />
          <LinkRow
            label="Terms of Service"
            onPress={() =>
              Linking.openURL("https://nineteenth-hole.com/terms")
            }
          />
        </View>
      </ScrollView>
    </>
  );
}
