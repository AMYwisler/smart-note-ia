import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CategoryBadge from "./CategoryBadge";
import { COLORS, STATUS_LABEL } from "@/src/lib/theme";
import type { Note } from "@/src/lib/api";

function formatDate(iso?: string | null) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

export default function NoteCard({ note }: { note: Note }) {
  const router = useRouter();
  const reminder = formatDate(note.reminder_date);

  return (
    <Pressable
      testID={`note-card-${note.id}`}
      onPress={() => router.push(`/note/${note.id}`)}
      style={({ pressed }) => [
        styles.card,
        note.urgent && styles.cardUrgent,
        pressed && { opacity: 0.85 },
      ]}
    >
      {note.urgent && (
        <View style={styles.urgentBadge} testID="urgent-badge">
          <Ionicons name="alert-circle" size={12} color="#FFFFFF" />
          <Text style={styles.urgentBadgeText}>URGENT</Text>
        </View>
      )}

      <Text style={styles.title} numberOfLines={2}>{note.title || "Note"}</Text>

      {!!note.summary && (
        <Text style={styles.summary} numberOfLines={2}>{note.summary}</Text>
      )}

      <View style={styles.metaRow}>
        <View style={styles.badgeRow}>
          {note.categories.slice(0, 3).map((c) => (
            <CategoryBadge key={c} name={c} small />
          ))}
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={[styles.statusPill, statusStyle(note.status)]}>
          <Text style={[styles.statusText, statusTextStyle(note.status)]}>
            {STATUS_LABEL[note.status]}
          </Text>
        </View>
        {reminder && (
          <View style={styles.reminder}>
            <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.reminderText}>{reminder}</Text>
          </View>
        )}
        {note.amount != null && (
          <View style={styles.reminder}>
            <Ionicons name="cash-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.reminderText}>{note.amount.toFixed(2)}€</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function statusStyle(s: string) {
  if (s === "in_progress") return { backgroundColor: COLORS.status.in_progress };
  if (s === "done") return { backgroundColor: COLORS.status.done };
  return { backgroundColor: COLORS.status.todo };
}
function statusTextStyle(s: string) {
  if (s === "in_progress") return { color: COLORS.status.in_progressText };
  if (s === "done") return { color: COLORS.status.doneText };
  return { color: COLORS.status.todoText };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardUrgent: {
    backgroundColor: COLORS.urgentBg,
    borderColor: COLORS.urgentBorder,
  },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.urgent,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  urgentBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  summary: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10, lineHeight: 18 },
  metaRow: { marginBottom: 8 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  reminder: { flexDirection: "row", alignItems: "center", gap: 4 },
  reminderText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" },
});
