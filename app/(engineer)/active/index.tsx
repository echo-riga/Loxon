// (engineer)/active/index.tsx
import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, Socket } from "socket.io-client";
import { apiFetch } from "@/lib/api";
import { API_URL } from "@/lib/config";

type Job = {
  id: number;
  form_id: number;
  status: "ongoing" | "completed" | "verified";
  latitude: number | null;
  longitude: number | null;
  started_at: string | null;
  updated_at: string;
  title: string;
  client_name: string;
  company_name: string;
  priority_level: "low" | "medium" | "high";
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

function formatElapsed(started_at: string | null): string {
  if (!started_at) return "—";
  const diff = Date.now() - new Date(started_at).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m elapsed`;
  return `${m}m elapsed`;
}

function JobCard({ job }: { job: Job }) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/active/${job.id}` as any)}
    >
      <View
        style={[
          styles.priorityStripe,
          { backgroundColor: PRIORITY_COLORS[job.priority_level] ?? "#ccc" },
        ]}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {job.title}
          </Text>
          <View style={styles.ongoingBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.ongoingText}>Ongoing</Text>
          </View>
        </View>
        <Text style={styles.cardSub} numberOfLines={1}>
          <Text style={styles.dimLabel}>Client: </Text>
          {job.client_name}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          <Text style={styles.dimLabel}>Company: </Text>
          {job.company_name}
        </Text>
        <View style={styles.cardBottom}>
          <View style={styles.priorityPill}>
            <View
              style={[
                styles.priorityDot,
                {
                  backgroundColor:
                    PRIORITY_COLORS[job.priority_level] ?? "#ccc",
                },
              ]}
            />
            <Text style={styles.priorityText}>
              {job.priority_level.charAt(0).toUpperCase() +
                job.priority_level.slice(1)}
            </Text>
          </View>
          <View style={styles.elapsedRow}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={13}
              color="#6b7280"
            />
            <Text style={styles.elapsedText}>
              {formatElapsed(job.started_at)}
            </Text>
          </View>
        </View>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color="#d1d5db"
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

export default function ActiveJobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const jobsRef = useRef<Job[]>([]);

  // Keep jobsRef in sync with state
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch("/api/engineer/jobs");
      setJobs(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const stopLocationTracking = useCallback(() => {
    locationSubRef.current?.remove();
    locationSubRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  const startLocationTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    const token = await AsyncStorage.getItem("worktrace_token");

    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      (loc) => {
        const { latitude, longitude } = loc.coords;

        jobsRef.current.forEach((job) => {
          // Primary: socket
          socket.emit("location_update", {
            trackingId: job.id,
            latitude,
            longitude,
          });

          // Fallback: REST
          apiFetch(`/api/engineer/jobs/${job.id}/location`, {
            method: "PATCH",
            body: JSON.stringify({ latitude, longitude }),
          }).catch(() => {});
        });
      },
    );

    locationSubRef.current = sub;
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchJobs().then(() => {
        if (jobsRef.current.length > 0) {
          startLocationTracking();
        }
      });

      return () => {
        stopLocationTracking();
      };
    }, []),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#18B4E8" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(j) => String(j.id)}
        contentContainerStyle={
          jobs.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchJobs(true);
            }}
            colors={["#18B4E8"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons
              name="map-marker-off-outline"
              size={56}
              color="#cbd5e1"
            />
            <Text style={styles.emptyTitle}>No active jobs</Text>
            <Text style={styles.emptySub}>
              Accepted forms will appear here once they're ongoing.
            </Text>
          </View>
        }
        renderItem={({ item }) => <JobCard job={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9ff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 8,
    marginTop: 80,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: "#374151" },
  emptySub: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  priorityStripe: { width: 4, alignSelf: "stretch" },
  cardBody: { flex: 1, padding: 14, gap: 4 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827", flex: 1 },
  ongoingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  ongoingText: { fontSize: 11, fontWeight: "600", color: "#15803d" },
  cardSub: { fontSize: 13, color: "#4b5563" },
  dimLabel: { color: "#9ca3af" },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  priorityPill: { flexDirection: "row", alignItems: "center", gap: 5 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityText: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
  elapsedRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  elapsedText: { fontSize: 12, color: "#6b7280" },
  chevron: { marginRight: 10 },
});
