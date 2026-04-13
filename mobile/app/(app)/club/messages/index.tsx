import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../lib/convex";
import { EmptyState, LoadingSpinner } from "../../../../components/ui";

// ── helpers ────────────────────────────────────────────────────────────────────

function formatRelativeTime(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── conversation row ──────────────────────────────────────────────────────────

type Conversation = {
  _id: string;
  type: "direct" | "group";
  name?: string;
  lastMessage?: {
    body: string;
    senderId: string;
    senderName?: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  lastMessageAt: string;
};

function ConversationRow({
  conversation,
  userId,
  onPress,
}: {
  conversation: Conversation;
  userId: string;
  onPress: () => void;
}) {
  const isGroup = conversation.type === "group";
  const name = conversation.name ?? "Unknown";
  const initials = getInitials(name);
  const lastMsg = conversation.lastMessage;
  const isMine = lastMsg?.senderId === userId;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white border-b border-gray-50 px-4 py-4 flex-row items-center gap-3"
    >
      {/* avatar */}
      <View
        className={`w-12 h-12 rounded-full items-center justify-center ${
          isGroup ? "bg-purple-100" : "bg-green-100"
        }`}
      >
        {isGroup ? (
          <Ionicons name="people" size={22} color="#7c3aed" />
        ) : (
          <Text className="text-green-700 font-bold text-base">{initials}</Text>
        )}
      </View>

      {/* content */}
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center justify-between">
          <Text
            className="font-semibold text-gray-900 text-base flex-1 mr-2"
            numberOfLines={1}
          >
            {name}
          </Text>
          {lastMsg && (
            <Text className="text-xs text-gray-400">
              {formatRelativeTime(lastMsg.createdAt)}
            </Text>
          )}
        </View>
        {lastMsg ? (
          <Text className="text-sm text-gray-500" numberOfLines={1}>
            {isGroup && !isMine && lastMsg.senderName
              ? `${lastMsg.senderName}: `
              : isMine
              ? "You: "
              : ""}
            {lastMsg.body}
          </Text>
        ) : (
          <Text className="text-sm text-gray-400 italic">No messages yet</Text>
        )}
      </View>

      {/* unread badge */}
      {conversation.unreadCount > 0 && (
        <View className="bg-green-600 rounded-full w-5 h-5 items-center justify-center">
          <Text className="text-white text-xs font-bold">
            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── main screen ────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { user } = useUser();
  const router = useRouter();
  const userId = user?.id ?? "";

  const conversations = useQuery(
    api.messaging.listMyConversations,
    userId ? { userId } : "skip"
  );

  const isLoading = conversations === undefined;

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Messages",
            headerRight: () => (
              <TouchableOpacity
                onPress={() => Alert.alert("Coming soon", "New message coming soon.")}
                className="mr-2"
              >
                <Ionicons name="create-outline" size={24} color="#166534" />
              </TouchableOpacity>
            ),
          }}
        />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Messages",
          headerRight: () => (
            <TouchableOpacity
              onPress={() =>
                Alert.alert("Coming soon", "New message coming soon.")
              }
              className="mr-2"
            >
              <Ionicons name="create-outline" size={24} color="#166534" />
            </TouchableOpacity>
          ),
        }}
      />

      {conversations.length === 0 ? (
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="No messages yet"
          description="Start a conversation with your club members."
        />
      ) : (
        <FlatList
          className="flex-1 bg-white"
          data={conversations as Conversation[]}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              userId={userId}
              onPress={() =>
                router.push(`/(app)/club/messages/${item._id}` as any)
              }
            />
          )}
          refreshControl={
            <RefreshControl refreshing={false} tintColor="#16a34a" />
          }
          contentContainerStyle={
            conversations.length === 0 ? { flexGrow: 1 } : { paddingBottom: 32 }
          }
        />
      )}
    </>
  );
}
