import { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useNavigation } from "expo-router";
import {
  Text,
  ActivityIndicator,
  Portal,
  Modal,
  TextInput,
  Button,
  Dialog,
  FAB,
} from "react-native-paper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "../../../lib/api";

type User = { id: number; name: string; role: string; status: string };
type Team = { id: number; name: string };

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [team, setTeam] = useState<Team | null>(null);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    if (team) navigation.setOptions({ title: team.name });
  }, [team]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "engineer",
  });
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editUser, setEditUser] = useState({
    name: "",
    email: "",
    role: "engineer",
    status: "offline",
    password: "", // add this
  });
  const [editing, setEditing] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTeamDetail = async () => {
    try {
      const [teamData, usersData] = await Promise.all([
        apiFetch(`/api/admin/teams/${id}`),
        apiFetch(`/api/admin/users?team_id=${id}`),
      ]);
      setTeam(teamData ?? null);
      const users: User[] = usersData ?? [];
      setSupervisors(users.filter((u) => u.role === "supervisor"));
      setMembers(users.filter((u) => u.role === "engineer"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamDetail();
  }, [id]);

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) return;
    setSaving(true);
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ ...newUser, team_id: id }),
      });
      setAddModalVisible(false);
      setNewUser({ name: "", email: "", password: "", role: "engineer" });
      fetchTeamDetail();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };
  const openEdit = (user: User) => {
    setEditTarget(user);
    setEditUser({
      name: user.name,
      email: "",
      role: user.role,
      status: user.status,
      password: "", // add this
    });
  };

  const handleEditUser = async () => {
    if (!editTarget || !editUser.name) return;
    setEditing(true);
    try {
      await apiFetch(`/api/admin/users/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editUser.name,
          ...(editUser.email ? { email: editUser.email } : {}),
          ...(editUser.password ? { password: editUser.password } : {}), // add this
          role: editUser.role,
          status: editUser.status,
        }),
      });
      setEditTarget(null);
      fetchTeamDetail();
    } catch (err) {
      console.error(err);
    } finally {
      setEditing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      fetchTeamDetail();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === "online") return "#22c55e";
    if (status === "inactive") return "#f59e0b";
    return "#94a3b8";
  };

  const renderUser = (user: User) => (
    <TouchableOpacity
      key={user.id}
      style={styles.userCard}
      onPress={() => router.push(`/(admin)/teams/user/${user.id}`)}
      onLongPress={() => openEdit(user)}
    >
      <View style={styles.userLeft}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: statusColor(user.status) },
          ]}
        />
        <View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userRole}>
            {user.role === "engineer" ? "Engineer" : "Supervisor"}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => setDeleteTarget(user)}>
        <MaterialCommunityIcons
          name="trash-can-outline"
          size={18}
          color="#e53935"
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#18B4E8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Supervisors</Text>
        {supervisors.length === 0 ? (
          <Text style={styles.empty}>No supervisors in this team</Text>
        ) : (
          supervisors.map(renderUser)
        )}

        <Text style={styles.sectionTitle}>Engineers</Text>
        {members.length === 0 ? (
          <Text style={styles.empty}>No engineers in this team</Text>
        ) : (
          members.map(renderUser)
        )}
      </ScrollView>

      <FAB
        icon="account-plus-outline"
        style={styles.fab}
        color="#fff"
        onPress={() => setAddModalVisible(true)}
      />

      <Portal>
        {/* Add User Modal */}
        <Modal
          visible={addModalVisible}
          onDismiss={() => setAddModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Add User to {team?.name}</Text>
          <View style={styles.roleToggle}>
            {["engineer", "supervisor"].map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.roleBtn,
                  newUser.role === r && styles.roleBtnActive,
                ]}
                onPress={() => setNewUser({ ...newUser, role: r })}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    newUser.role === r && styles.roleBtnTextActive,
                  ]}
                >
                  {r === "engineer" ? "Engineer" : "Supervisor"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            label="Name"
            value={newUser.name}
            onChangeText={(v) => setNewUser({ ...newUser, name: v })}
            mode="outlined"
            activeOutlineColor="#18B4E8"
            style={styles.input}
          />
          <TextInput
            label="Email"
            value={newUser.email}
            onChangeText={(v) => setNewUser({ ...newUser, email: v })}
            mode="outlined"
            activeOutlineColor="#18B4E8"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            label="Password"
            value={newUser.password}
            onChangeText={(v) => setNewUser({ ...newUser, password: v })}
            mode="outlined"
            activeOutlineColor="#18B4E8"
            style={styles.input}
            secureTextEntry
          />
          <Button
            mode="contained"
            onPress={handleCreateUser}
            loading={saving}
            buttonColor="#18B4E8"
            style={styles.saveBtn}
          >
            Add User
          </Button>
        </Modal>

        {/* Edit User Modal */}
        <Modal
          visible={!!editTarget}
          onDismiss={() => setEditTarget(null)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Edit User</Text>
          <View style={styles.roleToggle}>
            {["engineer", "supervisor"].map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.roleBtn,
                  editUser.role === r && styles.roleBtnActive,
                ]}
                onPress={() => setEditUser({ ...editUser, role: r })}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    editUser.role === r && styles.roleBtnTextActive,
                  ]}
                >
                  {r === "engineer" ? "Engineer" : "Supervisor"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.roleToggle}>
            {["online", "offline", "inactive"].map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.roleBtn,
                  editUser.status === s && styles.roleBtnActive,
                ]}
                onPress={() => setEditUser({ ...editUser, status: s })}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    editUser.status === s && styles.roleBtnTextActive,
                  ]}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            label="Name"
            value={editUser.name}
            onChangeText={(v) => setEditUser({ ...editUser, name: v })}
            mode="outlined"
            activeOutlineColor="#18B4E8"
            style={styles.input}
          />
          <TextInput
            label="Email (leave blank to keep current)"
            value={editUser.email}
            onChangeText={(v) => setEditUser({ ...editUser, email: v })}
            mode="outlined"
            activeOutlineColor="#18B4E8"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            label="New Password (leave blank to keep current)"
            value={editUser.password}
            onChangeText={(v) => setEditUser({ ...editUser, password: v })}
            mode="outlined"
            activeOutlineColor="#18B4E8"
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
          />
          <Button
            mode="contained"
            onPress={handleEditUser}
            loading={editing}
            buttonColor="#18B4E8"
            style={styles.saveBtn}
          >
            Save Changes
          </Button>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <Dialog
          visible={!!deleteTarget}
          onDismiss={() => setDeleteTarget(null)}
          style={styles.dialog}
        >
          <Dialog.Icon icon="alert-circle-outline" color="#e53935" size={32} />
          <Dialog.Title style={styles.dialogTitle}>Delete User</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogBody}>
              Are you sure you want to delete{" "}
              <Text style={styles.dialogBold}>{deleteTarget?.name}</Text>? This
              action cannot be undone.
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f9ff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  scroll: { padding: 16, paddingBottom: 100 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  empty: {
    fontSize: 14,
    color: "#94a3b8",
    fontStyle: "italic",
    marginBottom: 8,
  },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    elevation: 1,
  },
  userLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  userName: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  userRole: { fontSize: 12, color: "#64748b" },
  modal: { backgroundColor: "#fff", margin: 24, borderRadius: 16, padding: 24 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    color: "#0f172a",
  },
  roleToggle: { flexDirection: "row", gap: 8, marginBottom: 16 },
  roleBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  roleBtnActive: { backgroundColor: "#18B4E8", borderColor: "#18B4E8" },
  roleBtnText: { fontSize: 14, color: "#64748b", fontWeight: "600" },
  roleBtnTextActive: { color: "#fff" },
  input: { marginBottom: 12, backgroundColor: "#fff" },
  saveBtn: { borderRadius: 8, marginTop: 4 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: "#18B4E8",
  },
  dialog: { backgroundColor: "#fff", borderRadius: 16 },
  dialogTitle: { textAlign: "center", color: "#0f172a", fontWeight: "700" },
  dialogBody: { fontSize: 14, color: "#475569", textAlign: "center" },
  dialogBold: { fontWeight: "700", color: "#0f172a" },
});
