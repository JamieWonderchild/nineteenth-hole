import { useUser } from "@clerk/clerk-expo";
import { View, Text, ScrollView } from "react-native";

export default function HomeScreen() {
  const { user } = useUser();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 pt-6 pb-4">
        <Text className="text-2xl font-bold text-gray-900">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </Text>
        <Text className="text-gray-500 mt-1">Here's what's happening at your club.</Text>
      </View>

      {/* Placeholder cards — will populate with Convex queries */}
      <View className="px-4 gap-3">
        <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <Text className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">
            Upcoming
          </Text>
          <Text className="text-base font-semibold text-gray-900">Next competition</Text>
          <Text className="text-gray-400 text-sm mt-1">No upcoming competitions</Text>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <Text className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">
            Standings
          </Text>
          <Text className="text-base font-semibold text-gray-900">Leaderboard</Text>
          <Text className="text-gray-400 text-sm mt-1">Select a competition to view standings</Text>
        </View>
      </View>
    </ScrollView>
  );
}
