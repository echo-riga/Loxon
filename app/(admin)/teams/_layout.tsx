// app/(admin)/teams/_layout.tsx
import { Stack } from "expo-router";

export default function TeamsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#000",
        headerShadowVisible: true,
        headerBackTitle: "",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: "" }} />
      <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
