import { View } from "react-native";
import { cn } from "../../lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <View className={cn("bg-white rounded-xl border border-gray-100 shadow-sm", className)}>
      {children}
    </View>
  );
}
