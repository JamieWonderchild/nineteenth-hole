import { View, ActivityIndicator } from "react-native";

export function LoadingSpinner({ fullScreen = false }: { fullScreen?: boolean }) {
  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }
  return <ActivityIndicator size="small" color="#16a34a" />;
}
