import { View, Text } from "react-native";

interface HandicapBadgeProps {
  index: number | null;
  direction?: "up" | "down" | "same";
  size?: "sm" | "lg";
}

export function HandicapBadge({ index, direction, size = "lg" }: HandicapBadgeProps) {
  const directionIcon = direction === "down" ? "↓" : direction === "up" ? "↑" : "";

  if (size === "lg") {
    return (
      <View className="bg-green-600 rounded-2xl p-6 items-center gap-1">
        <Text className="text-green-200 text-sm font-medium uppercase tracking-widest">
          Handicap Index
        </Text>
        <View className="flex-row items-end gap-2">
          <Text className="text-white text-6xl font-bold">
            {index !== null ? index.toFixed(1) : "–"}
          </Text>
          {direction && direction !== "same" && (
            <Text
              className="text-2xl font-bold mb-2"
              style={{ color: direction === "down" ? "#86efac" : "#fca5a5" }}
            >
              {directionIcon}
            </Text>
          )}
        </View>
        {index === null && (
          <Text className="text-green-300 text-sm">Log 3 rounds to get your index</Text>
        )}
      </View>
    );
  }

  return (
    <View className="bg-green-600 rounded-full px-4 py-2 flex-row items-center gap-1">
      <Text className="text-white font-bold text-lg">
        {index !== null ? index.toFixed(1) : "–"}
      </Text>
      {direction && direction !== "same" && (
        <Text
          style={{
            color: direction === "down" ? "#86efac" : "#fca5a5",
            fontWeight: "bold",
          }}
        >
          {directionIcon}
        </Text>
      )}
    </View>
  );
}
