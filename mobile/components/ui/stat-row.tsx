import { View, Text } from "react-native";

interface StatRowProps {
  stats: Array<{ label: string; value: string | number }>;
}

export function StatRow({ stats }: StatRowProps) {
  return (
    <View className="flex-row">
      {stats.map((stat, i) => (
        <View
          key={i}
          className={`flex-1 items-center ${i < stats.length - 1 ? "border-r border-gray-100" : ""}`}
        >
          <Text className="text-xl font-bold text-gray-900">{stat.value}</Text>
          <Text className="text-xs text-gray-500 mt-0.5">{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}
