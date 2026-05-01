import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { COLORS, STATUS_LABEL } from "@/src/lib/theme";
import CategoryBadge from "@/src/components/CategoryBadge";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import { getNote, updateNote, deleteNote, type Note } from "@/src/lib/api";

const STATUSES: ("todo" | "in_progress" | "done")[] = ["todo", "in_progress", "done"];

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchNote = useCallback(async () => {
    if (!id) return;
    try {
      const n = await getNote(id);
      setNote(n);
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible de charger la note");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchNote(); }, [fetchNote]);

  const changeStatus = async (s: "todo" | "in_progress" | "done") => {
    if (!note) return;
    setSaving(true);
    try {
      const updated = await updateNote(note.id, { status: s });
      setNote(updated);
      // When marking as done, auto-return to list (note disappears from "Actives")
      if (s === "done") {
        setTimeout(() => router.back(), 350);
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleUrgent = async () => {
    if (!note) return;
    setSaving(true);
    try {
      const updated = await updateNote(note.id, { urgent: !note.urgent });
      setNote(updated);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!note) return;
    setConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!note) return;
    setDeleting(true);
    try {
      await deleteNote(note.id);
      setConfirmDeleteOpen(false);
      router.back();
    } catch (e: any) {
      setDeleting(false);
      setConfirmDeleteOpen(false);
      Alert.alert("Erreur", e.message || "Suppression impossible");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.black} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!note) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>Note introuvable</Text>
      </SafeAreaView>
    );
  }

  const created = new Date(note.created_at).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const reminderStr = note.reminder_date
    ? new Date(note.reminder_date).toLocaleDateString("fr-FR", {
        weekday: "long", day: "2-digit", month: "long",
      })
    : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="note-detail-screen">
      <View style={styles.topBar}>
        <Pressable
          testID="back-btn"
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            testID="toggle-urgent"
            onPress={toggleUrgent}
            style={[styles.iconBtn, note.urgent && { backgroundColor: COLORS.urgent }]}
            disabled={saving}
          >
            <Ionicons
              name={note.urgent ? "alert-circle" : "alert-circle-outline"}
              size={22}
              color={note.urgent ? "#fff" : COLORS.text}
            />
          </Pressable>
          <Pressable
            testID="delete-btn"
            onPress={onDelete}
            style={styles.iconBtn}
          >
            <Ionicons name="trash-outline" size={22} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingHorizontal: 20 }}>
          {note.urgent && (
            <View style={styles.urgentRow}>
              <Ionicons name="alert-circle" size={14} color="#fff" />
              <Text style={styles.urgentText}>URGENT</Text>
            </View>
          )}

          <Text style={styles.title}>{note.title}</Text>
          <Text style={styles.created}>{created}</Text>

          <View style={styles.badgesRow}>
            {note.categories.map((c) => (
              <CategoryBadge key={c} name={c} />
            ))}
          </View>

          {/* Status segmented control */}
          <Text style={styles.sectionLabel}>Statut</Text>
          <View style={styles.statusRow}>
            {STATUSES.map((s) => {
              const active = note.status === s;
              return (
                <Pressable
                  key={s}
                  testID={`status-${s}`}
                  onPress={() => changeStatus(s)}
                  disabled={saving}
                  style={[styles.statusBtn, active && styles.statusBtnActive]}
                >
                  <Text style={[styles.statusBtnText, active && styles.statusBtnTextActive]}>
                    {STATUS_LABEL[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Meta info */}
          <View style={styles.metaCard}>
            {reminderStr && (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.text} />
                <View>
                  <Text style={styles.metaLabel}>Rappel</Text>
                  <Text style={styles.metaValue}>{reminderStr}</Text>
                </View>
              </View>
            )}
            {note.amount != null && (
              <View style={styles.metaRow}>
                <Ionicons name="cash-outline" size={18} color={COLORS.text} />
                <View>
                  <Text style={styles.metaLabel}>Montant</Text>
                  <Text style={styles.metaValue}>{note.amount.toFixed(2)} €</Text>
                </View>
              </View>
            )}
          </View>

          {/* Image */}
          {note.image_base64 && (
            <View style={styles.imageWrap}>
              <Image
                source={{
                  uri: `data:${note.image_mime || "image/jpeg"};base64,${note.image_base64}`,
                }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Summary */}
          {!!note.summary && note.summary !== note.title && (
            <>
              <Text style={styles.sectionLabel}>Résumé IA</Text>
              <View style={styles.contentBox}>
                <Text style={styles.contentText}>{note.summary}</Text>
              </View>
            </>
          )}

          {/* Original content */}
          {!!note.content && (
            <>
              <Text style={styles.sectionLabel}>Note</Text>
              <View style={styles.contentBox}>
                <Text style={styles.contentText}>{note.content}</Text>
              </View>
            </>
          )}

          {/* OCR */}
          {!!note.ocr_text && (
            <>
              <Text style={styles.sectionLabel}>Texte extrait (OCR)</Text>
              <View style={styles.contentBox}>
                <Text style={styles.contentText}>{note.ocr_text}</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDeleteOpen}
        title="Supprimer la note ?"
        message="Cette action est irréversible."
        confirmLabel={deleting ? "Suppression…" : "Supprimer"}
        cancelLabel="Annuler"
        destructive
        onConfirm={performDelete}
        onCancel={() => !deleting && setConfirmDeleteOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  urgentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.urgent,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 10,
  },
  urgentText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  created: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 22,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    backgroundColor: COLORS.bg2,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  statusBtnActive: { backgroundColor: COLORS.black },
  statusBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary },
  statusBtnTextActive: { color: "#fff" },

  metaCard: {
    marginTop: 16,
    backgroundColor: COLORS.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 12,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  metaValue: { fontSize: 15, color: COLORS.text, fontWeight: "600" },

  imageWrap: { marginTop: 16, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border },
  image: { width: "100%", height: 240 },

  contentBox: {
    backgroundColor: COLORS.bg2,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contentText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },

  error: { textAlign: "center", marginTop: 60, fontSize: 16, color: COLORS.textSecondary },
});
