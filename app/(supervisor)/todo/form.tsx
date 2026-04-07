import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { TextInput, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiFetch } from "@/lib/api";
import * as ImagePicker from "expo-image-picker";
import { Image } from "react-native";
import { uploadImage } from "@/lib/uploadImage";
const BRAND = "#18B4E8";

const PRIORITY_ACTIVE_COLOR: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

type Member = { id: number; name: string; status: string };

export default function CreateFormScreen() {
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [showDateFrom, setShowDateFrom] = useState(false);
  const [showDateTo, setShowDateTo] = useState(false);
  const [comment, setComment] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("low");
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
const [photoUrls, setPhotoUrls] = useState<string[]>([]);
const [uploading, setUploading] = useState(false);
const MAX_PHOTOS = 5;
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await apiFetch("/api/supervisor/members");
        setMembers(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchMembers();
  }, []);

  const statusColor = (status: string) => {
    if (status === "online") return "#22c55e";
    if (status === "inactive") return "#f59e0b";
    return "#94a3b8";
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  };

  const displayDate = (date: Date | null) => {
    if (!date) return "Select date";
    return date.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
const handleSubmit = async () => {
  if (!title || !clientName || !companyName || !dateFrom || !dateTo || !assignedTo) {
    Alert.alert("Missing Fields", "Please fill in all required fields and assign a member.");
    return;
  }
  setSaving(true);
  try {
    const res = await apiFetch("/api/supervisor/forms", {
      method: "POST",
      body: JSON.stringify({
        title,
        description,
        client_name: clientName,
        company_name: companyName,
        date_from: formatDate(dateFrom),
        date_to: formatDate(dateTo),
        comment,
        priority_level: priority,
        assigned_to: assignedTo,
      }),
    });

    console.log("1. form res:", JSON.stringify(res));
    console.log("2. photoUrls:", JSON.stringify(photoUrls));
    console.log("3. res?.id:", res?.id);

    if (photoUrls.length > 0 && res?.id) {
      console.log("4. saving attachments...");
      const attachRes = await apiFetch("/api/supervisor/attachments", {  // ← change this
  method: "POST",
  body: JSON.stringify({
    form_id: res.id,
    urls: photoUrls,
    type: "form_doc",
  }),
});
      console.log("5. attachRes:", JSON.stringify(attachRes));
    } else {
      console.log("4. SKIPPED - photoUrls.length:", photoUrls.length, "res?.id:", res?.id);
    }

    router.back();
  } catch (e) {
    console.error("submit error:", e);
    Alert.alert("Error", "Failed to create form.");
  } finally {
    setSaving(false);
  }
};
async function pickFromGallery() {
  if (photoUrls.length >= MAX_PHOTOS) {
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
    selectionLimit: MAX_PHOTOS - photoUrls.length,
  });
  if (result.canceled) return;
  setUploading(true);
  try {
    const uploaded = await Promise.all(
      result.assets.map((a) => uploadImage(a.uri))
    );
    setPhotoUrls((prev) => [...prev, ...uploaded]);
  } catch {
    Alert.alert("Upload failed", "Could not upload one or more photos.");
  } finally {
    setUploading(false);
  }
}

async function takePhoto() {
  if (photoUrls.length >= MAX_PHOTOS) {
    Alert.alert("Limit reached", `Max ${MAX_PHOTOS} photos allowed.`);
    return;
  }
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission needed", "Allow camera access to take photos.");
    return;
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
  if (result.canceled) return;
  setUploading(true);
  try {
    const url = await uploadImage(result.assets[0].uri);
    setPhotoUrls((prev) => [...prev, url]);
  } catch {
    Alert.alert("Upload failed", "Could not upload photo.");
  } finally {
    setUploading(false);
  }
}

