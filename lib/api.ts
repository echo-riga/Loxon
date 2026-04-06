import { API_URL } from "./config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem("worktrace_token");

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    if (token) {
      await AsyncStorage.removeItem("worktrace_token");
      await AsyncStorage.removeItem("worktrace_user");
      router.replace("/(auth)");
      return;
    }
    // no token = login attempt failed, fall through and return error body
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("apiFetch failed on:", path, "| response:", text);
    return null;
  }
}
