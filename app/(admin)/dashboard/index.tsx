import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";

const BRAND = "#18B4E8";

const STATUS_COLOR: Record<string, string> = {
  pending: "#EAB308",
  rejected: "#EF4444",
  ongoing: "#22C55E",
  completed: "#6B7280",
  verified: "#A855F7",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

type Totals = {
  total_users: string;
  total_engineers: string;
  total_supervisors: string;
  total_teams: string;
  total_forms: string;
  active_jobs: string;
};

type FormsByStatus = { status: string; count: string }[];

type RecentForm = {
  id: number;
  title: string;
  status: string;
  priority_level: string;
  created_at: string;
  created_by_name: string;
  assigned_to_name: string;
};

type RecentJob = {
  id: number;
  tracking_status: string;
  started_at: string;
  ended_at: string | null;
  title: string;
  priority_level: string;
  worker_name: string;
};

type DashboardData = {
  totals: Totals;
  formsByStatus: FormsByStatus;
  recentForms: RecentForm[];
  recentJobs: RecentJob[];
};

function formatDateTime(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon as any} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/dashboard");
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );

  if (!data)
    return (
      <View style={styles.centered}>
        <Text style={{ color: "#94a3b8" }}>Failed to load dashboard.</Text>
      </View>
    );

  const { totals, formsByStatus, recentForms, recentJobs } = data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <MaterialCommunityIcons
          name="view-dashboard-outline"
          size={20}
          color={BRAND}
        />
        <Text style={styles.headerTitle}>Overview</Text>
      </View>

      {/* Stat grid */}
      <View style={styles.statGrid}>
        <StatCard
          icon="account-group-outline"
          label="Total Users"
          value={totals.total_users}
          color={BRAND}
        />
        <StatCard
          icon="account-hard-hat-outline"
          label="Engineers"
          value={totals.total_engineers}
          color="#22C55E"
        />
        <StatCard
          icon="account-tie-outline"
          label="Supervisors"
          value={totals.total_supervisors}
          color="#A855F7"
        />
        <StatCard
          icon="account-multiple-outline"
          label="Teams"
          value={totals.total_teams}
          color="#f59e0b"
        />
        <StatCard
          icon="file-document-multiple-outline"
          label="Total Forms"
          value={totals.total_forms}
          color="#6B7280"
        />
        <StatCard
          icon="map-marker-radius-outline"
          label="Active Jobs"
          value={totals.active_jobs}
          color="#EF4444"
        />
      </View>

      {/* Forms by status */}
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="chart-bar" size={16} color={BRAND} />
        <Text style={styles.sectionTitle}>Forms by Status</Text>
      </View>
      <View style={styles.card}>
        {formsByStatus.length === 0 ? (
          <Text style={styles.emptyText}>No forms yet</Text>
        ) : (
          formsByStatus.map((item) => {
            const color = STATUS_COLOR[item.status] ?? "#ccc";
            const total = formsByStatus.reduce(
              (s, i) => s + Number(i.count),
              0,
            );
            const pct = total > 0 ? (Number(item.count) / total) * 100 : 0;
            return (
              <View key={item.status} style={styles.barRow}>
                <Text style={[styles.barLabel, { color }]}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%` as any, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={styles.barCount}>{item.count}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Recent Forms */}
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons
          name="file-clock-outline"
          size={16}
          color={BRAND}
        />
        <Text style={styles.sectionTitle}>Recent Forms</Text>
      </View>
      {recentForms.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No forms yet</Text>
        </View>
      ) : (
        recentForms.map((f) => {
          const statusColor = STATUS_COLOR[f.status] ?? "#ccc";
          return (
            <View key={f.id} style={styles.activityCard}>
              <View
                style={[styles.activityEdge, { backgroundColor: statusColor }]}
              />
              <View style={styles.activityBody}>
                <View style={styles.activityTop}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {f.title}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusColor + "22" },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {f.status.charAt(0).toUpperCase() + f.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.activitySub}>
                  {f.created_by_name} → {f.assigned_to_name}
                </Text>
                <View style={styles.activityMeta}>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: PRIORITY_COLORS[f.priority_level] },
                    ]}
                  />
                  <Text style={styles.activityTime}>
                    {formatDateTime(f.created_at)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      )}

      {/* Recent Jobs */}
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons
          name="map-marker-path"
          size={16}
          color={BRAND}
        />
        <Text style={styles.sectionTitle}>Recent Jobs</Text>
      </View>
      {recentJobs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No jobs yet</Text>
        </View>
      ) : (
        recentJobs.map((j) => {
          const statusColor = STATUS_COLOR[j.tracking_status] ?? "#ccc";
          return (
            <View key={j.id} style={styles.activityCard}>
              <View
                style={[styles.activityEdge, { backgroundColor: statusColor }]}
              />
              <View style={styles.activityBody}>
                <View style={styles.activityTop}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {j.title}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusColor + "22" },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {j.tracking_status.charAt(0).toUpperCase() +
                        j.tracking_status.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.activityRow}>
                  <MaterialCommunityIcons
                    name="account-hard-hat-outline"
                    size={13}
                    color="#9ca3af"
                  />
                  <Text style={styles.activitySub}>{j.worker_name}</Text>
                </View>
                <View style={styles.activityMeta}>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: PRIORITY_COLORS[j.priority_level] },
                    ]}
                  />
                  <Text style={styles.activityTime}>
                    {formatDateTime(j.started_at)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9ff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 16, gap: 12 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    width: "47%",
    gap: 4,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  statValue: { fontSize: 24, fontWeight: "800", color: "#111827" },
  statLabel: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  emptyText: { fontSize: 13, color: "#94a3b8" },

  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { fontSize: 12, fontWeight: "600", width: 72 },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 4 },
  barCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    width: 28,
    textAlign: "right",
  },

  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    flexDirection: "row",
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  activityEdge: { width: 4 },
  activityBody: { flex: 1, padding: 12, gap: 4 },
  activityTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  activityTitle: { fontSize: 14, fontWeight: "700", color: "#111827", flex: 1 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  activitySub: { fontSize: 12, color: "#6b7280" },
  activityMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  activityTime: { fontSize: 11, color: "#9ca3af" },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  statusPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "600" },
});
