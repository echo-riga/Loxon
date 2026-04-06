import { Redirect, Stack, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { PaperProvider } from "react-native-paper";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { AppState } from "react-native";

function RootRedirect() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  console.log("RootRedirect:", { loading, segments, user });

  if (loading) return null;

  const inAuth = segments[0] === "(auth)";
  const inAdmin = segments[0] === "(admin)";
  const inSupervisor = segments[0] === "(supervisor)";
  const inEngineer = segments[0] === "(engineer)";

  if (!user && !inAuth) return <Redirect href="/(auth)" />;

  if (user) {
    if (user.role === "admin" && !inAdmin)
      return <Redirect href="/(admin)/dashboard" />;
    if (user.role === "supervisor" && !inSupervisor)
      return <Redirect href="/(supervisor)/todo" />;
    if (user.role === "engineer" && !inEngineer)
      return <Redirect href="/(engineer)/mytask" />;
  }

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync("#18B4E8");

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        SystemUI.setBackgroundColorAsync("#18B4E8");
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <AuthProvider>
      <PaperProvider>
        <RootRedirect />
        <Stack screenOptions={{ headerShown: false }} />
      </PaperProvider>
    </AuthProvider>
  );
}
