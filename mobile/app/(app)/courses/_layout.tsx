import { Stack } from "expo-router";

export default function CoursesLayout() {
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
