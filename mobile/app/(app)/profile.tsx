import { useAuth, useUser } from "@clerk/clerk-expo";
import { View, Text, TouchableOpacity } from "react-native";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();

  return (
    <View className="flex-1 bg-gray-50 px-4 pt-6">
      <View className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-4">
        <Text className="text-base font-semibold text-gray-900">
          {user?.fullName ?? "—"}
        </Text>
        <Text className="text-sm text-gray-500 mt-0.5">
          {user?.primaryEmailAddress?.emailAddress ?? "—"}
        </Text>
      </View>

      <TouchableOpacity
        className="bg-red-50 border border-red-200 rounded-xl p-4 items-center"
        onPress={() => signOut()}
      >
        <Text className="text-red-600 font-medium">Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}
