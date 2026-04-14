import { View, Text, TouchableOpacity } from "react-native";

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-lg font-bold text-gray-900">{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text className="text-green-600 font-medium text-sm">{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
