import { View, Text, ScrollView } from "react-native";

export default function SettingsScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 pt-6">
        <Text className="text-2xl font-bold text-gray-900">Settings</Text>
        <Text className="text-gray-500 mt-1">Coming soon</Text>
      </View>
    </ScrollView>
  );
}
