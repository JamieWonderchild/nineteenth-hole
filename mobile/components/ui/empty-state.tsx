import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./button";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16 gap-4">
      <View className="w-20 h-20 rounded-full bg-green-50 items-center justify-center">
        <Ionicons name={icon} size={40} color="#16a34a" />
      </View>
      <View className="items-center gap-2">
        <Text className="text-xl font-bold text-gray-900 text-center">{title}</Text>
        <Text className="text-gray-500 text-center text-base leading-6">{description}</Text>
      </View>
      {action && (
        <Button onPress={action.onPress} className="mt-2">
          {action.label}
        </Button>
      )}
    </View>
  );
}
