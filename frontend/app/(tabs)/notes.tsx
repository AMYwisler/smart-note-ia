import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { COLORS, ALL_CATEGORIES } from "@/src/lib/theme";
import { listNotes, type Note } from "@/src/lib/api";
import NoteCard from "@/src/components/NoteCard";
import QuickCaptureSheet from "@/src/components/QuickCaptureSheet";

type StatusFilter = "all" | "todo" | "in_progress" | "done";

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params: any = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (urgentOnly) params.urgent = true;
      const data = await listNotes(params);
      setNotes(data);
    } catch (e) {
      console.warn("notes error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, categoryFilter, urgentOnly]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const statusOptions: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Tout" },
    { key: "todo", label: "À faire" },
    { key: "in_progress", label: "En cours" },
    { key: "done", label: "Fait" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="notes-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Mes notes</Text>
        <Text style={styles.subtitle}>{notes.length} note{notes.length > 1 ? "s" : ""}</Text>
      </View>

      {/* Status filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <Pressable
          testID="filter-urgent"
          onPress={() => setUrgentOnly((v) => !v)}
          style={[
            styles.chip,
            urgentOnly && { backgroundColor: COLORS.urgent, borderColor: COLORS.urgent },
          ]}
        >
          <Ionicons
            name="alert-circle"
            size={14}
            color={urgentOnly ? "#fff" : COLORS.urgent}
          />
          <Text style={[styles.chipText, urgentOnly && { color: "#fff" }]}>
            Urgent
          </Text>
        </Pressable>

        {statusOptions.map((s) => (
          <Pressable
            key={s.key}
            testID={`filter-status-${s.key}`}
            onPress={() => setStatusFilter(s.key)}
            style={[
              styles.chip,
              statusFilter === s.key && styles.chipActive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                statusFilter === s.key && styles.chipTextActive,
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Category filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <Pressable
          testID="filter-cat-all"
          onPress={() => setCategoryFilter(null)}
          style={[styles.chip, !categoryFilter && styles.chipActive]}
        >
          <Text style={[styles.chipText, !categoryFilter && styles.chipTextActive]}>
            Toutes catégories
          </Text>
        </Pressable>
        {ALL_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            testID={`filter-cat-${c}`}
            onPress={() => setCategoryFilter(c)}
            style={[styles.chip, categoryFilter === c && styles.chipActive]}
          >
            <Text style={[styles.chipText, categoryFilter === c && styles.chipTextActive]}>
              {c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.black} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NoteCard note={item} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>Aucune note</Text>
              <Text style={styles.emptyText}>Appuyez sur + pour créer votre première note</Text>
            </View>
          }
        />
      )}

      <Pressable
        testID="fab-quick-add"
        onPress={() => setCaptureOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>

      <QuickCaptureSheet
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCreated={fetchData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.black, borderColor: COLORS.black },
  chipText: { fontSize: 12, color: COLORS.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: "center" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
