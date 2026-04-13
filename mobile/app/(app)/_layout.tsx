import { useAuth, useUser } from "@clerk/clerk-expo";
import { Redirect, Tabs, useSegments, useRouter } from "expo-router";
import { View, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { api } from "../../lib/convex";

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  // Get Expo push token
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: "your-eas-project-id", // Replace with actual EAS project ID
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

  // Check if golfer profile exists
  const profile = useQuery(
    api.golferProfiles.get,
    user ? { userId: user.id } : "skip"
  );

  const savePushToken = useMutation(api.pushNotifications.saveToken);

  // Register push notifications once profile is confirmed
  useEffect(() => {
    if (!user || profile === undefined) return;
    if (profile === null) return; // wait for onboarding to complete

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

  // First time user — no golfer profile yet
  if (profile === null && !segments.includes("onboarding" as never)) {
    return <Redirect href="/(app)/onboarding" />;
  }

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
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: "Play",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: "#16a34a",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: Platform.OS === "ios" ? 8 : 4,
                shadowColor: "#16a34a",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: focused ? 0.5 : 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <Ionicons name="golf-outline" size={26} color="#fff" />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="club"
        options={{
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
      {/* Hidden screens — not shown as tabs */}
      <Tabs.Screen name="onboarding" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
