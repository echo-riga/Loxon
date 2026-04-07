import { Tabs, usePathname } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TouchableOpacity, Alert } from "react-native";
import { useAuth } from "@/lib/authContext";
import NetInfo from "@react-native-community/netinfo";
import { flushOfflineQueue } from "@/lib/offlineQueue";

export default function EngineerLayout() {
  const { logout } = useAuth();
  const pathname = usePathname();

  const isDeep = !/\/(mytask|active|records)$/.test(pathname);

  const handleLogout = async () => {
    const state = await NetInfo.fetch();

    if (!state.isConnected) {
      Alert.alert(
        "No Internet Connection",
        "You can't log out while offline. Please connect to the internet first.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await flushOfflineQueue();
          logout();
        },
      },
    ]);
  };

  return (
    <Tabs
      initialRouteName="active"
      screenOptions={{
        headerShown: !isDeep,
        tabBarActiveTintColor: "#18B4E8",
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: "#000",
        headerShadowVisible: true,
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
            <MaterialCommunityIcons name="logout" size={24} color="#18B4E8" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="mytask"
        options={{
          title: "Pending",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="clipboard-account-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="active"
        options={{
          title: "Active",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="map-marker-radius-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: "Records",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="file-document-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}