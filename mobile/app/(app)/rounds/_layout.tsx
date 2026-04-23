import { Stack } from "expo-router";

export default function RoundsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#166534",
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: "#fff" },
        headerShadowVisible: false,
      }}
    />
  );
}
