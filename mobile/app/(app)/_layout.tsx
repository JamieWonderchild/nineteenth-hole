import { useAuth, useUser } from "@clerk/clerk-expo";
import { Redirect, Tabs, useSegments, useRouter } from "expo-router";
import { View, ActivityIndicator, Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { useEffect } from "react";
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

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();

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

  const isClubMember = !!myClubs && myClubs.length > 0;

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
                  router.push("/(app)/rounds/new" as any);
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
  );
}
