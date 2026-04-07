import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function RecordsScreen() {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="file-document-outline" size={64} color="#cbd5e1" />
      <Text style={styles.title}>Records</Text>
      <Text style={styles.subtitle}>This section is coming soon</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>In Development</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f9ff",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },
  badge: {
    marginTop: 8,
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#18B4E8",
  },
});