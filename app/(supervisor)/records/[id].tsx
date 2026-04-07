import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Svg, Path } from "react-native-svg";
import { apiFetch } from "@/lib/api";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

const BRAND = "#18B4E8";
const { width: SCREEN_W } = Dimensions.get("window");
type Point = { x: number; y: number };

const TRACKING_STATUS_COLOR: Record<string, string> = {
  ongoing: "#22C55E",
  completed: "#6B7280",
  verified: "#A855F7",
};

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

const SURVEY_FIELDS = [
  { key: "work_quality", label: "Work Quality" },
  { key: "timeliness", label: "Timeliness" },
  { key: "communication", label: "Communication" },
  { key: "safety_compliance", label: "Safety Compliance" },
  { key: "problem_solving", label: "Problem Solving" },
];

type FormDetail = {
  id: number;
  title: string;
  description: string;
  client_name: string;
  company_name: string;
  priority_level: string;
  date_from: string;
  date_to: string;
  status: string;
  comment: string | null;
  created_by_name: string;
  assigned_to_name: string;
  attachments: { id: number; file_url: string; type: string }[];
};

type JobDetail = {
  tracking_id: number;
  form_id: number;
  form_title: string;
  client_name: string;
  company_name: string;
  worker_name: string;
  tracking_status: "ongoing" | "completed" | "verified";
  priority_level: string;
  date_from: string;
  date_to: string;
  description: string;
  comment: string | null;
  latitude: number | null;
  longitude: number | null;
  started_at: string;
  ended_at: string;
  updated_at: string;
  signature_url: string | null;
  photos: { id: number; file_url: string }[];
    form_photos: { id: number; file_url: string }[]; // add this
  survey_answers: { field_key: string; field_value: string }[];
};

