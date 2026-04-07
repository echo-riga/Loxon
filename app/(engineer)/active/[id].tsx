// (engineer)/activejobs/[id].tsx
import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Svg, Path } from "react-native-svg";
import { apiFetch } from "@/lib/api";
import { uploadImage } from "@/lib/uploadImage";
import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/lib/config";
import NetInfo from "@react-native-community/netinfo";
import {
  flushOfflineQueue,
  enqueueOfflineDone,
  draftKey,
  OFFLINE_QUEUE_KEY,
  type QueuedDonePayload,
} from "@/lib/offlineQueue";

const { width: SCREEN_W } = Dimensions.get("window");
const SOCKET_URL = API_URL ?? "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────
type TrackingStatus = "ongoing" | "completed" | "verified";
type Attachment = { id: number; file_url: string; type: string };
type JobDetail = {
  id: number;
  form_id: number;
  status: TrackingStatus;
  signature_url: string | null;
  latitude: number | null;
  longitude: number | null;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
  title: string;
  description: string;
  client_name: string;
  company_name: string;
  priority_level: "low" | "medium" | "high";
  date_from: string;
  date_to: string;
  duration: number;
  comment: string | null;
  attachments: Attachment[];
};

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

const SURVEY_FIELDS = [
  { key: "work_quality", label: "Work Quality" },
  { key: "timeliness", label: "Timeliness" },
  { key: "communication", label: "Communication" },
  { key: "safety_compliance", label: "Safety Compliance" },
  { key: "problem_solving", label: "Problem Solving" },
];

