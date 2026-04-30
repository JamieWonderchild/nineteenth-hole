/**
 * New message — pick a club member to start or resume a direct conversation.
 *
 * If a conversation with the selected member already exists, navigates straight
 * to it. Otherwise navigates to compose.tsx where the conversation is only
 * created when the first message is actually sent.
 */
import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../lib/convex";
import { EmptyState, LoadingSpinner } from "../../../../components/ui";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

type Member = {
  _id: string;
  userId?: string;
  displayName: string;
  role: string;
  handicapIndex?: number;
};

function MemberRow({ member, onPress }: { member: Member; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center px-4 py-3.5 bg-white border-b border-gray-50"
    >
      <View className="w-11 h-11 rounded-full bg-green-600 items-center justify-center mr-3">
        <Text className="text-white text-sm font-bold">
          {getInitials(member.displayName)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {member.displayName}
        </Text>
        {member.handicapIndex != null && (
          <Text className="text-xs text-gray-400">HCP {member.handicapIndex.toFixed(1)}</Text>
        )}
      </View>
      <Ionicons name="chatbubble-outline" size={18} color="#16a34a" />
    </TouchableOpacity>
  );
}

export default function NewMessageScreen() {
  const { user } = useUser();
  const router = useRouter();
  const userId = user?.id ?? "";

  const [search, setSearch] = useState("");

  const clubs = useQuery(api.clubMembers.myActiveClubs, {});
  const clubId = clubs?.[0]?.club._id;

  const rawMembers = useQuery(
    api.clubMembers.listWithProfiles,
    clubId ? { clubId: clubId as any } : "skip"
  );

  // Load existing conversations so we can detect ones already started
  const conversations = useQuery(
    api.messaging.listMyConversations,
    userId ? { userId } : "skip"
  );

  const members = useMemo(() => {
    if (!rawMembers) return [];
    const others = rawMembers.filter((m: any) => m.userId !== userId);
    const q = search.trim().toLowerCase();
    const filtered = q
      ? others.filter((m: any) => m.displayName.toLowerCase().includes(q))
      : others;
    return [...filtered].sort((a: any, b: any) =>
      a.displayName.localeCompare(b.displayName)
    );
  }, [rawMembers, search, userId]);

  const isLoading =
    clubs === undefined ||
    conversations === undefined ||
    (clubId && rawMembers === undefined);

  function handleSelect(member: Member) {
    if (!member.userId) {
      Alert.alert("Can't message this member", "They haven't set up their account yet.");
      return;
    }

    // If a conversation already exists with this person, go straight to it
    const existing = (conversations as any[])?.find(
      (c: any) =>
        c.type === "direct" &&
        c.members?.some((m: any) => m.userId === member.userId)
    );

    if (existing) {
      router.replace(`/(app)/club/messages/${existing._id}` as any);
    } else {
      // No conversation yet — go to compose screen, which only creates it on
      // first send
      router.push(
        `/(app)/club/messages/compose?recipientId=${encodeURIComponent(member.userId)}&recipientName=${encodeURIComponent(member.displayName)}` as any
      );
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "New Message" }} />

      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5 gap-2">
          <Ionicons name="search-outline" size={16} color="#9ca3af" />
          <TextInput
            className="flex-1 text-base text-gray-900"
            placeholder="Search members..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoFocus
          />
        </View>
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : !clubId ? (
        <EmptyState
          icon="people-outline"
          title="No club found"
          description="Join a club to message members."
        />
      ) : (
        <FlatList
          className="flex-1 bg-white"
          data={members as Member[]}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <MemberRow member={item} onPress={() => handleSelect(item)} />
          )}
          ListHeaderComponent={
            members.length > 0 ? (
              <View className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <Text className="text-xs text-gray-400 font-medium">
                  {members.length} {members.length === 1 ? "member" : "members"}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            search ? (
              <EmptyState
                icon="search-outline"
                title="No results"
                description={`No members matching "${search}"`}
              />
            ) : (
              <EmptyState
                icon="people-outline"
                title="No other members"
                description="No club members to message yet."
              />
            )
          }
          contentContainerStyle={
            members.length === 0 ? { flexGrow: 1 } : { paddingBottom: 32 }
          }
          keyboardShouldPersistTaps="handled"
        />
      )}
    </>
  );
}
