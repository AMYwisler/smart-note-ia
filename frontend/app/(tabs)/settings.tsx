import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "@/src/lib/theme";
import { useAuth } from "@/src/contexts/AuthContext";
import { apiDeleteAccount } from "@/src/lib/auth";
import ConfirmDialog from "@/src/components/ConfirmDialog";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const doLogout = async () => {
    setWorking(true);
    try {
      await logout();
      setLogoutOpen(false);
      router.replace("/login");
    } finally {
      setWorking(false);
    }
  };

  const doDelete = async () => {
    if (!token) return;
    setWorking(true);
    try {
      await apiDeleteAccount(token);
      await logout();
      setDeleteOpen(false);
      router.replace("/login");
    } catch {
      setWorking(false);
      setDeleteOpen(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="settings-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Account card */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={28} color={COLORS.text} />
          </View>
          <Text style={styles.sectionLabel}>Compte connecté</Text>
          <Text style={styles.email} testID="settings-email">{user?.email || "—"}</Text>
          {user && (
            <Text style={styles.since}>
              Membre depuis{" "}
              {new Date(user.created_at).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </Text>
          )}
        </View>

        {/* Logout */}
        <Pressable
          testID="settings-logout"
          onPress={() => setLogoutOpen(true)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.text} />
          <Text style={styles.rowText}>Se déconnecter</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
        </Pressable>

        {/* Danger zone */}
        <Text style={styles.dangerLabel}>Zone dangereuse</Text>
        <Pressable
          testID="settings-delete-account"
          onPress={() => setDeleteOpen(true)}
          style={({ pressed }) => [styles.rowDanger, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.urgent} />
          <Text style={[styles.rowText, { color: COLORS.urgent }]}>Supprimer mon compte</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.urgent} />
        </Pressable>
        <Text style={styles.hint}>
          La suppression est irréversible : toutes vos notes et votre compte seront effacés.
        </Text>

        {working && (
          <ActivityIndicator color={COLORS.black} style={{ marginTop: 20 }} />
        )}
      </ScrollView>

      <ConfirmDialog
        visible={logoutOpen}
        title="Se déconnecter ?"
        message="Vous pourrez vous reconnecter à tout moment."
        confirmLabel={working ? "…" : "Déconnexion"}
        cancelLabel="Annuler"
        onConfirm={doLogout}
        onCancel={() => setLogoutOpen(false)}
      />

      <ConfirmDialog
        visible={deleteOpen}
        title="Supprimer votre compte ?"
        message="Toutes vos notes et données seront définitivement supprimées. Cette action est irréversible."
        confirmLabel={working ? "Suppression…" : "Supprimer"}
        cancelLabel="Annuler"
        destructive
        onConfirm={doDelete}
        onCancel={() => !working && setDeleteOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },

  card: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  email: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginTop: 4 },
  since: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 10,
  },
  rowDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.urgentBg,
    borderWidth: 1,
    borderColor: COLORS.urgentBorder,
    borderRadius: 14,
    marginBottom: 10,
  },
  rowText: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },

  dangerLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.urgent,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 10,
  },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
});
