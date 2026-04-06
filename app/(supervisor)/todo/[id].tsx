import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
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

const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "#EAB308",
  accepted: "#3B82F6",
  rejected: "#EF4444",
  ongoing: "#22C55E",
  completed: "#6B7280",
  verified: "#A855F7",
};

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
  tracking_id?: number;
};

type JobDetail = {
  tracking_id: number;
  form_id: number;
  form_title: string;
  client_name: string;
  company_name: string;
  worker_name: string;
  tracking_status: "ongoing" | "completed" | "verified";
  form_status: string;
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
  survey_answers: { field_key: string; field_value: string }[];
};

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

export default function TodoDetailScreen() {
  const { id, source } = useLocalSearchParams<{
    id: string;
    source: "form" | "job";
  }>();
  const router = useRouter();
  const SURVEY_FIELDS = [
    { key: "work_quality", label: "Work Quality" },
    { key: "timeliness", label: "Timeliness" },
    { key: "communication", label: "Communication" },
    { key: "safety_compliance", label: "Safety Compliance" },
    { key: "problem_solving", label: "Problem Solving" },
  ];

  const [form, setForm] = useState<FormDetail | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"job" | "form">("form");
  const [actionLoading, setActionLoading] = useState<
    "accept" | "reject" | null
  >(null);
  const [verifying, setVerifying] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      if (source === "job") {
        const jobData = await apiFetch(`/api/supervisor/jobs/${id}`);
        setJob(jobData);
        setActiveTab("job");
      } else {
        const formData = await apiFetch(`/api/supervisor/forms/${id}`);
        setForm(formData);
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

  const handleAccept = () => {
    Alert.alert("Accept Form", "Accept this form?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Accept",
        onPress: async () => {
          setActionLoading("accept");
          try {
            await apiFetch(`/api/supervisor/forms/${id}/accept`, {
              method: "PATCH",
            });
            Alert.alert("Done", "Form accepted.", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch {
            Alert.alert("Error", "Failed to accept.");
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleReject = () => {
    Alert.alert("Reject Form", "Reject this form?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          setActionLoading("reject");
          try {
            await apiFetch(`/api/supervisor/forms/${id}/reject`, {
              method: "PATCH",
            });
            Alert.alert("Done", "Form rejected.", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch {
            Alert.alert("Error", "Failed to reject.");
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleVerify = () => {
    Alert.alert("Verify Job", "Mark this job as verified?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Verify",
        onPress: async () => {
          setVerifying(true);
          try {
            const data = await apiFetch(`/api/supervisor/jobs/${id}/verify`, {
              method: "PATCH",
            });
            if (data?.message === "Job verified.") {
              Alert.alert("Verified!", "Job has been verified.", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } else {
              Alert.alert("Error", data?.message ?? "Failed to verify.");
            }
          } catch {
            Alert.alert("Error", "Network error.");
          } finally {
            setVerifying(false);
          }
        },
      },
    ]);
  };

  if (loading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );

  // ── SOURCE = JOB ──
  if (source === "job" && job) {
    const canVerify = job.tracking_status === "completed";
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
          {/* Tabs */}
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
                    {
                      backgroundColor:
                        (TRACKING_STATUS_COLOR[job.tracking_status] ?? "#ccc") +
                        "22",
                    },
                  ]}
                >
                  {job.tracking_status === "ongoing" && (
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            TRACKING_STATUS_COLOR[job.tracking_status],
                        },
                      ]}
                    />
                  )}
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          TRACKING_STATUS_COLOR[job.tracking_status] ?? "#ccc",
                      },
                    ]}
                  >
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
                          <View style={{ flexDirection: "row", gap: 4 }}>
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
            </ScrollView>
          ) : (
            // Form Details Tab
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>{job.form_title}</Text>
                {job.description ? (
                  <Text style={styles.formDesc}>{job.description}</Text>
                ) : null}
                <View style={styles.formDivider} />
                <InfoRow label="Client" value={job.client_name} />
                <InfoRow label="Company" value={job.company_name} />
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
                {job.comment ? (
                  <InfoRow label="Comment" value={job.comment} />
                ) : null}
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {/* Verify button */}
          {canVerify && (
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={handleVerify}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="shield-check-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.verifyBtnText}>Verify Job</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {job.tracking_status === "verified" && (
            <View style={styles.verifiedBar}>
              <MaterialCommunityIcons
                name="shield-check"
                size={18}
                color="#A855F7"
              />
              <Text style={styles.verifiedBarText}>Job Verified</Text>
            </View>
          )}
        </View>
      </>
    );
  }

  // ── SOURCE = FORM ──
  if (!form)
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Not found.</Text>
      </View>
    );
  const isPending = form.status === "pending";

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
          {/* Status banner */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: (STATUS_COLOR[form.status] ?? "#ccc") + "22",
                alignSelf: "flex-start",
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: STATUS_COLOR[form.status] ?? "#ccc" },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: STATUS_COLOR[form.status] ?? "#ccc" },
              ]}
            >
              {form.status.toUpperCase()}
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{form.title}</Text>
            {form.description ? (
              <Text style={styles.formDesc}>{form.description}</Text>
            ) : null}
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
            {form.comment ? (
              <InfoRow label="Comment" value={form.comment} />
            ) : null}
          </View>

          {/* Attachments */}
          {form.attachments?.filter((a) => a.type === "form_doc").length >
            0 && (
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

          <View style={{ height: 100 }} />
        </ScrollView>

        {isPending && (
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.rejectBtn, !!actionLoading && { opacity: 0.6 }]}
              onPress={handleReject}
              disabled={!!actionLoading}
            >
              {actionLoading === "reject" ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="close-circle-outline"
                    size={18}
                    color="#ef4444"
                  />
                  <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>
                    Reject
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, !!actionLoading && { opacity: 0.6 }]}
              onPress={handleAccept}
              disabled={!!actionLoading}
            >
              {actionLoading === "accept" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>
                    Accept
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9ff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#94a3b8", fontSize: 14 },
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827", flex: 1 },

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

  actionBar: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  verifyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#A855F7",
    borderRadius: 10,
    paddingVertical: 14,
  },
  verifyBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  verifiedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    backgroundColor: "#faf5ff",
    borderTopWidth: 1,
    borderTopColor: "#e9d5ff",
  },
  verifiedBarText: { fontSize: 14, fontWeight: "700", color: "#A855F7" },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#ef4444",
    backgroundColor: "#fff5f5",
  },
  acceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: BRAND,
  },
  actionBtnText: { fontSize: 14, fontWeight: "700" },
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
    alignSelf: "center",
  },
});
