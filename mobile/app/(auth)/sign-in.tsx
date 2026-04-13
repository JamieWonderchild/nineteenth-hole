import { useSignIn, useOAuth } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
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
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    try {
      const redirectUrl = Linking.createURL("oauth-callback");
      console.log("OAuth redirect URL:", redirectUrl);
      const { createdSessionId, setActive: setOAuthActive } = await startOAuthFlow({
        redirectUrl,
      });
      if (createdSessionId) {
        await setOAuthActive!({ session: createdSessionId });
        router.replace("/(app)");
      }
    } catch (err: any) {
      Alert.alert("Google sign in failed", err.errors?.[0]?.message ?? "Something went wrong");
    }
  }

  async function handleSignIn() {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      await setActive({ session: result.createdSessionId });
      router.replace("/(app)");
    } catch (err: any) {
      Alert.alert("Sign in failed", err.errors?.[0]?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-8">
        {/* Logo / wordmark */}
        <View className="mb-10">
          <Text className="text-3xl font-bold text-green-700">The 19th Hole</Text>
          <Text className="text-base text-gray-500 mt-1">Golf club management</Text>
        </View>

        {/* Google sign in */}
        <TouchableOpacity
          className="border border-gray-300 rounded-lg py-4 items-center mb-6 flex-row justify-center gap-x-2"
          onPress={handleGoogleSignIn}
        >
          <Text className="text-gray-700 font-semibold text-base">Continue with Google</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View className="flex-row items-center mb-6">
          <View className="flex-1 h-px bg-gray-200" />
          <Text className="mx-3 text-gray-400 text-sm">or</Text>
          <View className="flex-1 h-px bg-gray-200" />
        </View>

        {/* Email */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 mb-4"
          placeholder="you@example.com"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {/* Password */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 mb-6"
          placeholder="••••••••"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* Sign in button */}
        <TouchableOpacity
          className="bg-green-600 rounded-lg py-4 items-center"
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text className="text-white font-semibold text-base">
            {loading ? "Signing in…" : "Sign in"}
          </Text>
        </TouchableOpacity>

        {/* Sign up link */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500 text-sm">Don't have an account? </Text>
          <Link href="/(auth)/sign-up">
            <Text className="text-green-700 text-sm font-medium">Sign up</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