function renderSignature(sigUri: string | null) {
  if (!sigUri)
    return (
      <View style={styles.sigEmpty}>
        <MaterialCommunityIcons name="draw-pen" size={28} color="#9ca3af" />
        <Text style={styles.sigHint}>No signature</Text>
      </View>
    );

  if (sigUri.startsWith("__drawing__:")) {
    const paths: Point[][] = JSON.parse(sigUri.replace("__drawing__:", ""));
    const canvasSize = SCREEN_W - 80;
    const toD = (pts: Point[]) =>
      pts
        .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
        .join(" ");
    return (
      <View style={{ alignItems: "center", padding: 10 }}>
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
  }

  return (
    <Image
      source={{ uri: sigUri }}
      style={styles.signature}
      resizeMode="contain"
    />
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

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

function calcDuration(from: string, to: string) {
  if (!from || !to) return null;
  const days =
    Math.round(
      (new Date(to.slice(0, 10)).getTime() -
        new Date(from.slice(0, 10)).getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1;
  return `${days} day${days !== 1 ? "s" : ""}`;
}

export default function RecordDetailScreen() {
  const { id, source } = useLocalSearchParams<{
    id: string;
    source: "form" | "job";
  }>();

  const [form, setForm] = useState<FormDetail | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"job" | "form">("form");

  const fetchData = useCallback(async () => {
    try {
      if (source === "job") {
        const data = await apiFetch(`/api/supervisor/jobs/${id}`);
        setJob(data);
        setActiveTab("job");
      } else {
        const data = await apiFetch(`/api/supervisor/forms/${id}`);
        setForm(data);
        setActiveTab("form");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, source]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );

  // ── SOURCE = JOB ──
  if (source === "job" && job) {
    const statusColor = TRACKING_STATUS_COLOR[job.tracking_status] ?? "#ccc";
    return (
      <>
        <Stack.Screen
          options={{
            title: job.form_title,
            headerBackTitle: "",
            headerStyle: { backgroundColor: "#fff" },
            headerTintColor: "#000",
            headerShadowVisible: true,
          }}
        />
        <View style={styles.container}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "job" && styles.tabBtnActive,
              ]}
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
              style={[
                styles.tabBtn,
                activeTab === "form" && styles.tabBtnActive,
              ]}
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
              {/* Status */}
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor + "22" },
                  ]}
                >
                  {job.tracking_status === "ongoing" && (
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColor },
                      ]}
                    />
                  )}
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {job.tracking_status.charAt(0).toUpperCase() +
                      job.tracking_status.slice(1)}
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

              {/* Time */}
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

              {/* Map */}
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={16}
                  color={BRAND}
                />
                <Text style={styles.sectionTitle}>Last Location</Text>
              </View>
              {job.latitude !== null && job.longitude !== null ? (
                <MapView
                  provider={PROVIDER_DEFAULT}
                  style={styles.map}
                  region={{
                    latitude: parseFloat(job.latitude as any),
                    longitude: parseFloat(job.longitude as any),
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: parseFloat(job.latitude as any),
                      longitude: parseFloat(job.longitude as any),
                    }}
                    title={job.worker_name}
                    pinColor={BRAND}
                  />
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

              {/* Photos */}
              {job.photos?.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons
                      name="camera-outline"
                      size={16}
                      color={BRAND}
                    />
                    <Text style={styles.sectionTitle}>Site Photos</Text>
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

              {/* Survey */}
              {job.survey_answers?.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <MaterialCommunityIcons
                      name="clipboard-list-outline"
                      size={16}
                      color={BRAND}
                    />
                    <Text style={styles.sectionTitle}>Performance Survey</Text>
                  </View>
                  <View style={styles.surveyCard}>
                    {SURVEY_FIELDS.map((field) => {
                      const answer = job.survey_answers.find(
                        (a) => a.field_key === field.key,
                      );
                      const rating = answer ? Number(answer.field_value) : 0;
                      return (
                        <View key={field.key} style={styles.surveyRow}>
                          <Text style={styles.surveyLabel}>{field.label}</Text>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 4,
                              alignItems: "center",
                            }}
                          >
                            {[1, 2, 3, 4, 5].map((star) => (
                              <MaterialCommunityIcons
                                key={star}
                                name={star <= rating ? "star" : "star-outline"}
                                size={20}
                                color={star <= rating ? "#f59e0b" : "#d1d5db"}
                              />
                            ))}
                            <Text style={styles.ratingText}>{rating}/5</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Signature */}
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="draw-pen"
                  size={16}
                  color={BRAND}
                />
                <Text style={styles.sectionTitle}>Client Signature</Text>
              </View>
              <View style={styles.sigContainer}>
                {renderSignature(job.signature_url)}
              </View>

              {/* Verified banner */}
              {job.tracking_status === "verified" && (
                <View style={styles.verifiedBanner}>
                  <MaterialCommunityIcons
                    name="shield-check"
                    size={18}
                    color="#A855F7"
                  />
                  <Text style={styles.verifiedText}>
                    Verified by supervisor
                  </Text>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          ) : (
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
                <InfoRow label="Client" value={job.client_name} />
                <InfoRow label="Company" value={job.company_name} />
                <InfoRow label="Worker" value={job.worker_name} />
                {job.priority_level && (
                  <InfoRow
                    label="Priority"
                    value={
                      job.priority_level.charAt(0).toUpperCase() +
                      job.priority_level.slice(1)
                    }
                    valueColor={PRIORITY_COLORS[job.priority_level]}
                  />
                )}
                <InfoRow label="Date From" value={formatDate(job.date_from)} />
                <InfoRow label="Date To" value={formatDate(job.date_to)} />
                <InfoRow
                  label="Duration"
                  value={calcDuration(job.date_from, job.date_to) ?? "—"}
                />
                {!!job.comment && (
                  <InfoRow label="Comment" value={job.comment!} />
                )}
              </View>
               {/* ADD HERE ↓ */}
    {job.form_photos?.length > 0 && (
      <>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="paperclip" size={16} color={BRAND} />
          <Text style={styles.sectionTitle}>Form Attachments</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.attachRow}
        >
          {job.form_photos.map((p) => (
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

  // ── SOURCE = FORM ──
  if (!form)
    return (
      <View style={styles.centered}>
        <Text style={{ color: "#94a3b8" }}>Not found.</Text>
      </View>
    );

  const statusColor = STATUS_COLOR[form.status] ?? "#ccc";

  return (
    <>
      <Stack.Screen
        options={{
          title: form.title,
          headerBackTitle: "",
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#000",
          headerShadowVisible: true,
        }}
      />
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor + "22", alignSelf: "flex-start" },
            ]}
          >
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{form.title}</Text>
            {!!form.description && (
              <Text style={styles.formDesc}>{form.description}</Text>
            )}
            <View style={styles.formDivider} />
            <InfoRow label="Client" value={form.client_name} />
            <InfoRow label="Company" value={form.company_name} />
            <InfoRow label="Assigned To" value={form.assigned_to_name} />
            <InfoRow label="Created By" value={form.created_by_name} />
            {form.priority_level && (
              <InfoRow
                label="Priority"
                value={
                  form.priority_level.charAt(0).toUpperCase() +
                  form.priority_level.slice(1)
                }
                valueColor={PRIORITY_COLORS[form.priority_level]}
              />
            )}
            <InfoRow label="Date From" value={formatDate(form.date_from)} />
            <InfoRow label="Date To" value={formatDate(form.date_to)} />
            <InfoRow
              label="Duration"
              value={calcDuration(form.date_from, form.date_to) ?? "—"}
            />
            {!!form.comment && (
              <InfoRow label="Comment" value={form.comment!} />
            )}
          </View>

          {form.attachments?.filter((a) => a.type === "form_doc").length >
            0 && (
            <>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="paperclip"
                  size={16}
                  color={BRAND}
                />
                <Text style={styles.sectionTitle}>Attachments</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.attachRow}
              >
                {form.attachments
                  .filter((a) => a.type === "form_doc")
                  .map((a) => (
                    <Image
                      key={a.id}
                      source={{ uri: a.file_url }}
                      style={styles.attachThumb}
                      resizeMode="cover"
                    />
                  ))}
              </ScrollView>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </>
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

  surveyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  surveyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  surveyLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  ratingText: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "700",
    marginLeft: 4,
  },

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
  signature: { width: "100%", height: 160 },

  verifiedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#faf5ff",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  verifiedText: { fontSize: 13, color: "#A855F7", fontWeight: "600" },

  attachRow: { gap: 10, paddingVertical: 4 },
  attachThumb: {
    width: 100,
    height: 100,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },

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
});
