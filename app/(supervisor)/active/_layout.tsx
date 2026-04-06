import { Stack } from "expo-router";

export default function ActiveLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[id]"
        options={{
          title: "Job Details",
          headerShown: true,
          headerBackTitle: "",
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#000",
          headerShadowVisible: true,
        }}
      />
    </Stack>
  );
}
