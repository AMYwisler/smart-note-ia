import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { COLORS } from "@/src/lib/theme";
import { getDashboard, type DashboardData } from "@/src/lib/api";
import NoteCard from "@/src/components/NoteCard";
import QuickCaptureSheet from "@/src/components/QuickCaptureSheet";

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const d = await getDashboard();
      setData(d);
    } catch (e) {
      console.warn("dashboard error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="dashboard-screen">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour</Text>
            <Text style={styles.appName}>Smart Notes IA</Text>
          </View>
          <View style={styles.statBadge}>
            <Ionicons name="document-text-outline" size={16} color={COLORS.text} />
            <Text style={styles.statBadgeText}>{data?.stats.total ?? 0}</Text>
          </View>
        </View>

        {loading && !data ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.black} />
          </View>
        ) : data ? (
          <>
            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatCard
                label="À faire"
                value={data.stats.todo}
                color={COLORS.status.todoText}
                bg={COLORS.status.todo}
                testID="stat-todo"
              />
              <StatCard
                label="En cours"
                value={data.stats.in_progress}
                color={COLORS.status.in_progressText}
                bg={COLORS.status.in_progress}
                testID="stat-progress"
              />
              <StatCard
                label="Fait"
                value={data.stats.done}
                color={COLORS.status.doneText}
                bg={COLORS.status.done}
                testID="stat-done"
              />
            </View>

            {/* Urgences */}
            <Section
              title="Urgences"
              icon="alert-circle"
              iconColor={COLORS.urgent}
              count={data.urgent_today.length}
            >
              {data.urgent_today.length === 0 ? (
                <EmptyMini text="Aucune urgence" />
              ) : (
                data.urgent_today.slice(0, 5).map((n) => <NoteCard key={n.id} note={n} />)
              )}
            </Section>

            {/* En retard */}
            <Section
              title="En retard"
              icon="time"
              iconColor="#B91C1C"
              count={data.overdue.length}
            >
              {data.overdue.length === 0 ? (
                <EmptyMini text="Rien en retard" />
              ) : (
                data.overdue.slice(0, 5).map((n) => <NoteCard key={n.id} note={n} />)
              )}
            </Section>

            {/* Rappels à venir */}
            <Section
              title="Rappels à venir"
              icon="calendar"
              iconColor={COLORS.text}
              count={data.upcoming_reminders.length}
            >
              {data.upcoming_reminders.length === 0 ? (
                <EmptyMini text="Aucun rappel cette semaine" />
              ) : (
                data.upcoming_reminders.slice(0, 5).map((n) => <NoteCard key={n.id} note={n} />)
              )}
            </Section>

            {data.stats.total === 0 && (
              <View style={styles.welcome}>
                <Ionicons name="sparkles" size={28} color={COLORS.black} />
                <Text style={styles.welcomeTitle}>Commencez à capturer</Text>
                <Text style={styles.welcomeText}>
                  Écrivez en vrac ou photographiez un document. L'IA classe, détecte les urgences et planifie les rappels automatiquement.
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* FAB */}
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

function StatCard({
  label, value, color, bg, testID,
}: { label: string; value: number; color: string; bg: string; testID: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]} testID={testID}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

function Section({
  title, icon, iconColor, count, children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name={icon} size={18} color={iconColor} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <View style={styles.emptyMini}>
      <Text style={styles.emptyMiniText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  greeting: { fontSize: 14, color: COLORS.textSecondary, fontWeight: "500" },
  appName: { fontSize: 26, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statBadgeText: { fontSize: 13, fontWeight: "700", color: COLORS.text },

  loading: { alignItems: "center", paddingVertical: 60 },

  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  statCard: { flex: 1, padding: 14, borderRadius: 14 },
  statValue: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 12, fontWeight: "600", marginTop: 2 },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text, letterSpacing: -0.2 },
  countPill: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 28,
    alignItems: "center",
  },
  countText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  emptyMini: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: COLORS.bg2,
    borderRadius: 12,
    alignItems: "center",
  },
  emptyMiniText: { color: COLORS.textTertiary, fontSize: 13 },

  welcome: {
    marginHorizontal: 20,
    backgroundColor: COLORS.bg2,
    padding: 22,
    borderRadius: 16,
    alignItems: "center",
    gap: 8,
  },
  welcomeTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  welcomeText: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 },

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
