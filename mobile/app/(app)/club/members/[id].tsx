import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/clerk-expo";
import { api } from "../../../../lib/convex";
import { LoadingSpinner } from "../../../../components/ui";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

function RoleBadge({ role }: { role: string }) {
  if (role === "admin") {
    return (
      <View className="bg-green-100 rounded-full px-3 py-1">
        <Text className="text-xs font-semibold text-green-700">Admin</Text>
      </View>
    );
  }
  if (role === "staff") {
    return (
      <View className="bg-blue-100 rounded-full px-3 py-1">
        <Text className="text-xs font-semibold text-blue-700">Staff</Text>
      </View>
    );
  }
  return (
    <View className="bg-gray-100 rounded-full px-3 py-1">
      <Text className="text-xs font-semibold text-gray-500">Member</Text>
    </View>
  );
}

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();

  const member = useQuery(
    api.clubMembers.get,
    id ? { memberId: id as any } : "skip"
  );
  const profile = useQuery(
    api.golferProfiles.get,
    member?.userId ? { userId: member.userId } : "skip"
  );
  const myProfile = useQuery(
    api.golferProfiles.get,
    user?.id ? { userId: user.id } : "skip"
  );

  const startConversation = useMutation(api.messaging.getOrCreateDirect);
  const [starting, setStarting] = useState(false);

  async function handleMessage() {
    if (!member?.userId) {
      Alert.alert("Not available", "This member hasn't set up their profile yet.");
      return;
    }
    if (!user) return;
    setStarting(true);
    try {
      const convId = await startConversation({
        myUserId: user.id,
        otherUserId: member.userId,
        myDisplayName: myProfile?.displayName ?? user.fullName ?? "Unknown",
        myAvatarUrl: (myProfile as any)?.avatarUrl ?? undefined,
        otherDisplayName: member.displayName,
        otherAvatarUrl: (member as any).avatarUrl ?? undefined,
      });
      router.push(`/(app)/club/messages/${convId}` as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not open conversation.");
    } finally {
      setStarting(false);
    }
  }

  if (member === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Member" }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  if (!member) {
    return (
      <>
        <Stack.Screen options={{ title: "Member" }} />
        <View className="flex-1 items-center justify-center bg-white px-8">
          <Ionicons name="person-outline" size={48} color="#d1d5db" />
          <Text className="text-gray-900 font-bold text-xl mt-4">Member not found</Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-6">
            <Text className="text-green-600 font-semibold">← Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const handicap = profile?.handicapIndex ?? (member as any).handicapIndex ?? null;
  const joinedYear = member.joinedAt
    ? new Date(member.joinedAt).getFullYear()
    : null;

  // Don't show message button for yourself
  const isSelf = member.userId && user?.id === member.userId;

  return (
    <>
      <Stack.Screen options={{ title: member.displayName }} />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile header */}
        <View className="bg-white px-6 pt-8 pb-6 items-center border-b border-gray-100">
          <View className="w-20 h-20 rounded-full bg-green-600 items-center justify-center mb-3"
            style={{
              shadowColor: "#16a34a",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <Text className="text-white text-2xl font-bold">
              {getInitials(member.displayName)}
            </Text>
          </View>
          <Text className="text-xl font-bold text-gray-900 mb-1.5">{member.displayName}</Text>
          <RoleBadge role={member.role} />
          {joinedYear && (
            <Text className="text-xs text-gray-400 mt-2">Member since {joinedYear}</Text>
          )}
        </View>

        {/* Handicap */}
        {handicap !== null && (
          <View className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 overflow-hidden"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View className="px-4 py-3 border-b border-gray-50">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Handicap</Text>
            </View>
            <View className="flex-row items-center px-4 py-4">
              <View className="w-14 h-14 rounded-full bg-green-600 items-center justify-center mr-4"
                style={{
                  shadowColor: "#16a34a",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              >
                <Text className="text-white font-bold text-lg">{handicap.toFixed(1)}</Text>
              </View>
              <View>
                <Text className="text-base font-semibold text-gray-900">WHS Handicap Index</Text>
                <Text className="text-xs text-gray-400 mt-0.5">World Handicap System</Text>
              </View>
            </View>
          </View>
        )}

        {/* Stats */}
        {(member as any).totalWon > 0 && (
          <View className="mx-4 mt-3 bg-white rounded-2xl border border-gray-100 overflow-hidden"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <View className="px-4 py-3 border-b border-gray-50">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Club Stats</Text>
            </View>
            <View className="flex-row">
              {[
                { label: "Total Won", value: `£${((member as any).totalWon / 100).toFixed(2)}` },
                { label: "Competitions", value: (member as any).totalEntered ?? "—" },
              ].map((stat, i, arr) => (
                <View
                  key={stat.label}
                  className={`flex-1 px-4 py-4 items-center ${i < arr.length - 1 ? "border-r border-gray-100" : ""}`}
                >
                  <Text className="text-lg font-bold text-gray-900">{stat.value}</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        {!isSelf && (
          <View className="mx-4 mt-3 gap-2">
            <TouchableOpacity
              onPress={handleMessage}
              disabled={starting}
              className="flex-row items-center bg-green-600 rounded-2xl px-4 py-4 gap-3"
              style={{
                shadowColor: "#16a34a",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 3,
                opacity: starting ? 0.7 : 1,
              }}
            >
              <View className="w-9 h-9 rounded-full bg-white/20 items-center justify-center">
                {starting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                )}
              </View>
              <Text className="text-white font-semibold flex-1">
                {starting ? "Opening…" : `Message ${member.displayName.split(" ")[0]}`}
              </Text>
              {!starting && <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </>
  );
}
