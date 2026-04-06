import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "../../../lib/api";
import { uploadImage } from "../../../lib/uploadImage";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormStatus = "pending" | "accepted" | "rejected" | "ongoing" | "completed";
type PriorityLevel = "low" | "medium" | "high";

interface Attachment {
  id: number;
  type: string;
  file_url: string;
}

interface FormDetail {
  id: number;
  title: string;
  description: string;
  duration: number;
  date_from: string;
  date_to: string;
  status: FormStatus;
  priority_level: PriorityLevel;
  client_name: string;
  company_name: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  assigned_to: number;
  created_by_name?: string;
  assigned_to_name?: string;
  attachments?: Attachment[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<FormStatus, string> = {
  pending: "#EAB308",
  accepted: "#3B82F6",
  rejected: "#EF4444",
  ongoing: "#22C55E",
  completed: "#6B7280",
};

const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const BRAND = "#18B4E8";
const BG = "#f0f9ff";
const MAX_PHOTOS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function calcDays(from: string, to: string): string {
  if (!from || !to) return "—";
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  const days = diff + 1;
  return `${days} day${days !== 1 ? "s" : ""}`;
}

function calcDurationDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FormStatus }) {
  return (
    <View
      style={[styles.badge, { backgroundColor: STATUS_COLORS[status] + "22" }]}
    >
      {status === "ongoing" && (
        <View
          style={[styles.pulseDot, { backgroundColor: STATUS_COLORS[status] }]}
        />
      )}
      <Text style={[styles.badgeText, { color: STATUS_COLORS[status] }]}>
        {capitalize(status)}
      </Text>
    </View>
  );
}

