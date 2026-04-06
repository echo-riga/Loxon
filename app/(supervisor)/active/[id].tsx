// (supervisor)/active/[id].tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import { Svg, Path } from "react-native-svg";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/lib/api";
import { API_URL } from "@/lib/config";
const { width: SCREEN_W } = Dimensions.get("window");
const BRAND = "#18B4E8";
const SOCKET_URL = API_URL ?? "http://localhost:3000";

const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  ongoing: "#22c55e",
  completed: "#6b7280",
  verified: "#a855f7",
};

type Point = { x: number; y: number };

type JobDetail = {
  tracking_id: number;
  form_id: number;
  form_title: string;
  client_name: string;
  company_name: string;
  form_status: string;
  worker_name: string;
  tracking_status: string;
  latitude: number | null;
  longitude: number | null;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
  signature_url: string | null;
  photos: { id: number; file_url: string }[];
  priority_level?: string;
  date_from?: string;
  date_to?: string;
  duration?: number;
  description?: string;
  comment?: string | null;
};

export default function SupervisorActiveJobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trackingId = Number(id);

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"job" | "form">("job");
  const [liveCoord, setLiveCoord] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const socketRef = useRef<Socket | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/supervisor/jobs/${trackingId}`);
      setJob(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [trackingId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Socket — listen for live location
  useEffect(() => {
    if (!job || job.tracking_status !== "ongoing") return;

    (async () => {
      try {
        const token = await AsyncStorage.getItem("worktrace_token");
        const socket = io(SOCKET_URL, {
          auth: { token },
          transports: ["polling", "websocket"],
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          socket.emit("join_job", trackingId);
        });

        socket.on("connect_error", (err) => {
          console.error("socket connect_error", err);
        });

        socket.on(
          "location_broadcast",
          ({
            latitude,
            longitude,
          }: {
            latitude: number;
            longitude: number;
            trackingId: number;
          }) => {
            setLiveCoord({
              latitude: Number(latitude),
              longitude: Number(longitude),
            });
          },
        );
      } catch (e) {
        console.error("socket setup error", e);
      }
    })();

    return () => {
      socketRef.current?.disconnect();
    };
  }, [job?.tracking_status, trackingId]);

  function formatDateTime(d: string | null) {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  function renderSignature(sigUri: string | null) {
    if (!sigUri) {
      return (
        <View style={styles.sigEmpty}>
          <MaterialCommunityIcons name="draw-pen" size={28} color="#9ca3af" />
          <Text style={styles.sigHint}>No signature</Text>
        </View>
      );
    }

    if (sigUri.startsWith("__drawing__:")) {
      try {
        const paths: Point[][] = JSON.parse(sigUri.replace("__drawing__:", ""));
        const canvasSize = SCREEN_W - 80;
        function toD(pts: Point[]) {
          return pts
            .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
            .join(" ");
        }
        return (
          <View style={styles.sigPreview}>
            <Svg width={canvasSize} height={140}>
              {paths.map((pts, i) => (
                <Path
                  key={i}
                  d={toD(pts)}
                  stroke="#111827"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </Svg>
          </View>
        );
      } catch {
        return (
          <View style={styles.sigEmpty}>
            <MaterialCommunityIcons name="draw-pen" size={28} color="#9ca3af" />
            <Text style={styles.sigHint}>Invalid signature</Text>
          </View>
        );
      }
    }

    return (
      <Image
        source={{ uri: sigUri }}
        style={styles.sigImage}
        resizeMode="contain"
      />
    );
  }

  if (loading || !job) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND} size="large" />
      </View>
    );
  }

  const mapCoord =
    liveCoord ??
    (job.latitude && job.longitude
      ? {
          latitude: Number(job.latitude),
          longitude: Number(job.longitude),
        }
      : null);

  const duration =
    job.date_from && job.date_to
      ? Math.round(
          (new Date(job.date_to.slice(0, 10)).getTime() -
            new Date(job.date_from.slice(0, 10)).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1
      : null;

  const trackingStatus = job.tracking_status ?? "";

  return (
    <>
      <Stack.Screen
        options={{
          title: job.form_title ?? "Job Detail",
          headerBackTitle: "",
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#000",
          headerShadowVisible: true,
        }}
      />

      <View style={styles.container}>
        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "job" && styles.tabBtnActive]}
            onPress={() => setActiveTab("job")}
          >
            <MaterialCommunityIcons
              name="map-marker-radius-outline"
              size={16}
              color={activeTab === "job" ? BRAND : "#9ca3af"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "job" && styles.tabTextActive,
              ]}
            >
              Job / Track
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "form" && styles.tabBtnActive]}
            onPress={() => setActiveTab("form")}
          >
            <MaterialCommunityIcons
              name="file-document-outline"
              size={16}
              color={activeTab === "form" ? BRAND : "#9ca3af"}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "form" && styles.tabTextActive,
              ]}
            >
              Form Details
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "job" ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Status row */}
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      (STATUS_COLORS[trackingStatus] ?? "#ccc") + "22",
                  },
                ]}
              >
                {trackingStatus === "ongoing" && (
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          STATUS_COLORS[trackingStatus] ?? "#ccc",
                      },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.statusText,
                    { color: STATUS_COLORS[trackingStatus] ?? "#ccc" },
                  ]}
                >
                  {trackingStatus.charAt(0).toUpperCase() +
                    trackingStatus.slice(1)}
                </Text>
              </View>
              <Text style={styles.updateTime}>
                Updated {formatDateTime(job.updated_at)}
              </Text>
            </View>

            {/* Worker */}
            <View style={styles.workerCard}>
              <MaterialCommunityIcons
                name="account-hard-hat-outline"
                size={20}
                color={BRAND}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.workerLabel}>Engineer</Text>
                <Text style={styles.workerName}>{job.worker_name}</Text>
              </View>
            </View>

            {/* Time card */}
            <View style={styles.timeCard}>
              <View style={styles.timeRow}>
                <MaterialCommunityIcons
                  name="play-circle-outline"
                  size={18}
                  color="#22c55e"
                />
                <View>
                  <Text style={styles.timeLabel}>Started</Text>
                  <Text style={styles.timeVal}>
                    {formatDateTime(job.started_at)}
                  </Text>
                </View>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeRow}>
                <MaterialCommunityIcons
                  name="stop-circle-outline"
                  size={18}
                  color={job.ended_at ? "#6b7280" : "#d1d5db"}
                />
                <View>
                  <Text style={styles.timeLabel}>Ended</Text>
                  <Text
                    style={[
                      styles.timeVal,
                      !job.ended_at && { color: "#d1d5db" },
                    ]}
                  >
                    {formatDateTime(job.ended_at)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Live Map */}
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="map-marker"
                size={16}
                color={BRAND}
              />
              <Text style={styles.sectionTitle}>Live Location</Text>
              {trackingStatus === "ongoing" && (
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>

            {mapCoord ? (
              <MapView
                style={styles.map}
                region={{
                  latitude: mapCoord.latitude,
                  longitude: mapCoord.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
              >
                <Marker coordinate={mapCoord} title={job.worker_name} />
              </MapView>
            ) : (
              <View style={styles.mapPlaceholder}>
                <MaterialCommunityIcons
                  name="map-search-outline"
                  size={36}
                  color="#cbd5e1"
                />
                <Text style={styles.mapPlaceholderText}>
                  Location not available
                </Text>
              </View>
            )}

            {/* Signature */}
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="draw-pen" size={16} color={BRAND} />
              <Text style={styles.sectionTitle}>Signature</Text>
            </View>
            <View style={styles.sigContainer}>
              {renderSignature(job.signature_url)}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          // ── Form Details Tab ──
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{job.form_title}</Text>
              {!!job.description && (
                <Text style={styles.formDesc}>{job.description}</Text>
              )}
              <View style={styles.formDivider} />
              <InfoRow label="Client" value={job.client_name ?? "—"} />
              <InfoRow label="Company" value={job.company_name ?? "—"} />
              {!!job.priority_level && (
                <InfoRow
                  label="Priority"
                  value={
                    job.priority_level.charAt(0).toUpperCase() +
                    job.priority_level.slice(1)
                  }
                  valueColor={PRIORITY_COLORS[job.priority_level]}
                />
              )}
              {!!job.date_from && (
                <InfoRow label="Date From" value={formatDate(job.date_from)} />
              )}
              {!!job.date_to && (
                <InfoRow label="Date To" value={formatDate(job.date_to)} />
              )}
              {!!duration && (
                <InfoRow
                  label="Duration"
                  value={`${duration} day${duration !== 1 ? "s" : ""}`}
                />
              )}
              {!!job.comment && (
                <InfoRow label="Comment" value={job.comment!} />
              )}
            </View>

            {/* Photos */}
            {job.photos && job.photos.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="paperclip"
                    size={16}
                    color={BRAND}
                  />
                  <Text style={styles.sectionTitle}>Photos</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.attachRow}
                >
                  {job.photos.map((p) => (
                    <Image
                      key={p.id}
                      source={{ uri: p.file_url }}
                      style={styles.attachThumb}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[styles.infoValue, valueColor ? { color: valueColor } : null]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9ff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 16, gap: 12 },

  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: BRAND },
  tabText: { fontSize: 14, fontWeight: "500", color: "#9ca3af" },
  tabTextActive: { color: BRAND },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: "600" },
  updateTime: { fontSize: 12, color: "#9ca3af" },

  workerCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  workerLabel: { fontSize: 11, color: "#9ca3af" },
  workerName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },

  timeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  timeRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  timeDivider: { width: 1, height: 36, backgroundColor: "#e5e7eb" },
  timeLabel: { fontSize: 11, color: "#9ca3af" },
  timeVal: { fontSize: 13, fontWeight: "600", color: "#111827" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827", flex: 1 },
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

  map: { width: "100%", height: 220, borderRadius: 12, overflow: "hidden" },
  mapPlaceholder: {
    height: 160,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  mapPlaceholderText: { fontSize: 13, color: "#9ca3af" },

  sigContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  sigEmpty: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sigHint: { fontSize: 13, color: "#9ca3af" },
  sigPreview: { alignItems: "center", justifyContent: "center", padding: 10 },
  sigImage: { width: "100%", height: 160 },

  formCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  formTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  formDesc: { fontSize: 14, color: "#4b5563", lineHeight: 20 },
  formDivider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 4 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  infoLabel: { fontSize: 13, color: "#9ca3af", flex: 1 },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    flex: 2,
    textAlign: "right",
  },

  attachRow: { gap: 10, paddingVertical: 4 },
  attachThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
});
