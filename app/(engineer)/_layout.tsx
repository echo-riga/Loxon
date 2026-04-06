import { Tabs, usePathname } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { useAuth } from "@/lib/authContext";

export default function EngineerLayout() {
  const { logout } = useAuth();
  const pathname = usePathname();

  const isDeep = !/\/(mytask|active|records)$/.test(pathname);

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
          <TouchableOpacity onPress={logout} style={{ marginRight: 16 }}>
            <MaterialCommunityIcons name="logout" size={24} color="#18B4E8" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="mytask"
        options={{
          title: "Pendingss",
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
