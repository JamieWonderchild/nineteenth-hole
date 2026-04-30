import { useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
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

// ── types ─────────────────────────────────────────────────────────────────────

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

// ── sub-components ─────────────────────────────────────────────────────────────

function DeleteAction({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ width: 80, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600", marginTop: 3 }}>Delete</Text>
    </TouchableOpacity>
  );
}

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
  const lastMsg = conversation.lastMessage;
  const isMine = lastMsg?.senderId === userId;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white border-b border-gray-50 px-4 py-4 flex-row items-center gap-3"
    >
      <View
        className={`w-12 h-12 rounded-full items-center justify-center ${
          isGroup ? "bg-purple-100" : "bg-green-100"
        }`}
      >
        {isGroup ? (
          <Ionicons name="people" size={22} color="#7c3aed" />
        ) : (
          <Text className="text-green-700 font-bold text-base">{getInitials(name)}</Text>
        )}
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center justify-between">
          <Text className="font-semibold text-gray-900 text-base flex-1 mr-2" numberOfLines={1}>
            {name}
          </Text>
          {lastMsg && (
            <Text className="text-xs text-gray-400">{formatRelativeTime(lastMsg.createdAt)}</Text>
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

  // Ref to the currently open swipeable so we can close it when another opens
  const openSwipeable = useRef<Swipeable | null>(null);

  const conversations = useQuery(
    api.messaging.listMyConversations,
    userId ? { userId } : "skip"
  );

  const hideConversation = useMutation(api.messaging.hideConversation);

  function handleHide(conversationId: string) {
    openSwipeable.current?.close();
    openSwipeable.current = null;
    hideConversation({ conversationId: conversationId as any, userId }).catch(() => {});
  }

  const headerRight = () => (
    <View className="flex-row items-center gap-3 mr-2">
      <TouchableOpacity onPress={() => router.push("/(app)/club/messages/new-group" as any)}>
        <Ionicons name="people-outline" size={23} color="#166534" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/(app)/club/messages/new" as any)}>
        <Ionicons name="create-outline" size={23} color="#166534" />
      </TouchableOpacity>
    </View>
  );

  if (conversations === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Messages", headerRight }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Messages", headerRight }} />

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
          renderItem={({ item }) => {
            let rowRef: Swipeable | null = null;
            return (
              <Swipeable
                ref={(r) => { rowRef = r; }}
                renderRightActions={() => (
                  <DeleteAction onPress={() => handleHide(item._id)} />
                )}
                onSwipeableOpen={() => {
                  // Close any previously open row
                  if (openSwipeable.current && openSwipeable.current !== rowRef) {
                    openSwipeable.current.close();
                  }
                  openSwipeable.current = rowRef;
                }}
                friction={2}
                rightThreshold={40}
              >
                <ConversationRow
                  conversation={item}
                  userId={userId}
                  onPress={() => {
                    openSwipeable.current?.close();
                    openSwipeable.current = null;
                    router.push(`/(app)/club/messages/${item._id}` as any);
                  }}
                />
              </Swipeable>
            );
          }}
          refreshControl={<RefreshControl refreshing={false} tintColor="#16a34a" />}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </>
  );
}
