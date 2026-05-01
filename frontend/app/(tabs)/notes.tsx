import React, { useCallback, useMemo, useState } from "react";
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
import { COLORS } from "@/src/lib/theme";
import { listNotes, getDashboard, type Note } from "@/src/lib/api";
import NoteCard from "@/src/components/NoteCard";
import QuickCaptureSheet from "@/src/components/QuickCaptureSheet";
import CategoryRail from "@/src/components/CategoryRail";
import SortMenu, { type SortKey } from "@/src/components/SortMenu";

type StatusFilter = "all" | "todo" | "in_progress" | "done";

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchData = useCallback(async () => {
    try {
      const params: any = { sort };
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
  }, [statusFilter, categoryFilter, urgentOnly, sort]);

  const fetchCounts = useCallback(async () => {
    try {
      const dash = await getDashboard();
      const map: Record<string, number> = {};
      for (const e of dash.by_category) map[e.category] = e.count;
      setCounts(map);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
      fetchCounts();
    }, [fetchData, fetchCounts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    fetchCounts();
  };

  const statusOptions: { key: StatusFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "all",         label: "Tout",      icon: "albums-outline" },
    { key: "todo",        label: "À faire",   icon: "ellipse-outline" },
    { key: "in_progress", label: "En cours",  icon: "play-circle-outline" },
    { key: "done",        label: "Fait",      icon: "checkmark-circle-outline" },
  ];

  // Group by primary category when sort = "category"
  const groupedSections = useMemo(() => {
    if (sort !== "category") return null;
    const groups: { category: string; items: Note[] }[] = [];
    const byCat: Record<string, Note[]> = {};
    for (const n of notes) {
      const cat = n.categories[0] || "Personnel";
      (byCat[cat] = byCat[cat] || []).push(n);
    }
    for (const cat of Object.keys(byCat).sort()) {
      groups.push({ category: cat, items: byCat[cat] });
    }
    return groups;
  }, [notes, sort]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="notes-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mes notes</Text>
          <Text style={styles.subtitle}>{notes.length} note{notes.length > 1 ? "s" : ""}</Text>
        </View>
        <SortMenu value={sort} onChange={setSort} />
      </View>

      {/* Status + urgent chips */}
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
        <View style={styles.divider} />
        {statusOptions.map((s) => {
          const active = statusFilter === s.key;
          return (
            <Pressable
              key={s.key}
              testID={`filter-status-${s.key}`}
              onPress={() => setStatusFilter(s.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Ionicons
                name={s.icon}
                size={14}
                color={active ? "#fff" : COLORS.text}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Improved category rail with icons + counts */}
      <CategoryRail
        selected={categoryFilter}
        onSelect={setCategoryFilter}
        counts={counts}
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.black} />
        </View>
      ) : groupedSections ? (
        // Category-grouped view
        <FlatList
          data={groupedSections}
          keyExtractor={(g) => g.category}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 18 }}>
              <Text style={styles.groupTitle}>{item.category} · {item.items.length}</Text>
              {item.items.map((n) => <NoteCard key={n.id} note={n} />)}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState />}
        />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NoteCard note={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState />}
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
        onCreated={() => { fetchData(); fetchCounts(); }}
      />
    </SafeAreaView>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Ionicons name="document-text-outline" size={48} color={COLORS.textTertiary} />
      <Text style={styles.emptyTitle}>Aucune note</Text>
      <Text style={styles.emptyText}>Appuyez sur + pour créer votre première note</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.black, borderColor: COLORS.black },
  chipText: { fontSize: 12, color: COLORS.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },

  groupTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingLeft: 4,
    marginBottom: 10,
  },

  listContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 },

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
