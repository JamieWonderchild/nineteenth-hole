import { useAuth, useUser } from "@clerk/clerk-expo";
import { Redirect, Tabs, useSegments, useRouter } from "expo-router";
import { View, ActivityIndicator, Platform, TouchableOpacity, Modal, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../lib/convex";

// expo-notifications requires a compiled native module — load lazily so a
// missing module never crashes the layout (e.g. Expo Go or a stale build).
let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: "064fd2c1-f2d3-492d-9e1f-64d2b19a4892",
    });
    return token.data;
  } catch {
    return null;
  }
}

function ActionSheet({
  visible,
  onClose,
  onLogRound,
  onQuickGame,
}: {
  visible: boolean;
  onClose: () => void;
  onLogRound: () => void;
  onQuickGame: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <View style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 8,
            paddingBottom: Platform.OS === "ios" ? 36 : 20,
            paddingHorizontal: 16,
          }}>
            {/* Drag handle */}
            <View style={{ width: 36, height: 4, backgroundColor: "#e5e7eb", borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />

            {/* Log a Round */}
            <TouchableOpacity
              onPress={onLogRound}
              activeOpacity={0.85}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#16a34a",
                borderRadius: 16,
                padding: 18,
                marginBottom: 10,
                gap: 14,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="golf" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Log a Round</Text>
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 2 }}>
                  Track your score · counts toward handicap
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            {/* Quick Game */}
            <TouchableOpacity
              onPress={onQuickGame}
              activeOpacity={0.85}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#f9fafb",
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 16,
                padding: 18,
                gap: 14,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#fef3c7", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="flash" size={22} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#111827", fontWeight: "700", fontSize: 16 }}>Quick Game</Text>
                <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                  Skins · Nassau · Stableford with friends
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();
  const [showActionSheet, setShowActionSheet] = useState(false);

  const profile = useQuery(
    api.golferProfiles.get,
    user ? { userId: user.id } : "skip"
  );

  const myClubs = useQuery(
    api.clubMembers.myActiveClubs,
    isSignedIn ? {} : "skip"
  );

  const inProgressRound = useQuery(api.rounds.getInProgress);
  const savePushToken = useMutation(api.pushNotifications.saveToken);

  useEffect(() => {
    if (!user || profile === undefined || profile === null) return;
    registerForPushNotifications().then(token => {
      if (token) {
        savePushToken({
          token,
          platform: Platform.OS === "ios" ? "ios" : "android",
        }).catch(console.error);
      }
    });
  }, [user?.id, profile?._id]);

  if (!isLoaded || (isSignedIn && profile === undefined)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (profile === null && !segments.includes("onboarding" as never)) {
    return <Redirect href="/(app)/onboarding" />;
  }

  // Keep club tab visible while myClubs is still loading (undefined) to prevent
  // it from disappearing and causing navigation resets on lock/unlock resume.
  const isClubMember = myClubs === undefined || myClubs.length > 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#16a34a",
        tabBarInactiveTintColor: "#9ca3af",
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#166534",
        headerTitleStyle: { fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#f3f4f6",
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rounds"
        options={{
          title: "Rounds",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: "Log Round",
          headerShown: false,
          tabBarLabel: () => null,
          tabBarButton: ({ style }) => (
            <TouchableOpacity
              style={style}
              activeOpacity={0.85}
              onPress={() => {
                if (inProgressRound) {
                  router.push(`/(app)/rounds/score?roundId=${inProgressRound._id}` as any);
                } else {
                  setShowActionSheet(true);
                }
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "#16a34a",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: Platform.OS === "ios" ? 8 : 4,
                  shadowColor: "#16a34a",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  elevation: 6,
                }}
              >
                <Ionicons name="add" size={30} color="#fff" />
              </View>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="club"
        options={{
          href: isClubMember ? undefined : null,
          title: "Club",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
    <ActionSheet
      visible={showActionSheet}
      onClose={() => setShowActionSheet(false)}
      onLogRound={() => { setShowActionSheet(false); router.push("/(app)/rounds/new" as any); }}
      onQuickGame={() => { setShowActionSheet(false); router.push("/(app)/play/games/new" as any); }}
    />
  );
}
