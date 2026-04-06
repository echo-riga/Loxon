// (engineer)/mytask/index.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { FAB } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";

const BRAND = "#18B4E8";

const PRIORITY_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const STATUS_EDGE: Record<string, string> = {
  pending: "#EAB308",
  accepted: "#3B82F6",
  rejected: "#EF4444",
  ongoing: "#22C55E",
  completed: "#6B7280",
  verified: "#A855F7",
};

type AssignedForm = {
  id: number;
  title: string;
  client_name: string;
  company_name: string;
  created_by_name: string;
  priority_level: "low" | "medium" | "high";
  date_from: string;
  date_to: string;
  status: string;
};

type MyForm = {
  id: number;
  title: string;
  client_name: string;
  company_name: string;
  assigned_to_name: string;
  priority_level: "low" | "medium" | "high";
  date_from: string;
  date_to: string;
  status: string;
};

export default function MyTaskScreen() {
  const router = useRouter();
  const [assignedForms, setAssignedForms] = useState<AssignedForm[]>([]);
  const [myForms, setMyForms] = useState<MyForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [assignedData, mineData] = await Promise.all([
        apiFetch("/api/engineer/forms/assigned"),
        apiFetch("/api/engineer/forms/mine"),
      ]);

      setAssignedForms(
        assignedData.filter((f: AssignedForm) => f.status === "pending"),
      );
      setMyForms(mineData.filter((f: MyForm) => f.status === "pending"));
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

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderAssignedForm = ({ item }: { item: AssignedForm }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/mytask/${item.id}?source=assigned` as any)}
    >
      <View
        style={[
          styles.statusEdge,
          { backgroundColor: STATUS_EDGE[item.status] ?? "#ccc" },
        ]}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: PRIORITY_COLOR[item.priority_level] + "22" },
            ]}
          >
            <Text
              style={[
                styles.priorityText,
                { color: PRIORITY_COLOR[item.priority_level] },
              ]}
            >
              {item.priority_level.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.cardSub} numberOfLines={1}>
          {item.client_name} · {item.company_name}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.cardFooterLeft}>
            <MaterialCommunityIcons
              name="account-supervisor-outline"
              size={13}
              color="#64748b"
            />
            <Text style={styles.cardMeta}>{item.created_by_name}</Text>
          </View>
          <Text style={styles.cardMeta}>
            {formatDate(item.date_from)} – {formatDate(item.date_to)}
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color="#cbd5e1"
        style={{ alignSelf: "center", marginRight: 4 }}
      />
    </TouchableOpacity>
  );

  const renderMyForm = ({ item }: { item: MyForm }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/mytask/${item.id}?source=mine` as any)}
    >
      <View
        style={[
          styles.statusEdge,
          { backgroundColor: STATUS_EDGE[item.status] ?? "#ccc" },
        ]}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View
            style={[
              styles.priorityBadge,
              { backgroundColor: STATUS_EDGE[item.status] + "22" },
            ]}
          >
            <Text
              style={[styles.priorityText, { color: STATUS_EDGE[item.status] }]}
            >
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.cardSub} numberOfLines={1}>
          {item.client_name} · {item.company_name}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.cardFooterLeft}>
            <MaterialCommunityIcons
              name="account-outline"
              size={13}
              color="#64748b"
            />
            <Text style={styles.cardMeta}>{item.assigned_to_name}</Text>
          </View>
          <Text style={styles.cardMeta}>
            {formatDate(item.date_from)} – {formatDate(item.date_to)}
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color="#cbd5e1"
        style={{ alignSelf: "center", marginRight: 4 }}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1 — Assigned by Supervisor */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>Assigned to Me</Text>
          {assignedForms.length > 0 && (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>
                {assignedForms.length}
              </Text>
            </View>
          )}
        </View>

        {assignedForms.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="clipboard-check-outline"
              size={32}
              color="#cbd5e1"
            />
            <Text style={styles.emptyText}>No forms assigned to you</Text>
          </View>
        ) : (
          <FlatList
            data={assignedForms}
            keyExtractor={(item) => `assigned-${item.id}`}
            renderItem={renderAssignedForm}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )}

        {/* Section 2 — My Self-Requested Forms */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <View style={[styles.sectionDot, { backgroundColor: "#3B82F6" }]} />
          <Text style={styles.sectionTitle}>My Requests</Text>
          {myForms.length > 0 && (
            <View style={[styles.sectionBadge, { backgroundColor: "#3B82F6" }]}>
              <Text style={styles.sectionBadgeText}>{myForms.length}</Text>
            </View>
          )}
        </View>

        {myForms.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="clipboard-plus-outline"
              size={32}
              color="#cbd5e1"
            />
            <Text style={styles.emptyText}>No self-requested forms</Text>
          </View>
        ) : (
          <FlatList
            data={myForms}
            keyExtractor={(item) => `mine-${item.id}`}
            renderItem={renderMyForm}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={() => router.push("/(engineer)/mytask/form" as any)}
        label="Request Form"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9ff" },
  scroll: { padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EAB308",
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: "center",
  },
  sectionBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  statusEdge: { width: 4 },
  cardBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priorityText: { fontSize: 10, fontWeight: "700" },
  cardSub: { fontSize: 12, color: "#64748b", marginBottom: 8 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardFooterLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardMeta: { fontSize: 11, color: "#94a3b8" },

  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    backgroundColor: "#fff",
    borderRadius: 12,
    gap: 8,
  },
  emptyText: { color: "#94a3b8", fontSize: 13 },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    backgroundColor: BRAND,
    borderRadius: 16,
  },
});
