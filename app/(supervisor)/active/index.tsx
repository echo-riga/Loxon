// (supervisor)/active/index.tsx
import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";

const BRAND = "#18B4E8";
const BG = "#f0f9ff";

const PRIORITY_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

type ActiveJob = {
  tracking_id: number;
  form_id: number;
  tracking_status: string;
  started_at: string;
  latitude: number | null;
  longitude: number | null;
  title: string;
  client_name: string;
  company_name: string;
  priority_level: string;
  worker_name: string;
};

export default function SupervisorActiveScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await apiFetch("/api/supervisor/jobs");
      console.log("active jobs:", JSON.stringify(data));
      setJobs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs]),
  );

  function formatDateTime(iso: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getElapsed(startedAt: string) {
    const diff = Date.now() - new Date(startedAt).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  if (jobs.length === 0) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons
          name="map-marker-off-outline"
          size={48}
          color="#cbd5e1"
        />
        <Text style={styles.emptyText}>No active jobs right now</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.tracking_id)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchJobs();
            }}
            colors={[BRAND]}
            tintColor={BRAND}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(`/active/${item.tracking_id}` as any)}
          >
            {/* Priority stripe */}
            <View
              style={[
                styles.stripe,
                {
                  backgroundColor:
                    PRIORITY_COLOR[item.priority_level] ?? "#ccc",
                },
              ]}
            />

            <View style={styles.cardBody}>
              {/* Top row */}
              <View style={styles.topRow}>
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
                <Text style={styles.elapsed}>
                  {getElapsed(item.started_at)}
                </Text>
              </View>

              {/* Title */}
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>

              {/* Worker */}
              <View style={styles.row}>
                <MaterialCommunityIcons
                  name="account-hard-hat-outline"
                  size={13}
                  color="#64748b"
                />
                <Text style={styles.meta}>{item.worker_name}</Text>
              </View>

              {/* Client / Company */}
              <View style={styles.row}>
                <MaterialCommunityIcons
                  name="domain"
                  size={13}
                  color="#64748b"
                />
                <Text style={styles.meta} numberOfLines={1}>
                  {item.client_name} · {item.company_name}
                </Text>
              </View>

              {/* Started */}
              <View style={styles.row}>
                <MaterialCommunityIcons
                  name="play-circle-outline"
                  size={13}
                  color="#64748b"
                />
                <Text style={styles.meta}>
                  Started {formatDateTime(item.started_at)}
                </Text>
              </View>

              {/* Location indicator */}
              <View style={styles.row}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={13}
                  color={item.latitude ? BRAND : "#cbd5e1"}
                />
                <Text
                  style={[
                    styles.meta,
                    { color: item.latitude ? BRAND : "#cbd5e1" },
                  ]}
                >
                  {item.latitude ? "Location available" : "Awaiting location…"}
                </Text>
              </View>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color="#cbd5e1"
              style={styles.chevron}
            />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: { fontSize: 14, color: "#94a3b8" },
  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  stripe: { width: 4, alignSelf: "stretch" },
  cardBody: { flex: 1, padding: 14, gap: 5 },
  chevron: { paddingRight: 10 },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dcfce7",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  liveText: { fontSize: 10, fontWeight: "700", color: "#15803d" },
  elapsed: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },

  title: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { fontSize: 12, color: "#64748b", flex: 1 },
});
