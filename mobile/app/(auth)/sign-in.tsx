import { useSSO } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../components/ui/button";
import { Ionicons } from "@expo/vector-icons";

export default function SignInScreen() {
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const handleApple = async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: "oauth_apple" });
      if (createdSessionId) await setActive?.({ session: createdSessionId });
    } catch (e) {
      console.error(e);
    }
  };

  const handleGoogle = async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: "oauth_google" });
      if (createdSessionId) await setActive?.({ session: createdSessionId });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View className="flex-1 bg-white px-6">
      {/* Header */}
      <View className="flex-1 items-center justify-center gap-3">
        <View className="w-20 h-20 bg-green-600 rounded-2xl items-center justify-center mb-4">
          <Text className="text-white text-4xl">⛳</Text>
        </View>
        <Text className="text-3xl font-bold text-gray-900">The 19th Hole</Text>
        <Text className="text-gray-500 text-center text-base">
          Track your rounds, manage your handicap, play with friends
        </Text>
      </View>

      {/* Auth buttons */}
      <View className="pb-12 gap-3">
        <TouchableOpacity
          onPress={handleApple}
          className="bg-black rounded-full py-4 flex-row items-center justify-center gap-3"
        >
          <Ionicons name="logo-apple" size={20} color="white" />
          <Text className="text-white font-semibold text-base">Continue with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleGoogle}
          className="bg-white border border-gray-300 rounded-full py-4 flex-row items-center justify-center gap-3"
        >
          <Text className="text-base">G</Text>
          <Text className="text-gray-700 font-semibold text-base">Continue with Google</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-3 my-1">
          <View className="flex-1 h-px bg-gray-200" />
          <Text className="text-gray-400 text-sm">or</Text>
          <View className="flex-1 h-px bg-gray-200" />
        </View>

        <Button onPress={() => router.push("/(auth)/sign-up")} variant="outline">
          Create account with email
        </Button>

        <Text className="text-center text-gray-400 text-xs mt-2">
          By continuing you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}
