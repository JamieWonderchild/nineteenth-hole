import { useAuth, useUser } from "@clerk/clerk-expo";
import { Redirect, Tabs, useSegments, useRouter } from "expo-router";
import { View, ActivityIndicator, Platform, TouchableOpacity, Modal, Text, Pressable, AppState, Animated, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { useEffect, useState, useRef } from "react";
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

const SCREEN_W = Dimensions.get("window").width;
const BTN_SIZE = 56;
// Approximate center of the "+" button from screen bottom
const FAB_CENTER_BOTTOM = Platform.OS === "ios" ? 44 : 36;
// Radial spread: 45° from vertical, radius 90px
const RAD_R = 90;
const RAD_DX = Math.round(RAD_R * Math.sin(Math.PI / 4)); // ≈ 64
const RAD_DY = Math.round(RAD_R * Math.cos(Math.PI / 4)); // ≈ 64
// Static start: container bottom edge so circle center aligns with "+"
const BTN_START_BOTTOM = FAB_CENTER_BOTTOM - BTN_SIZE / 2;
// Horizontally centered
const BTN_START_LEFT = SCREEN_W / 2 - BTN_SIZE / 2;

function FABMenu({
  visible,
  btn1Anim,
  btn2Anim,
  onClose,
  onLogRound,
  onQuickGame,
}: {
  visible: boolean;
  btn1Anim: Animated.Value;
  btn2Anim: Animated.Value;
  onClose: () => void;
  onLogRound: () => void;
  onQuickGame: () => void;
}) {
  // Log a Round — springs upper-left at 45°
  const btn1TX = btn1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -RAD_DX] });
  const btn1TY = btn1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -RAD_DY] });
  const btn1Scale = btn1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  // Quick Game — springs upper-right at 45°
  const btn2TX = btn2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, RAD_DX] });
  const btn2TY = btn2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -RAD_DY] });
  const btn2Scale = btn2Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop — tap anywhere outside buttons to close */}
      <Pressable
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" }}
        onPress={onClose}
      />

      {/* Log a Round — upper-left of "+" */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: BTN_START_BOTTOM,
          left: BTN_START_LEFT,
          width: BTN_SIZE,
          alignItems: "center",
          overflow: "visible",
          transform: [{ translateX: btn1TX }, { translateY: btn1TY }, { scale: btn1Scale }],
          opacity: btn1Anim,
        }}
      >
        <TouchableOpacity
          onPress={onLogRound}
          activeOpacity={0.85}
          style={{
            width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2,
            backgroundColor: "#16a34a",
            alignItems: "center", justifyContent: "center",
            shadowColor: "#16a34a", shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
          }}
        >
          <Ionicons name="golf" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{
          color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 6,
          textAlign: "center", width: 80, marginLeft: -12,
          textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
        }}>
          Log a Round
        </Text>
      </Animated.View>

      {/* Quick Game — upper-right of "+" */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: BTN_START_BOTTOM,
          left: BTN_START_LEFT,
          width: BTN_SIZE,
          alignItems: "center",
          overflow: "visible",
          transform: [{ translateX: btn2TX }, { translateY: btn2TY }, { scale: btn2Scale }],
          opacity: btn2Anim,
        }}
      >
        <TouchableOpacity
          onPress={onQuickGame}
          activeOpacity={0.85}
          style={{
            width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2,
            backgroundColor: "#fef3c7",
            alignItems: "center", justifyContent: "center",
            shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
          }}
        >
          <Ionicons name="flash" size={24} color="#d97706" />
        </TouchableOpacity>
        <Text style={{
          color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 6,
          textAlign: "center", width: 80, marginLeft: -12,
          textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
        }}>
          Quick Game
        </Text>
      </Animated.View>
    </Modal>
  );
}

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();

  // Speed dial FAB animation
  const fabAnim = useRef(new Animated.Value(0)).current;
  const btn1Anim = useRef(new Animated.Value(0)).current;
  const btn2Anim = useRef(new Animated.Value(0)).current;
  const [fabOpen, setFabOpen] = useState(false);

  const openFab = () => {
    btn1Anim.setValue(0);
    btn2Anim.setValue(0);
    fabAnim.setValue(0);
    setFabOpen(true);
    Animated.parallel([
      Animated.timing(fabAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.stagger(60, [
        Animated.spring(btn1Anim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }),
        Animated.spring(btn2Anim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }),
      ]),
    ]).start();
  };

  const closeFab = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fabAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.spring(btn1Anim, { toValue: 0, useNativeDriver: true, friction: 10 }),
      Animated.spring(btn2Anim, { toValue: 0, useNativeDriver: true, friction: 10 }),
    ]).start(() => {
      setFabOpen(false);
      callback?.();
    });
  };

  const fabRotate = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const profile = useQuery(
    api.golferProfiles.get,
    user ? { userId: user.id } : "skip"
  );

  const myClubs = useQuery(
    api.clubMembers.myActiveClubs,
    isSignedIn ? {} : "skip"
  );

  const inProgressRound = useQuery(api.rounds.getInProgress);
  const unreadCount = useQuery(
    api.messaging.totalUnread,
    user?.id ? { userId: user.id } : "skip"
  );
  const savePushToken = useMutation(api.pushNotifications.saveToken);

  // Re-subscribe to Convex when app returns to foreground after lock/background
  const appState = useRef(AppState.currentState);
  const [, forceRefresh] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        forceRefresh(n => n + 1);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  // Deep-link from notification tap → navigate to the right screen
  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (!data?.type) return;
      if (data.type === "message" && data.conversationId) {
        router.push(`/(app)/club/messages/${data.conversationId}` as any);
      } else if (data.type === "attestation" || data.type === "attestation_result") {
        router.push("/(app)/rounds" as any);
      }
    });
    return () => sub.remove();
  }, []);

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
    <>
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
                  fabOpen ? closeFab() : openFab();
                }
              }}
            >
              <Animated.View
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
                  transform: [{ rotate: fabRotate }],
                }}
              >
                <Ionicons name="add" size={30} color="#fff" />
              </Animated.View>
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
            <View>
              <Ionicons name="people-outline" size={size} color={color} />
              {!!unreadCount && unreadCount > 0 && (
                <View style={{
                  position: "absolute", top: -4, right: -8,
                  backgroundColor: "#dc2626", borderRadius: 8,
                  minWidth: 16, height: 16, paddingHorizontal: 3,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                    {unreadCount > 99 ? "99+" : String(unreadCount)}
                  </Text>
                </View>
              )}
            </View>
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
    <FABMenu
      visible={fabOpen}
      btn1Anim={btn1Anim}
      btn2Anim={btn2Anim}
      onClose={() => closeFab()}
      onLogRound={() => closeFab(() => router.push("/(app)/rounds/new" as any))}
      onQuickGame={() => closeFab(() => router.push("/(app)/play/games/new" as any))}
    />
    </>
  );
}
