import { useState } from "react";
import { View, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import {
  Text,
  FAB,
  Portal,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
  Dialog,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { apiFetch } from "../../../lib/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { RefreshControl } from "react-native";
type Team = { id: number; name: string; member_count: number };

export default function TeamsScreen() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

 const [refreshing, setRefreshing] = useState(false);

const fetchTeams = async (isRefresh = false) => {
  if (isRefresh) setRefreshing(true);
  else setLoading(true);
  try {
    const data = await apiFetch("/api/admin/teams");
    setTeams(data);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
};
  useFocusEffect(
    useCallback(() => {
      fetchTeams();
    }, []),
  );
  const openCreate = () => {
    setEditTarget(null);
    setTeamName("");
    setModalVisible(true);
  };

  const openEdit = (team: Team) => {
    setEditTarget(team);
    setTeamName(team.name);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!teamName.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await apiFetch(`/api/admin/teams/${editTarget.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: teamName }),
        });
      } else {
        await apiFetch("/api/admin/teams", {
          method: "POST",
          body: JSON.stringify({ name: teamName }),
        });
      }
      setModalVisible(false);
      fetchTeams();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/teams/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      fetchTeams();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#18B4E8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Teams</Text>

      <FlatList
        data={teams}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => fetchTeams(true)}
      colors={["#18B4E8"]}
      tintColor="#18B4E8"
    />
  }
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(admin)/teams/${item.id}`)}
            onLongPress={() => openEdit(item)}
          >
            <MaterialCommunityIcons
              name="account-group"
              size={32}
              color="#18B4E8"
            />
            <Text style={styles.teamName}>{item.name}</Text>
            <Text style={styles.memberCount}>{item.member_count} members</Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => setDeleteTarget(item)}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={18}
                color="#e53935"
              />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {/* Create / Edit Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>
            {editTarget ? "Edit Team" : "New Team"}
          </Text>
          <TextInput
            label="Team Name"
            value={teamName}
            onChangeText={setTeamName}
            mode="outlined"
            activeOutlineColor="#18B4E8"
            style={styles.input}
          />
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            buttonColor="#18B4E8"
            style={styles.saveBtn}
          >
            {editTarget ? "Save Changes" : "Create Team"}
          </Button>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <Dialog
          visible={!!deleteTarget}
          onDismiss={() => setDeleteTarget(null)}
          style={styles.dialog}
        >
          <Dialog.Icon icon="alert-circle-outline" color="#e53935" size={32} />
          <Dialog.Title style={styles.dialogTitle}>Delete Team</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogBody}>
              Are you sure you want to delete{" "}
              <Text style={styles.dialogTeamName}>{deleteTarget?.name}</Text>?
              This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setDeleteTarget(null)}
              textColor="#64748b"
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onPress={confirmDelete}
              textColor="#e53935"
              loading={deleting}
              disabled={deleting}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FAB icon="plus" style={styles.fab} color="#fff" onPress={openCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9ff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    padding: 20,
    paddingBottom: 8,
  },
  list: { padding: 12 },
  row: { justifyContent: "space-between", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "48%",
    alignItems: "center",
    gap: 6,
    elevation: 2,
    position: "relative",
  },
  teamName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },
  memberCount: { fontSize: 12, color: "#64748b" },
  deleteBtn: { position: "absolute", top: 10, right: 10 },
  modal: { backgroundColor: "#fff", margin: 24, borderRadius: 16, padding: 24 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: "#0f172a",
  },
  input: { marginBottom: 16, backgroundColor: "#fff" },
  saveBtn: { borderRadius: 8 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: "#18B4E8",
  },
  dialog: { backgroundColor: "#fff", borderRadius: 16 },
  dialogTitle: { textAlign: "center", color: "#0f172a", fontWeight: "700" },
  dialogBody: { fontSize: 14, color: "#475569", textAlign: "center" },
  dialogTeamName: { fontWeight: "700", color: "#0f172a" },
});
