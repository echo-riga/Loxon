// app/(admin)/_layout.tsx
import { Tabs, usePathname } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAuth } from "@/lib/authContext";
import { TouchableOpacity, Text } from "react-native";
import { Portal, Dialog, Button } from "react-native-paper";
import { useState } from "react";
export default function AdminLayout() {
  const { logout, user } = useAuth();
  const pathname = usePathname();
  const [logoutVisible, setLogoutVisible] = useState(false);

  const isDeep = pathname.includes("/teams/");

  return (
    <>
      <Tabs
        initialRouteName="teams"
        screenOptions={{
          headerShown: !isDeep,
          tabBarActiveTintColor: "#18B4E8",
          headerRight: () => (
            <TouchableOpacity onPress={() => setLogoutVisible(true)} style={{ marginRight: 16 }}>
              <MaterialCommunityIcons name="logout" size={24} color="#e53935" />
            </TouchableOpacity>
          ),
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: `Welcome, ${user?.name ?? "Admin"}`,
            tabBarLabel: "Dashboard",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="view-dashboard-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="teams"
          options={{
            title: "Teams",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="account-group-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="records"
          options={{
            title: "Records",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="file-document-outline" color={color} size={size} />
            ),
          }}
        />
      </Tabs>

      <Portal>
        <Dialog
          visible={logoutVisible}
          onDismiss={() => setLogoutVisible(false)}
          style={{ backgroundColor: "#fff", borderRadius: 16 }}
        >
          <Dialog.Icon icon="logout" color="#e53935" size={32} />
          <Dialog.Title style={{ textAlign: "center", fontWeight: "700", color: "#0f172a" }}>
            Sign Out
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ textAlign: "center", fontSize: 14, color: "#475569" }}>
              Are you sure you want to sign out?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLogoutVisible(false)} textColor="#64748b">Cancel</Button>
            <Button onPress={() => { setLogoutVisible(false); logout(); }} textColor="#e53935">Sign Out</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}