function removePhoto(index: number) {
  Alert.alert("Remove photo", "Remove this photo?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Remove",
      style: "destructive",
      onPress: () => setPhotoUrls((prev) => prev.filter((_, i) => i !== index)),
    },
  ]);
}
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Priority */}
        <Text style={styles.label}>Priority</Text>
        <View style={styles.toggleRow}>
          {(["low", "medium", "high"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.toggleBtn,
                priority === p && {
                  backgroundColor: PRIORITY_ACTIVE_COLOR[p] + "18",
                  borderColor: PRIORITY_ACTIVE_COLOR[p],
                },
              ]}
              onPress={() => setPriority(p)}
            >
              <Text
                style={[
                  styles.toggleText,
                  priority === p && styles.toggleTextActive,
                ]}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <Text style={styles.label}>
          Title <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          mode="outlined"
          activeOutlineColor={BRAND}
          style={styles.input}
          placeholder="Job title"
        />

        {/* Client Name */}
        <Text style={styles.label}>
          Client Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          value={clientName}
          onChangeText={setClientName}
          mode="outlined"
          activeOutlineColor={BRAND}
          style={styles.input}
          placeholder="Client name"
        />

        {/* Company Name */}
        <Text style={styles.label}>
          Company Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          value={companyName}
          onChangeText={setCompanyName}
          mode="outlined"
          activeOutlineColor={BRAND}
          style={styles.input}
          placeholder="Company name"
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          activeOutlineColor={BRAND}
          style={styles.input}
          placeholder="Optional description"
          multiline
          numberOfLines={3}
        />

        {/* Date From */}
        <Text style={styles.label}>
          Date From <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowDateFrom(true)}
        >
          <MaterialCommunityIcons
            name="calendar-outline"
            size={18}
            color={dateFrom ? "#0f172a" : "#94a3b8"}
          />
          <Text
            style={[styles.dateBtnText, !dateFrom && styles.dateBtnPlaceholder]}
          >
            {displayDate(dateFrom)}
          </Text>
        </TouchableOpacity>
        {showDateFrom && (
          <DateTimePicker
            value={dateFrom ?? new Date()}
            mode="date"
            display="default"
            onChange={(_, selected) => {
              setShowDateFrom(false);
              if (selected) setDateFrom(selected);
            }}
          />
        )}

        {/* Date To */}
        <Text style={styles.label}>
          Date To <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowDateTo(true)}
        >
          <MaterialCommunityIcons
            name="calendar-outline"
            size={18}
            color={dateTo ? "#0f172a" : "#94a3b8"}
          />
          <Text
            style={[styles.dateBtnText, !dateTo && styles.dateBtnPlaceholder]}
          >
            {displayDate(dateTo)}
          </Text>
        </TouchableOpacity>
        {showDateTo && (
          <DateTimePicker
            value={dateTo ?? new Date()}
            mode="date"
            display="default"
            onChange={(_, selected) => {
              setShowDateTo(false);
              if (selected) setDateTo(selected);
            }}
          />
        )}

        {/* Comment */}
        <Text style={styles.label}>Comment</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          mode="outlined"
          activeOutlineColor={BRAND}
          style={styles.input}
          placeholder="Optional note"
          multiline
          numberOfLines={2}
        />

        {/* Assign to member */}
        <Text style={styles.label}>
          Assign To <Text style={styles.required}>*</Text>
        </Text>
        {loadingMembers ? (
          <ActivityIndicator color={BRAND} style={{ marginVertical: 12 }} />
        ) : members.length === 0 ? (
          <Text style={styles.emptyText}>No members in your team</Text>
        ) : (
          members.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.memberCard,
                assignedTo === m.id && styles.memberCardActive,
              ]}
              onPress={() => setAssignedTo(m.id)}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusColor(m.status) },
                ]}
              />
              <Text
                style={[
                  styles.memberName,
                  assignedTo === m.id && { color: BRAND },
                ]}
              >
                {m.name}
              </Text>
              {assignedTo === m.id && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={18}
                  color={BRAND}
                />
              )}
            </TouchableOpacity>
          ))
        )}
{/* Photos */}
<Text style={[styles.label, { marginTop: 8 }]}>
  Photos{" "}
  <Text style={styles.photoCount}>({photoUrls.length}/{MAX_PHOTOS})</Text>
