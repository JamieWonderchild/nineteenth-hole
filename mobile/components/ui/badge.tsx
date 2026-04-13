import { View, Text } from "react-native";
import { cn } from "../../lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "muted";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const variants = {
    default: "bg-green-100",
    success: "bg-green-100",
    warning: "bg-amber-100",
    error: "bg-red-100",
    muted: "bg-gray-100",
  };
  const textVariants = {
    default: "text-green-800",
    success: "text-green-800",
    warning: "text-amber-800",
    error: "text-red-700",
    muted: "text-gray-600",
  };
  return (
    <View className={cn("rounded-full px-2.5 py-0.5 self-start", variants[variant], className)}>
      <Text className={cn("text-xs font-medium", textVariants[variant])}>{children}</Text>
    </View>
  );
}
