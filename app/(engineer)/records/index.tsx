import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";

const BRAND = "#18B4E8";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Rejected", value: "rejected" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Completed", value: "completed" },
];

const STATUS_COLOR: Record<string, string> = {
  pending: "#EAB308",
  rejected: "#EF4444",
  ongoing: "#22C55E",
  completed: "#6B7280",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

type FormRecord = {
  id: number;
  title: string;
  client_name: string;
  company_name: string;
  priority_level: string;
  status: string;
  date_from: string;
  date_to: string;
  created_at: string;
  created_by_name: string;
  tracking_id: number | null;
  tracking_status: string | null;
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function EngineerHistoryScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<FormRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");

  const fetchRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.set("status", selectedStatus);
      const data = await apiFetch(`/api/engineer/records?${params}`);
      setRecords(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    setLoading(true);
    fetchRecords();
  }, [fetchRecords]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecords();
  };

  const handleCardPress = (item: FormRecord) => {
    if (item.tracking_id) {
      router.push({
        pathname: "/(engineer)/records/[id]",
        params: { id: String(item.tracking_id), source: "job" },
      });
    } else {
      router.push({
        pathname: "/(engineer)/records/[id]",
        params: { id: String(item.id), source: "form" },
      });
    }
  };

  const renderCard = ({ item }: { item: FormRecord }) => {
    const statusColor = STATUS_COLOR[item.status] ?? "#ccc";
    const hasWarning =
      item.status === "completed" && item.tracking_status !== "verified";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.cardEdge, { backgroundColor: statusColor }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {hasWarning && (
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={16}
                color="#f59e0b"
              />
            )}
          </View>
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.client_name} · {item.company_name}
          </Text>
          <View style={styles.cardMeta}>
            <View style={styles.metaLeft}>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusColor + "22" },
                ]}
              >
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
              <View
                style={[
                  styles.priorityDot,
                  { backgroundColor: PRIORITY_COLORS[item.priority_level] },
                ]}
              />
              <Text style={styles.priorityText}>
                {item.priority_level.charAt(0).toUpperCase() +
                  item.priority_level.slice(1)}
              </Text>
            </View>
            <Text style={styles.dateText}>
              {formatDate(item.date_from)} – {formatDate(item.date_to)}
            </Text>
          </View>
          <Text style={styles.assignedText}>By: {item.created_by_name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={{ height: 54 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chip,
                selectedStatus === opt.value && styles.chipActive,
              ]}
              onPress={() => setSelectedStatus(opt.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedStatus === opt.value && styles.chipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={BRAND} size="large" />
        </View>
      ) : records.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="clipboard-text-off-outline"
            size={48}
            color="#cbd5e1"
          />
          <Text style={styles.emptyText}>No records found</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9ff" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: { fontSize: 14, color: "#94a3b8" },

  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: "center",
    flexDirection: "row",
  },
  chip: {
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    flexDirection: "row",
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardEdge: { width: 5 },
  cardBody: { flex: 1, padding: 14, gap: 5 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 },
  cardSub: { fontSize: 13, color: "#6b7280" },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  metaLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "600" },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  priorityText: { fontSize: 12, color: "#6b7280" },
  dateText: { fontSize: 11, color: "#9ca3af" },
  assignedText: { fontSize: 12, color: "#9ca3af" },
});
