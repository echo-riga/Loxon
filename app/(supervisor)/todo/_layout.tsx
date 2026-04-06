// (supervisor)/todo/_layout.tsx
import { Stack } from "expo-router";

export default function TodoLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="form"
        options={{
          headerShown: true,
          title: "Request Form",
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#000",
          headerShadowVisible: true,
          headerBackTitle: "",
        }}
      />
      <Stack.Screen name="[id]" options={{ title: "Job Details" }} />
      <Stack.Screen name="job/[id]" options={{ title: "Job" }} />
    </Stack>
  );
}
