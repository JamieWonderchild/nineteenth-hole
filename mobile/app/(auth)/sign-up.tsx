import { useSignUp } from "@clerk/clerk-expo";
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

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      Alert.alert("Sign up failed", err.errors?.[0]?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      await setActive({ session: result.createdSessionId });
      router.replace("/(app)");
    } catch (err: any) {
      Alert.alert("Verification failed", err.errors?.[0]?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-1 justify-center px-8">
          <Text className="text-2xl font-bold text-gray-900 mb-2">Check your email</Text>
          <Text className="text-gray-500 mb-8">
            We sent a verification code to {email}
          </Text>

          <Text className="text-sm font-medium text-gray-700 mb-1">Code</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 mb-6"
            placeholder="123456"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />

          <TouchableOpacity
            className="bg-green-600 rounded-lg py-4 items-center"
            onPress={handleVerify}
            disabled={loading}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? "Verifying…" : "Verify email"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-8">
        <View className="mb-10">
          <Text className="text-3xl font-bold text-green-700">The 19th Hole</Text>
          <Text className="text-base text-gray-500 mt-1">Create your account</Text>
        </View>

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

        <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 mb-6"
          placeholder="••••••••"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          className="bg-green-600 rounded-lg py-4 items-center"
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text className="text-white font-semibold text-base">
            {loading ? "Creating account…" : "Create account"}
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500 text-sm">Already have an account? </Text>
          <Link href="/(auth)/sign-in">
            <Text className="text-green-700 text-sm font-medium">Sign in</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
