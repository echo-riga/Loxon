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
    if (
      !title ||
      !clientName ||
      !companyName ||
      !dateFrom ||
      !dateTo ||
      !assignedTo
    ) {
      Alert.alert(
        "Missing Fields",
        "Please fill in all required fields and assign a member.",
      );
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/supervisor/forms", {
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
      router.back();
    } catch (e) {
      Alert.alert("Error", "Failed to create form.");
    } finally {
      setSaving(false);
    }
  };

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

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.actionBar}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={saving}
          disabled={saving}
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
});