function PriorityBadge({ level }: { level: PriorityLevel }) {
  return (
    <View
      style={[styles.badge, { backgroundColor: PRIORITY_COLORS[level] + "22" }]}
    >
      <Text style={[styles.badgeText, { color: PRIORITY_COLORS[level] }]}>
        {capitalize(level)} Priority
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      {title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

// ─── Photo Section (read-only) ────────────────────────────────────────────────

function PhotosSection({ attachments }: { attachments: Attachment[] }) {
  const photos = attachments.filter((a) => a.type === "form_doc");
  if (photos.length === 0) return null;
  return (
    <SectionCard title="Photos">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 4, paddingRight: 4 }}
      >
        {photos.map((a) => (
          <Image
            key={a.id}
            source={{ uri: a.file_url }}
            style={styles.photoThumb}
          />
        ))}
      </ScrollView>
    </SectionCard>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  form: FormDetail;
  onSuccess: () => void;
  onCancel: () => void;
}

function EditForm({ form, onSuccess, onCancel }: EditFormProps) {
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description);
  const [clientName, setClientName] = useState(form.client_name);
  const [companyName, setCompanyName] = useState(form.company_name);
  const [dateFrom, setDateFrom] = useState(form.date_from?.slice(0, 10) ?? "");
  const [dateTo, setDateTo] = useState(form.date_to?.slice(0, 10) ?? "");
  const [priority, setPriority] = useState<PriorityLevel>(form.priority_level);
  const [submitting, setSubmitting] = useState(false);

  // ── Photo state ──
  // Existing attachments from DB
  const [existingPhotos, setExistingPhotos] = useState<Attachment[]>(
    (form.attachments ?? []).filter((a) => a.type === "form_doc"),
  );
  // Newly uploaded URLs (not yet in DB)
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const totalPhotos = existingPhotos.length + newPhotoUrls.length;
  const priorities: PriorityLevel[] = ["low", "medium", "high"];
  const previewDays = dateFrom && dateTo ? calcDays(dateFrom, dateTo) : "—";

  async function pickFromGallery() {
    if (totalPhotos >= MAX_PHOTOS) {
      Alert.alert("Limit reached", `Max ${MAX_PHOTOS} photos allowed.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to upload images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: MAX_PHOTOS - totalPhotos,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        result.assets.map((a) => uploadImage(a.uri)),
      );
      setNewPhotoUrls((prev) => [...prev, ...uploaded]);
    } catch {
      Alert.alert("Upload failed", "Could not upload one or more photos.");
    } finally {
      setUploading(false);
    }
  }

  async function takePhoto() {
    if (totalPhotos >= MAX_PHOTOS) {
      Alert.alert("Limit reached", `Max ${MAX_PHOTOS} photos allowed.`);
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"] as any,
      quality: 0.7,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const url = await uploadImage(result.assets[0].uri);
      setNewPhotoUrls((prev) => [...prev, url]);
    } catch {
      Alert.alert("Upload failed", "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  }

  function removeExisting(attachment: Attachment) {
    Alert.alert("Remove photo", "Remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/api/engineer/attachments/${attachment.id}`, {
              method: "DELETE",
            });
            setExistingPhotos((prev) =>
              prev.filter((a) => a.id !== attachment.id),
            );
          } catch {
            Alert.alert("Error", "Could not remove photo.");
          }
        },
      },
    ]);
  }

  function removeNew(index: number) {
    Alert.alert("Remove photo", "Remove this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          setNewPhotoUrls((prev) => prev.filter((_, i) => i !== index)),
      },
    ]);
  }

  async function handleSave() {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Validation", "Title and description are required.");
      return;
    }
    if (!dateFrom || !dateTo) {
      Alert.alert("Validation", "Both dates are required.");
      return;
    }
    if (new Date(dateTo) < new Date(dateFrom)) {
      Alert.alert("Validation", "Date To must be on or after Date From.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/engineer/forms/${form.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          client_name: clientName.trim(),
          company_name: companyName.trim(),
          date_from: dateFrom,
          date_to: dateTo,
          duration: calcDurationDays(dateFrom, dateTo),
          priority_level: priority,
        }),
      });

      // Save any newly uploaded photos
      if (newPhotoUrls.length > 0) {
        await apiFetch("/api/engineer/attachments", {
          method: "POST",
          body: JSON.stringify({
            form_id: form.id,
            urls: newPhotoUrls,
            type: "form_doc",
          }),
        });
      }

      Alert.alert("Saved", "Your form has been updated.");
      onSuccess();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to save form.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <View style={styles.editHeader}>
        <Text style={styles.editTitle}>Edit Form</Text>
        <Text style={styles.editSubtitle}>
          Update the details below. Changes will be reviewed by your supervisor.
        </Text>
      </View>

      <SectionCard title="Job Details">
        <Text style={styles.fieldLabel}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Form title"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.fieldLabel}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the job"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </SectionCard>

      <SectionCard title="Client Info">
        <Text style={styles.fieldLabel}>Client Name</Text>
        <TextInput
          style={styles.input}
          value={clientName}
          onChangeText={setClientName}
          placeholder="Client name"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.fieldLabel}>Company Name</Text>
        <TextInput
          style={styles.input}
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="Company name"
          placeholderTextColor="#9ca3af"
        />
      </SectionCard>

      <SectionCard title="Schedule & Priority">
        <Text style={styles.fieldLabel}>Date From (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={dateFrom}
          onChangeText={setDateFrom}
          placeholder="2025-01-01"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.fieldLabel}>Date To (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={dateTo}
          onChangeText={setDateTo}
          placeholder="2025-01-07"
          placeholderTextColor="#9ca3af"
        />
        {dateFrom && dateTo && (
          <View style={styles.durationPreview}>
            <Text style={styles.durationPreviewLabel}>Duration</Text>
            <Text style={styles.durationPreviewValue}>{previewDays}</Text>
          </View>
        )}
        <Text style={styles.fieldLabel}>Priority</Text>
        <View style={styles.priorityRow}>
          {priorities.map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.priorityChip,
                priority === p && {
                  backgroundColor: PRIORITY_COLORS[p],
                  borderColor: PRIORITY_COLORS[p],
                },
              ]}
              onPress={() => setPriority(p)}
            >
              <Text
                style={[
                  styles.priorityChipText,
                  priority === p && { color: "#fff" },
                ]}
              >
                {capitalize(p)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SectionCard>

      {/* ── Photos ── */}
      <SectionCard title={`Photos (${totalPhotos}/${MAX_PHOTOS})`}>
        {/* Existing photos */}
        {existingPhotos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 10, paddingRight: 10 }}
            style={{ marginBottom: 10 }}
          >
            {existingPhotos.map((a) => (
              <View key={a.id} style={styles.thumbWrapper}>
                <Image source={{ uri: a.file_url }} style={styles.thumb} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeExisting(a)}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={22}
                    color="#ef4444"
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* New photos */}
        {newPhotoUrls.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 10, paddingRight: 10 }}
            style={{ marginBottom: 10 }}
          >
            {newPhotoUrls.map((url, i) => (
              <View key={i} style={styles.thumbWrapper}>
                <Image source={{ uri: url }} style={styles.thumb} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeNew(i)}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={22}
                    color="#ef4444"
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Upload buttons */}
        {uploading ? (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color={BRAND} />
            <Text style={styles.uploadingText}>Uploading photo...</Text>
          </View>
        ) : (
          <View style={styles.photoButtonRow}>
            <TouchableOpacity
              style={[
                styles.photoBtn,
                totalPhotos >= MAX_PHOTOS && styles.photoBtnDisabled,
              ]}
              onPress={pickFromGallery}
              disabled={totalPhotos >= MAX_PHOTOS}
            >
              <MaterialCommunityIcons
                name="image-multiple-outline"
                size={18}
                color={totalPhotos >= MAX_PHOTOS ? "#cbd5e1" : BRAND}
              />
              <Text
                style={[
                  styles.photoBtnText,
                  totalPhotos >= MAX_PHOTOS && styles.photoBtnTextDisabled,
                ]}
              >
                Gallery
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.photoBtn,
                totalPhotos >= MAX_PHOTOS && styles.photoBtnDisabled,
              ]}
              onPress={takePhoto}
              disabled={totalPhotos >= MAX_PHOTOS}
            >
              <MaterialCommunityIcons
                name="camera-outline"
                size={18}
                color={totalPhotos >= MAX_PHOTOS ? "#cbd5e1" : BRAND}
              />
              <Text
                style={[
                  styles.photoBtnText,
                  totalPhotos >= MAX_PHOTOS && styles.photoBtnTextDisabled,
                ]}
              >
                Camera
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SectionCard>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={onCancel}
          disabled={submitting}
        >
          <Text style={styles.btnSecondaryText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnPrimary,
            (submitting || uploading) && styles.btnDisabled,
          ]}
          onPress={handleSave}
          disabled={submitting || uploading}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnPrimaryText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EngineerFormDetail() {
  const { id, source } = useLocalSearchParams<{
    id: string;
    source?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();

  const [form, setForm] = useState<FormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const fetchForm = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/engineer/forms/${id}`);
      console.log("attachments:", JSON.stringify(data.attachments)); // ← add this
      setForm(data);
      navigation.setOptions({ title: data.title });
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not load form.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, navigation]);

  useEffect(() => {
    fetchForm();
  }, [fetchForm]);

  function onRefresh() {
    setRefreshing(true);
    fetchForm();
  }

  async function handleAccept() {
    Alert.alert("Accept Form", "Accept this job assignment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Accept",
        onPress: async () => {
          setActionLoading(true);
          try {
            await apiFetch(`/api/engineer/forms/${id}/accept`, {
              method: "PATCH",
            });
            Alert.alert("Accepted", "You have accepted this job.", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch (e: any) {
            Alert.alert("Error", e.message ?? "Failed to accept.");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }

  async function handleReject() {
    Alert.alert("Reject Form", "Reject this job assignment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          setActionLoading(true);
          try {
            await apiFetch(`/api/engineer/forms/${id}/reject`, {
              method: "PATCH",
            });
            Alert.alert("Rejected", "You have rejected this assignment.", [
              { text: "OK", onPress: () => router.back() },
            ]);
          } catch (e: any) {
            Alert.alert("Error", e.message ?? "Failed to reject.");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }

  async function handleDelete() {
    Alert.alert(
      "Delete Form",
      "This will permanently delete this form request. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await apiFetch(`/api/engineer/forms/${id}`, { method: "DELETE" });
              Alert.alert("Deleted", "Your form request has been deleted.", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (e: any) {
              Alert.alert("Error", e.message ?? "Failed to delete.");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  if (!form) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Form not found.</Text>
      </View>
    );
  }

  const isMine = source === "mine";
  const isAssigned = source === "assigned";
  const canAcceptReject = isAssigned && form.status === "pending";
  const canEdit = isMine && form.status === "pending";
  const canDelete = isMine && form.status === "pending";

  // ── Editing Mode ──
  if (editing && canEdit) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <EditForm
          form={form}
          onSuccess={() => {
            setEditing(false);
            fetchForm();
          }}
          onCancel={() => setEditing(false)}
        />
      </ScrollView>
    );
  }

  // ── Detail View ──
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={BRAND}
        />
      }
    >
      {/* Hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <StatusBadge status={form.status} />
          <PriorityBadge level={form.priority_level} />
        </View>
        <Text style={styles.heroTitle}>{form.title}</Text>
        {form.description ? (
          <Text style={styles.heroDesc}>{form.description}</Text>
        ) : null}
      </View>

      {/* Supervisor Comment */}
      {form.comment ? (
        <SectionCard title="Supervisor Comment">
          <Text style={styles.commentText}>{form.comment}</Text>
        </SectionCard>
      ) : null}

      {/* Job Info */}
      <SectionCard title="Job Information">
        <InfoRow label="Client" value={form.client_name || "—"} />
        <InfoRow label="Company" value={form.company_name || "—"} />
        <InfoRow
          label="Duration"
          value={calcDays(form.date_from, form.date_to)}
        />
        <InfoRow label="Date From" value={formatDate(form.date_from)} />
        <InfoRow label="Date To" value={formatDate(form.date_to)} />
      </SectionCard>

      {/* Assignment */}
      <SectionCard title="Assignment">
        {form.created_by_name ? (
          <InfoRow label="Assigned by" value={form.created_by_name} />
        ) : null}
        {form.assigned_to_name ? (
          <InfoRow label="Supervisor" value={form.assigned_to_name} />
        ) : null}
        <InfoRow label="Submitted" value={formatDate(form.created_at)} />
        <InfoRow label="Last Updated" value={formatDate(form.updated_at)} />
      </SectionCard>

      {/* Photos — read-only */}
      {form.attachments && form.attachments.length > 0 && (
        <PhotosSection attachments={form.attachments} />
      )}

      {/* Assigned Actions */}
      {canAcceptReject && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnDanger,
              actionLoading && styles.btnDisabled,
            ]}
            onPress={handleReject}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Reject</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnPrimary,
              actionLoading && styles.btnDisabled,
            ]}
            onPress={handleAccept}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Mine Actions */}
      {(canEdit || canDelete) && (
        <View style={styles.actionRow}>
          {canDelete && (
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnDanger,
                actionLoading && styles.btnDisabled,
              ]}
              onPress={handleDelete}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Delete</Text>
              )}
            </TouchableOpacity>
          )}
          {canEdit && (
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.btnPrimaryText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BG,
  },
  emptyText: { color: "#6b7280", fontSize: 15 },

  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  heroDesc: { fontSize: 14, color: "#6b7280", lineHeight: 20 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  badgeText: { fontSize: 12, fontWeight: "600" },
  pulseDot: { width: 7, height: 7, borderRadius: 4 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  infoLabel: { fontSize: 14, color: "#6b7280", flex: 1 },
  infoValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },

  commentText: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    fontStyle: "italic",
  },

  // Photos
  photoThumb: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
  thumbWrapper: { marginRight: 12, position: "relative", marginTop: 8 },
  thumb: { width: 80, height: 80, borderRadius: 8 },
  removeBtn: { position: "absolute", top: -10, right: -10 },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
  },
  uploadingText: { fontSize: 13, color: "#64748b" },
  photoButtonRow: { flexDirection: "row", gap: 10 },
  photoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    paddingVertical: 11,
  },
  photoBtnDisabled: { borderColor: "#f1f5f9", backgroundColor: "#f8fafc" },
  photoBtnText: { fontSize: 13, fontWeight: "600", color: BRAND },
  photoBtnTextDisabled: { color: "#cbd5e1" },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 8 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: BRAND },
  btnSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
  },
  btnDanger: { backgroundColor: "#EF4444" },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnSecondaryText: { color: "#374151", fontWeight: "600", fontSize: 15 },

  editHeader: { marginBottom: 16 },
  editTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  editSubtitle: { fontSize: 13, color: "#6b7280", lineHeight: 18 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#111827",
  },
  textArea: { height: 100, paddingTop: 12 },
  durationPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  durationPreviewLabel: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  durationPreviewValue: { fontSize: 13, color: BRAND, fontWeight: "700" },
  priorityRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  priorityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  priorityChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
});
