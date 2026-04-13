import { View, Text } from "react-native";
import { cn } from "../../lib/utils";

interface ScoreChipProps {
  score: number; // actual strokes
  par: number; // hole par
  size?: "sm" | "md";
}

export function ScoreChip({ score, par, size = "md" }: ScoreChipProps) {
  const diff = score - par;
  const containerStyles: Record<string, string> = {
    "-2": "bg-yellow-400 border-2 border-yellow-500 rounded-full",
    "-1": "bg-red-500 rounded-full",
    "0": "bg-white border border-gray-300 rounded-sm",
    "1": "bg-blue-100 border border-blue-300 rounded-sm",
    "2+": "bg-gray-700 rounded-sm",
  };
  const textStyles: Record<string, string> = {
    "-2": "text-yellow-900 font-bold",
    "-1": "text-white font-semibold",
    "0": "text-gray-700",
    "1": "text-blue-700",
    "2+": "text-white font-semibold",
  };
  const key = diff <= -2 ? "-2" : diff === -1 ? "-1" : diff === 0 ? "0" : diff === 1 ? "1" : "2+";
  const dim = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const textSize = size === "sm" ? "text-sm" : "text-base";
  return (
    <View className={cn("items-center justify-center", dim, containerStyles[key])}>
      <Text className={cn(textSize, textStyles[key])}>{score}</Text>
    </View>
  );
}
