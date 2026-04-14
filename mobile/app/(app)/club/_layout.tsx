import { Stack } from "expo-router";

export default function ClubLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#166534",
        headerTitleStyle: { fontWeight: "600" },
      }}
    />
  );
}
