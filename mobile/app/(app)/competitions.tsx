import { View, Text } from "react-native";

export default function CompetitionsScreen() {
  return (
    <View className="flex-1 bg-gray-50 items-center justify-center px-8">
      <Text className="text-2xl font-bold text-gray-900 mb-2">Competitions</Text>
      <Text className="text-gray-400 text-center">
        Your club competitions will appear here.
      </Text>
    </View>
  );
}