</Text>

{photoUrls.length > 0 && (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.thumbRow}
    contentContainerStyle={{ paddingTop: 10, paddingRight: 10 }}
  >
    {photoUrls.map((url, i) => (
      <View key={i} style={styles.thumbWrapper}>
        <Image source={{ uri: url }} style={styles.thumb} />
        <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
          <MaterialCommunityIcons name="close-circle" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>
    ))}
  </ScrollView>
)}

{uploading ? (
  <View style={styles.uploadingRow}>
    <ActivityIndicator size="small" color={BRAND} />
    <Text style={styles.uploadingText}>Uploading photo...</Text>
  </View>
) : (
  <View style={styles.photoButtonRow}>
    <TouchableOpacity
      style={[styles.photoBtn, photoUrls.length >= MAX_PHOTOS && styles.photoBtnDisabled]}
      onPress={pickFromGallery}
      disabled={photoUrls.length >= MAX_PHOTOS}
    >
      <MaterialCommunityIcons
        name="image-multiple-outline"
        size={18}
        color={photoUrls.length >= MAX_PHOTOS ? "#cbd5e1" : BRAND}
      />
      <Text style={[styles.photoBtnText, photoUrls.length >= MAX_PHOTOS && styles.photoBtnTextDisabled]}>
        Gallery
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.photoBtn, photoUrls.length >= MAX_PHOTOS && styles.photoBtnDisabled]}
      onPress={takePhoto}
      disabled={photoUrls.length >= MAX_PHOTOS}
    >
      <MaterialCommunityIcons
        name="camera-outline"
        size={18}
        color={photoUrls.length >= MAX_PHOTOS ? "#cbd5e1" : BRAND}
      />
      <Text style={[styles.photoBtnText, photoUrls.length >= MAX_PHOTOS && styles.photoBtnTextDisabled]}>
        Camera
      </Text>
    </TouchableOpacity>
  </View>
)}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.actionBar}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={saving}
        disabled={saving || uploading}
          buttonColor={BRAND}
          style={styles.submitBtn}
          contentStyle={{ paddingVertical: 4 }}
        >
          Create Form
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9ff" },
  scroll: { padding: 16 },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
    marginTop: 4,
  },
  required: { color: "#ef4444" },
  input: { backgroundColor: "#fff", marginBottom: 12 },

  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  toggleTextActive: { color: "#0f172a" },

  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 12,
  },
  dateBtnText: { fontSize: 14, color: "#0f172a", fontWeight: "500" },
  dateBtnPlaceholder: { color: "#94a3b8", fontWeight: "400" },

  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  memberCardActive: {
    borderColor: BRAND,
    backgroundColor: "#f0f9ff",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  memberName: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0f172a" },

  emptyText: { color: "#94a3b8", fontSize: 13, marginBottom: 12 },

  actionBar: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  submitBtn: { borderRadius: 10 },
  photoCount: { color: "#94a3b8", fontWeight: "400" },
thumbRow: { marginBottom: 10 },
thumbWrapper: { marginRight: 12, position: "relative", marginTop: 8 },
thumb: { width: 80, height: 80, borderRadius: 8 },
removeBtn: { position: "absolute", top: -10, right: -10 },
uploadingRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  paddingVertical: 12,
  backgroundColor: "#fff",
  borderRadius: 8,
  paddingHorizontal: 12,
  borderWidth: 1.5,
  borderColor: "#e2e8f0",
},
uploadingText: { fontSize: 13, color: "#64748b" },
photoButtonRow: { flexDirection: "row", gap: 10 },
photoBtn: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  backgroundColor: "#fff",
  borderRadius: 8,
  borderWidth: 1.5,
  borderColor: "#e2e8f0",
  paddingVertical: 11,
},
photoBtnDisabled: { borderColor: "#f1f5f9", backgroundColor: "#f8fafc" },
photoBtnText: { fontSize: 13, fontWeight: "600", color: BRAND },
photoBtnTextDisabled: { color: "#cbd5e1" },
});
