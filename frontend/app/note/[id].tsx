import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  COLORS,
  STATUS_LABEL,
  ALL_CATEGORIES,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
} from "@/src/lib/theme";
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

  // Editable fields (local copy)
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [comments, setComments] = useState("");
  const [primaryCategory, setPrimaryCategory] = useState<string>("Personnel");

  const loadFromNote = (n: Note) => {
    setNote(n);
    setTitle(n.title || "");
    setContent(n.content || "");
    setComments(n.comments || "");
    setPrimaryCategory(n.categories?.[0] || "Personnel");
  };

  const fetchNote = useCallback(async () => {
    if (!id) return;
    try {
      const n = await getNote(id);
      loadFromNote(n);
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible de charger la note");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchNote(); }, [fetchNote]);

  const isDirty = useMemo(() => {
    if (!note) return false;
    return (
      title !== (note.title || "") ||
      content !== (note.content || "") ||
      comments !== (note.comments || "") ||
      primaryCategory !== (note.categories?.[0] || "Personnel")
    );
  }, [note, title, content, comments, primaryCategory]);

  const save = async () => {
    if (!note) return;
    setSaving(true);
    try {
      const newCategories: string[] = [primaryCategory];
      if (note.urgent && primaryCategory !== "Urgent" && !newCategories.includes("Urgent")) {
        newCategories.push("Urgent");
      }
      const updated = await updateNote(note.id, {
        title: title.trim() || note.title,
        content,
        comments,
        categories: newCategories,
      });
      loadFromNote(updated);
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        window.alert("Note enregistrée");
      } else {
        Alert.alert("Enregistré", "La note a été mise à jour.");
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (s: "todo" | "in_progress" | "done") => {
    if (!note) return;
    setSaving(true);
    try {
      const updated = await updateNote(note.id, { status: s });
      loadFromNote(updated);
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
      loadFromNote(updated);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setSaving(false);
    }
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
            onPress={() => setConfirmDeleteOpen(true)}
            style={styles.iconBtn}
          >
            <Ionicons name="trash-outline" size={22} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={{ paddingHorizontal: 20 }}>
            {note.urgent && (
              <View style={styles.urgentRow}>
                <Ionicons name="alert-circle" size={14} color="#fff" />
                <Text style={styles.urgentText}>URGENT</Text>
              </View>
            )}

            {/* Title editable */}
            <Text style={styles.sectionLabel}>Titre</Text>
            <TextInput
              testID="note-title-input"
              value={title}
              onChangeText={setTitle}
              placeholder="Titre"
              placeholderTextColor={COLORS.textTertiary}
              style={styles.titleInput}
            />
            <Text style={styles.created}>Créé le {created}</Text>

            {/* Category selector */}
            <Text style={styles.sectionLabel}>Catégorie</Text>
            <View style={styles.catPicker}>
              {ALL_CATEGORIES.map((c) => {
                const color = CATEGORY_COLORS[c];
                const icon = (CATEGORY_ICONS[c] || "pricetag") as any;
                const active = primaryCategory === c;
                return (
                  <Pressable
                    key={c}
                    testID={`category-pick-${c}`}
                    onPress={() => setPrimaryCategory(c)}
                    style={[
                      styles.catChip,
                      { backgroundColor: color.bg, borderColor: active ? color.text : color.border },
                      active && { borderWidth: 2 },
                    ]}
                  >
                    <Ionicons name={icon} size={14} color={color.text} />
                    <Text style={[styles.catChipText, { color: color.text }]}>{c}</Text>
                    {active && (
                      <Ionicons name="checkmark-circle" size={14} color={color.text} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Status */}
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

            {/* Comments — editable, after status */}
            <Text style={styles.sectionLabel}>Commentaires / Précisions</Text>
            <TextInput
              testID="note-comments-input"
              value={comments}
              onChangeText={setComments}
              placeholder="Ajoutez des précisions, notes personnelles, contacts…"
              placeholderTextColor={COLORS.textTertiary}
              multiline
              style={styles.multilineInput}
            />

            {/* Meta info */}
            {(reminderStr || note.amount != null) && (
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
            )}

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

            {/* Original content editable */}
            <Text style={styles.sectionLabel}>Note (texte d'origine)</Text>
            <TextInput
              testID="note-content-input"
              value={content}
              onChangeText={setContent}
              placeholder="Texte de la note"
              placeholderTextColor={COLORS.textTertiary}
              multiline
              style={styles.multilineInput}
            />

            {/* OCR (read only) */}
            {!!note.ocr_text && (
              <>
                <Text style={styles.sectionLabel}>Texte extrait (OCR)</Text>
                <View style={styles.contentBox}>
                  <Text style={styles.contentText}>{note.ocr_text}</Text>
                </View>
              </>
            )}

            {/* AI summary read-only */}
            {!!note.summary && note.summary !== note.title && (
              <>
                <Text style={styles.sectionLabel}>Résumé IA</Text>
                <View style={styles.contentBox}>
                  <Text style={styles.contentText}>{note.summary}</Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky save bar */}
      {isDirty && (
        <View style={styles.saveBar}>
          <Pressable
            testID="save-note-btn"
            onPress={save}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.85 },
              saving && { opacity: 0.7 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveText}>Enregistrer</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

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

  titleInput: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  created: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 22,
    marginBottom: 8,
  },

  catPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  catChipText: { fontSize: 13, fontWeight: "700" },

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

  multilineInput: {
    minHeight: 90,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    textAlignVertical: "top",
    lineHeight: 22,
  },

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
  metaLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaValue: { fontSize: 15, color: COLORS.text, fontWeight: "600" },

  imageWrap: {
    marginTop: 16,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  image: { width: "100%", height: 240 },

  contentBox: {
    backgroundColor: COLORS.bg2,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contentText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },

  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.black,
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },

  error: { textAlign: "center", marginTop: 60, fontSize: 16, color: COLORS.textSecondary },
});
