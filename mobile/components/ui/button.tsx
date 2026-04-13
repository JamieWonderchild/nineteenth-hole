import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { cn } from "../../lib/utils";

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Button({
  onPress,
  children,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  className,
}: ButtonProps) {
  const base = "flex-row items-center justify-center rounded-full";
  const variants = {
    primary: "bg-green-600 active:bg-green-700",
    secondary: "bg-green-50 active:bg-green-100",
    outline: "border border-gray-300 bg-white active:bg-gray-50",
    destructive: "bg-red-600 active:bg-red-700",
    ghost: "active:bg-gray-100",
  };
  const sizes = {
    sm: "px-3 py-1.5",
    md: "px-5 py-3",
    lg: "px-6 py-4",
  };
  const textVariants = {
    primary: "text-white font-semibold",
    secondary: "text-green-700 font-semibold",
    outline: "text-gray-700 font-medium",
    destructive: "text-white font-semibold",
    ghost: "text-gray-700 font-medium",
  };
  const textSizes = { sm: "text-sm", md: "text-base", lg: "text-lg" };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        (disabled || loading) && "opacity-50",
        className
      )}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "destructive" ? "#fff" : "#16a34a"}
          size="small"
        />
      ) : (
        <Text className={cn(textVariants[variant], textSizes[size])}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}
