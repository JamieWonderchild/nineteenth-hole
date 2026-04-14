import { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../lib/convex";
import { LoadingSpinner } from "../../../../components/ui";

// ── helpers ────────────────────────────────────────────────────────────────────

function formatMessageTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ── message bubble ────────────────────────────────────────────────────────────

type Message = {
  _id: string;
  senderId: string;
  senderName?: string;
  body: string;
  createdAt: string;
};

function MessageBubble({
  message,
  isMine,
  isGroup,
  showSenderName,
}: {
  message: Message;
  isMine: boolean;
  isGroup: boolean;
  showSenderName: boolean;
}) {
  return (
    <View
      className={`mb-2 px-3 flex-row ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      <View
        className={`max-w-xs rounded-2xl px-4 py-2.5 ${
          isMine ? "bg-green-600 rounded-tr-sm" : "bg-white rounded-tl-sm shadow-sm border border-gray-100"
        }`}
        style={{ maxWidth: "78%" }}
      >
        {isGroup && !isMine && showSenderName && (
          <Text className="text-xs font-semibold text-green-600 mb-0.5">
            {message.senderName ?? "Member"}
          </Text>
        )}
        <Text
          className={`text-sm leading-5 ${
            isMine ? "text-white" : "text-gray-900"
          }`}
        >
          {message.body}
        </Text>
        <Text
          className={`text-xs mt-1 ${
            isMine ? "text-green-200" : "text-gray-400"
          } text-right`}
        >
          {formatMessageTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ── main screen ────────────────────────────────────────────────────────────────

export default function ChatThreadScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useUser();
  const userId = user?.id ?? "";

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const conversation = useQuery(
    api.messaging.getConversation,
    conversationId && userId
      ? { conversationId: conversationId as any, userId }
      : "skip"
  );

  const messages = useQuery(
    api.messaging.listMessages,
    conversationId && userId
      ? { conversationId: conversationId as any, userId }
      : "skip"
  );

  const markRead = useMutation(api.messaging.markRead);
  const sendMessage = useMutation(api.messaging.sendMessage);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages?.length]);

  // Mark as read on open
  useEffect(() => {
    if (conversationId && userId) {
      markRead({ conversationId: conversationId as any, userId }).catch(
        () => {}
      );
    }
  }, [conversationId, userId]);

  const isGroup = conversation?.type === "group";
  const title =
    conversation?.name ??
    (conversation?.members
      ?.filter((m: any) => m.userId !== userId)
      .map((m: any) => m.displayName)
      .join(", ") ||
      "Chat");

  async function handleSend() {
    const body = inputText.trim();
    if (!body || sending) return;

    setInputText("");
    setSending(true);
    try {
      await sendMessage({
        conversationId: conversationId as any,
        senderId: userId,
        senderName: user?.fullName ?? user?.firstName ?? "Me",
        body,
      });
    } catch (err: any) {
      Alert.alert("Send failed", err?.message ?? "Please try again.");
      setInputText(body); // restore
    } finally {
      setSending(false);
    }
  }

  if (messages === undefined || conversation === undefined) {
    return (
      <>
        <Stack.Screen options={{ title: "Chat" }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  const msgList = (messages ?? []) as Message[];

  return (
    <>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {/* messages */}
        <FlatList
          ref={flatListRef}
          className="flex-1"
          data={msgList}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            paddingVertical: 16,
            paddingBottom: 8,
          }}
          renderItem={({ item, index }) => {
            const isMine = item.senderId === userId;
            const prevMsg = msgList[index - 1];
            const showSenderName =
              isGroup &&
              !isMine &&
              (!prevMsg || prevMsg.senderId !== item.senderId);
            return (
              <MessageBubble
                message={item}
                isMine={isMine}
                isGroup={isGroup}
                showSenderName={showSenderName}
              />
            );
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-16">
              <Text className="text-gray-400 text-sm">
                No messages yet. Say hello!
              </Text>
            </View>
          }
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        {/* input bar */}
        <View className="bg-white border-t border-gray-100 flex-row items-end px-3 py-2 gap-2">
          <View className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5 min-h-10 max-h-32 border border-gray-200">
            <TextInput
              className="text-base text-gray-900"
              placeholder="Message…"
              placeholderTextColor="#9ca3af"
              value={inputText}
              onChangeText={setInputText}
              multiline
              returnKeyType="default"
              blurOnSubmit={false}
            />
          </View>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              inputText.trim() ? "bg-green-600" : "bg-gray-200"
            }`}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={inputText.trim() ? "#fff" : "#9ca3af"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