type Point = { x: number; y: number };

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => !disabled && onChange(star)}
          disabled={disabled}
        >
          <MaterialCommunityIcons
            name={star <= value ? "star" : "star-outline"}
            size={28}
            color={star <= value ? "#f59e0b" : "#d1d5db"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Signature Canvas ─────────────────────────────────────────────────────────
function SignatureCanvas({
  onSave,
  onClose,
}: {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [paths, setPaths] = useState<Point[][]>([]);
  const [current, setCurrent] = useState<Point[]>([]);
  const canvasSize = SCREEN_W - 48;

  function toD(pts: Point[]) {
    if (pts.length < 2) return "";
    return pts
      .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
      .join(" ");
  }

  return (
    <Modal transparent animationType="slide">
      <View style={sigStyles.overlay}>
        <View style={sigStyles.sheet}>
          <Text style={sigStyles.title}>Draw Signature</Text>
          <View
            style={[sigStyles.canvas, { width: canvasSize, height: 200 }]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              setCurrent([{ x: locationX, y: locationY }]);
            }}
            onResponderMove={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              setCurrent((prev) => [...prev, { x: locationX, y: locationY }]);
            }}
            onResponderRelease={() => {
              if (current.length > 1) setPaths((prev) => [...prev, current]);
              setCurrent([]);
            }}
          >
            <Svg width={canvasSize} height={200}>
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
              {current.length > 1 && (
                <Path
                  d={toD(current)}
                  stroke="#111827"
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg>
          </View>
          <Text style={sigStyles.hint}>Sign above</Text>
          <View style={sigStyles.row}>
            <TouchableOpacity
              style={sigStyles.clearBtn}
              onPress={() => setPaths([])}
            >
              <Text style={sigStyles.clearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sigStyles.cancelBtn} onPress={onClose}>
              <Text style={sigStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                sigStyles.saveBtn,
                paths.length === 0 && sigStyles.saveBtnDisabled,
              ]}
              disabled={paths.length === 0}
              onPress={() => onSave(JSON.stringify(paths))}
            >
              <Text style={sigStyles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ActiveJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);

  // ─── State ────────────────────────────────────────────────────────────────
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"job" | "form">("job");
  const [liveCoord, setLiveCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showSigCanvas, setShowSigCanvas] = useState(false);
  const [sigUri, setSigUri] = useState<string | null>(null);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [isQueued, setIsQueued] = useState(false);

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // Ref so fetchJob can read sigUri without being in its dep array (avoids infinite loop)
  const sigUriRef = useRef<string | null>(null);

  // Keep sigUriRef in sync with sigUri state
  useEffect(() => {
    sigUriRef.current = sigUri;
  }, [sigUri]);

  // ─── 1. Load draft from AsyncStorage on mount ─────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKey(jobId));
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.ratings) setRatings(draft.ratings);
          if (draft.sigUri !== undefined) setSigUri(draft.sigUri);
        }
        const queueRaw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
        if (queueRaw) {
          const queue: QueuedDonePayload[] = JSON.parse(queueRaw);
          if (queue.some((q) => q.jobId === jobId)) setIsQueued(true);
        }
      } catch (e) {
        console.error("draft load error", e);
      }
    })();
  }, [jobId]);

  // ─── 2. Save draft whenever ratings or sigUri changes ────────────────────
  useEffect(() => {
    AsyncStorage.setItem(
      draftKey(jobId),
      JSON.stringify({ ratings, sigUri })
    ).catch(() => {});
  }, [ratings, sigUri, jobId]);

  // ─── 3. fetchJob — defined before any effect that calls it ───────────────
  const fetchJob = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/engineer/jobs/${jobId}`);
      setJob(data);
      // Use ref to avoid stale closure without adding sigUri to deps
      if (data?.signature_url && !sigUriRef.current) {
        setSigUri(data.signature_url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [jobId]); // sigUri intentionally omitted — read via ref

  // ─── 4. Initial fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // ─── 5. Auto-sync queue + socket reconnect when connection returns ────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        // Reconnect socket if job is still ongoing and socket is not connected
        if (job?.status === "ongoing" && !socketRef.current?.connected) {
          AsyncStorage.getItem("worktrace_token").then((token) => {
            const socket = io(SOCKET_URL, {
              auth: { token },
              transports: ["websocket"],
            });
            socketRef.current = socket;
            socket.on("connect", () => socket.emit("join_job", jobId));
            socket.on("connect_error", (err) =>
              console.error("socket reconnect error", err)
            );
          });
        }

        flushOfflineQueue().then(() => {
          AsyncStorage.getItem(OFFLINE_QUEUE_KEY).then((raw) => {
            if (!raw) {
              setIsQueued(false);
              return;
            }
            const queue: QueuedDonePayload[] = JSON.parse(raw);
            const stillQueued = queue.some((q) => q.jobId === jobId);
            setIsQueued(stillQueued);
            if (!stillQueued) fetchJob();
          });
        });
      }
    });
    return () => unsubscribe();
  }, [jobId, job?.status, fetchJob]);

  // ─── 6. Location tracking + initial socket setup ─────────────────────────
  useEffect(() => {
    if (!job || job.status !== "ongoing") return;

    (async () => {
      try {
        // Check connectivity before attempting socket connection
        const netState = await NetInfo.fetch();

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        if (netState.isConnected) {
          const token = await AsyncStorage.getItem("worktrace_token");
          const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ["websocket"],
          });
          socketRef.current = socket;
          socket.on("connect", () => socket.emit("join_job", jobId));
          socket.on("connect_error", (err) =>
            console.error("socket error", err)
          );
        }

        locationSub.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            setLiveCoord({ latitude, longitude });
            if (socketRef.current?.connected) {
              socketRef.current.emit("location_update", {
                trackingId: jobId,
                latitude,
                longitude,
              });
            } else {
              // Fallback to REST when socket is unavailable (offline)
              apiFetch(`/api/engineer/jobs/${jobId}/location`, {
                method: "PATCH",
                body: JSON.stringify({ latitude, longitude }),
              }).catch(() => {});
            }
          }
        );
      } catch (e) {
        console.error("location/socket setup error", e);
      }
    })();

    return () => {
      locationSub.current?.remove();
      socketRef.current?.disconnect();
    };
  }, [job?.status, jobId]);

  // ─── Signature helpers ────────────────────────────────────────────────────
  async function pickSignatureImage(source: "gallery" | "camera") {
    try {
      const result =
        source === "gallery"
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"] as any,
              quality: 0.8,
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"] as any,
              quality: 0.8,
            });
      if (!result.canceled && result.assets[0])
        await uploadSignature(result.assets[0].uri);
    } catch {
      Alert.alert("Error", "Failed to open image picker.");
    }
  }

  async function uploadSignature(uri: string) {
    setUploadingSig(true);
    try {
      const url = await uploadImage(uri);
      setSigUri(url);
      await apiFetch(`/api/engineer/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify({ signature_url: url }),
      });
    } catch {
      Alert.alert("Error", "Failed to upload signature.");
    } finally {
      setUploadingSig(false);
    }
  }

  async function handleDrawSave(pathsJson: string) {
    setShowSigCanvas(false);
    const sigValue = "__drawing__:" + pathsJson;
    setSigUri(sigValue);
    await apiFetch(`/api/engineer/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ signature_url: sigValue }),
    }).catch(() => {});
  }

  // ─── Mark as Done ─────────────────────────────────────────────────────────
  async function handleMarkDone() {
    const unanswered = SURVEY_FIELDS.filter((f) => !ratings[f.key]);
    if (unanswered.length > 0) {
      Alert.alert(
        "Survey Incomplete",
        `Please rate all fields before marking as done.\n\nMissing: ${unanswered
          .map((f) => f.label)
          .join(", ")}`
      );
      return;
    }

    Alert.alert(
      "Mark as Done",
      "Are you sure you want to mark this job as completed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Done",
          onPress: async () => {
            setMarkingDone(true);
            try {
              const netState = await NetInfo.fetch();
              const answers = Object.entries(ratings).map(
                ([field_key, field_value]) => ({ field_key, field_value })
              );

              if (!netState.isConnected) {
                await enqueueOfflineDone({ jobId, answers, signature_url: sigUri });
                setIsQueued(true);
                Alert.alert(
                  "Saved Offline",
                  "No internet connection. Your survey has been saved and will sync automatically when you're back online.",
                  [{ text: "OK" }]
                );
                return;
              }

              await apiFetch(`/api/engineer/jobs/${jobId}/done`, {
                method: "PATCH",
                body: JSON.stringify({ answers }),
              });
              await AsyncStorage.removeItem(draftKey(jobId));
              setIsQueued(false);
              await fetchJob();
              locationSub.current?.remove();
              socketRef.current?.disconnect();
            } catch {
              Alert.alert("Error", "Failed to update status.");
            } finally {
              setMarkingDone(false);
            }
          },
        },
      ]
    );
  }

  // ─── Formatters ───────────────────────────────────────────────────────────
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

  // ─── Signature renderer ───────────────────────────────────────────────────
  function renderSignature() {
    if (uploadingSig)
      return (
        <View style={styles.sigPlaceholder}>
          <ActivityIndicator color="#18B4E8" />
          <Text style={styles.sigHint}>Uploading…</Text>
        </View>
      );

    if (!sigUri)
      return (
        <View style={styles.sigEmpty}>
          <MaterialCommunityIcons name="draw-pen" size={28} color="#9ca3af" />
          <Text style={styles.sigHint}>No signature yet</Text>
        </View>
      );

    if (sigUri.startsWith("__drawing__:")) {
      try {
        const paths: Point[][] = JSON.parse(sigUri.replace("__drawing__:", ""));
        const canvasSize = SCREEN_W - 80;
        const toD = (pts: Point[]) =>
          pts
            .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
            .join(" ");
        return (
          <View style={[styles.sigPreview, { height: 160 }]}>
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

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading || !job)
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#18B4E8" size="large" />
      </View>
    );

  const jobStatus = job.status ?? "ongoing";

  const duration =
    job.date_from && job.date_to
      ? Math.round(
          (new Date(job.date_to).getTime() -
            new Date(job.date_from).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : null;

  const mapCoord =
    liveCoord ??
    (job.latitude && job.longitude
      ? { latitude: Number(job.latitude), longitude: Number(job.longitude) }
      : null);

  const canMarkDone = jobStatus === "ongoing";
  const isVerified = jobStatus === "verified";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <Stack.Screen
        options={{
          title: job.title ?? "Job Detail",
          headerBackTitle: "",
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#000",
          headerShadowVisible: true,
        }}
      />

      {showSigCanvas && (
        <SignatureCanvas
          onSave={handleDrawSave}
          onClose={() => setShowSigCanvas(false)}
        />
      )}

      <View style={styles.container}>
        {/* Offline queued banner */}
        {isQueued && (
          <View style={styles.offlineBanner}>
            <MaterialCommunityIcons name="wifi-off" size={16} color="#92400e" />
            <Text style={styles.offlineBannerText}>
              Saved offline — will sync when connected
            </Text>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "job" && styles.tabBtnActive]}
            onPress={() => setActiveTab("job")}
          >
            <MaterialCommunityIcons
              name="map-marker-radius-outline"
              size={16}
              color={activeTab === "job" ? "#18B4E8" : "#9ca3af"}
            />
            <Text
              style={[styles.tabText, activeTab === "job" && styles.tabTextActive]}
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
              color={activeTab === "form" ? "#18B4E8" : "#9ca3af"}
            />
            <Text
              style={[styles.tabText, activeTab === "form" && styles.tabTextActive]}
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
                  { backgroundColor: (STATUS_COLORS[jobStatus] ?? "#ccc") + "22" },
                ]}
              >
                {jobStatus === "ongoing" && (
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLORS[jobStatus] ?? "#ccc" },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.statusText,
                    { color: STATUS_COLORS[jobStatus] ?? "#ccc" },
                  ]}
                >
                  {jobStatus.charAt(0).toUpperCase() + jobStatus.slice(1)}
                </Text>
              </View>
              <Text style={styles.updateTime}>
                Updated {formatDateTime(job.updated_at)}
              </Text>
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
                    style={[styles.timeVal, !job.ended_at && { color: "#d1d5db" }]}
                  >
                    {formatDateTime(job.ended_at)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Map */}
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="map-marker" size={16} color="#18B4E8" />
              <Text style={styles.sectionTitle}>Live Location</Text>
              {jobStatus === "ongoing" && (
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
                showsUserLocation={jobStatus === "ongoing"}
              >
                <Marker coordinate={mapCoord} title="Current Location" />
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

            {/* Survey + Signature */}
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="clipboard-edit-outline"
                size={16}
                color="#18B4E8"
              />
              <Text style={styles.sectionTitle}>Survey & Signature</Text>
              {!isVerified && (
                <View style={styles.requiredPill}>
                  <Text style={styles.requiredText}>Required</Text>
                </View>
              )}
            </View>

            <View style={styles.surveyCard}>
              <Text style={styles.surveyHeading}>Performance Rating</Text>
              <Text style={styles.surveySubtitle}>
                Rate each category before marking as done
              </Text>
              <View style={{ gap: 16, marginTop: 14 }}>
                {SURVEY_FIELDS.map((field) => (
                  <View key={field.key}>
                    <View style={styles.surveyRow}>
                      <Text style={styles.surveyLabel}>{field.label}</Text>
                      {(ratings[field.key] ?? 0) > 0 && (
                        <Text style={styles.ratingText}>
                          {ratings[field.key]}/5
                        </Text>
                      )}
                    </View>
                    <StarRating
                      value={ratings[field.key] ?? 0}
                      onChange={(v) =>
                        setRatings((prev) => ({ ...prev, [field.key]: v }))
                      }
                      disabled={isVerified || isQueued}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.surveySeparator} />

              <Text style={styles.surveyHeading}>Client Signature</Text>
              <Text style={styles.surveySubtitle}>
                Optional — get client to sign off
              </Text>
              <View style={[styles.sigContainer, { marginTop: 10 }]}>
                {renderSignature()}
              </View>

              {!isVerified && !isQueued && (
                <View style={[styles.sigActions, { marginTop: 10 }]}>
                  <TouchableOpacity
                    style={styles.sigBtn}
                    onPress={() => setShowSigCanvas(true)}
                  >
                    <MaterialCommunityIcons name="draw" size={16} color="#18B4E8" />
                    <Text style={styles.sigBtnText}>Draw</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sigBtn}
                    onPress={() => pickSignatureImage("gallery")}
                  >
                    <MaterialCommunityIcons
                      name="image-outline"
                      size={16}
                      color="#18B4E8"
                    />
                    <Text style={styles.sigBtnText}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sigBtn}
                    onPress={() => pickSignatureImage("camera")}
                  >
                    <MaterialCommunityIcons
                      name="camera-outline"
                      size={16}
                      color="#18B4E8"
                    />
                    <Text style={styles.sigBtnText}>Camera</Text>
                  </TouchableOpacity>
                  {sigUri && (
                    <TouchableOpacity
                      style={[styles.sigBtn, styles.sigBtnDanger]}
                      onPress={() => {
                        setSigUri(null);
                        apiFetch(`/api/engineer/jobs/${jobId}`, {
                          method: "PATCH",
                          body: JSON.stringify({ signature_url: null }),
                        }).catch(() => {});
                      }}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={16}
                        color="#ef4444"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Mark as Done */}
            {canMarkDone && !isQueued && (
              <TouchableOpacity
                style={[styles.doneBtn, markingDone && styles.doneBtnDisabled]}
                onPress={handleMarkDone}
                disabled={markingDone}
              >
                {markingDone ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="check-circle-outline"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.doneBtnText}>Mark as Done</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {jobStatus === "completed" && (
              <View style={styles.completedBanner}>
                <MaterialCommunityIcons
                  name="clock-check-outline"
                  size={18}
                  color="#6b7280"
                />
                <Text style={styles.completedText}>
                  Awaiting supervisor verification
                </Text>
              </View>
            )}

            {isVerified && (
              <View style={styles.verifiedBanner}>
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={18}
                  color="#a855f7"
                />
                <Text style={styles.verifiedText}>Verified by supervisor</Text>
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
              <Text style={styles.formTitle}>{job.title}</Text>
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
              <InfoRow label="Date From" value={formatDate(job.date_from)} />
              <InfoRow label="Date To" value={formatDate(job.date_to)} />
              <InfoRow
                label="Duration"
                value={
                  duration ? `${duration} day${duration !== 1 ? "s" : ""}` : "—"
                }
              />
              {!!job.comment && <InfoRow label="Comment" value={job.comment!} />}
            </View>

            {job.attachments && job.attachments.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="paperclip"
                    size={16}
                    color="#18B4E8"
                  />
                  <Text style={styles.sectionTitle}>Attachments</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.attachRow}
                >
                  {job.attachments.map((a) => (
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
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9ff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 16, gap: 12 },

  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  offlineBannerText: {
    fontSize: 13,
    color: "#92400e",
    fontWeight: "500",
    flex: 1,
  },

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
  tabBtnActive: { borderBottomColor: "#18B4E8" },
  tabText: { fontSize: 14, fontWeight: "500", color: "#9ca3af" },
  tabTextActive: { color: "#18B4E8" },

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
  requiredPill: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  requiredText: { fontSize: 11, color: "#d97706", fontWeight: "600" },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dcfce7",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
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

  surveyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  surveyHeading: { fontSize: 14, fontWeight: "700", color: "#111827" },
  surveySubtitle: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  surveyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  surveyLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  ratingText: { fontSize: 12, color: "#f59e0b", fontWeight: "700" },
  surveySeparator: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 16,
  },

  sigContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  sigPlaceholder: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
  sigActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  sigBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#18B4E8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sigBtnDanger: { borderColor: "#ef4444" },
  sigBtnText: { fontSize: 13, color: "#18B4E8", fontWeight: "500" },

  doneBtn: {
    backgroundColor: "#18B4E8",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    marginTop: 8,
  },
  doneBtnDisabled: { opacity: 0.6 },
  doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  completedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  completedText: { fontSize: 13, color: "#6b7280" },
  verifiedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#faf5ff",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  verifiedText: { fontSize: 13, color: "#a855f7", fontWeight: "600" },

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

const sigStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  canvas: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignSelf: "center",
  },
  hint: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  row: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  clearText: { fontSize: 14, color: "#6b7280" },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cancelText: { fontSize: 14, color: "#6b7280" },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#18B4E8",
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});