/**
 * Compose — draft screen for a new conversation.
 *
 * Receives recipientId + recipientName as query params. The conversation and
 * conversationMembers records are NOT created until the user actually sends a
 * message, so the recipient never appears in the sender's message list until
 * there is content.
 */
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../lib/convex";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

export default function ComposeScreen() {
  const { recipientId, recipientName } = useLocalSearchParams<{
    recipientId: string;
    recipientName: string;
  }>();
  const { user } = useUser();
  const router = useRouter();

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const getOrCreate = useMutation(api.messaging.getOrCreateDirect);
  const sendMessage = useMutation(api.messaging.sendMessage);

  const title = recipientName ?? "New Message";

  async function handleSend() {
    const body = inputText.trim();
    if (!body || sending || !recipientId) return;

    setInputText("");
    setSending(true);
    try {
      // Create the conversation now that there's actually something to send
      const conversationId = await getOrCreate({
        myUserId: user!.id,
        otherUserId: recipientId,
        myDisplayName: user?.fullName ?? user?.username ?? "Me",
        otherDisplayName: recipientName ?? "",
      });

      await sendMessage({
        conversationId,
        senderId: user!.id,
        senderName: user?.fullName ?? user?.firstName ?? "Me",
        body,
      });

      // Replace compose with the real thread so back doesn't return here
      router.replace(`/(app)/club/messages/${conversationId}` as any);
    } catch (e: any) {
      Alert.alert("Send failed", e?.message ?? "Please try again.");
      setInputText(body);
      setSending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView
        className="flex-1 bg-gray-50"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {/* Recipient chip */}
        <View className="bg-white border-b border-gray-100 px-4 py-3 flex-row items-center gap-3">
          <View className="w-9 h-9 rounded-full bg-green-600 items-center justify-center">
            <Text className="text-white text-xs font-bold">
              {getInitials(recipientName ?? "?")}
            </Text>
          </View>
          <Text className="text-base font-semibold text-gray-900">{recipientName}</Text>
        </View>

        {/* Empty state */}
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 text-sm">Send a message to start the conversation.</Text>
        </View>

        {/* Input bar */}
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
              autoFocus
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
