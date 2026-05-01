import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/lib/theme";
import { listNotes, type Note } from "@/src/lib/api";
import NoteCard from "@/src/components/NoteCard";

export default function SearchScreen() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listNotes({ q: term.trim() });
      setResults(data);
    } catch (e) {
      console.warn("search error", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(q), 300);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  const suggestions = [
    "factures urgentes",
    "rappel demain",
    "devis",
    "impôts",
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]} testID="search-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Recherche</Text>
        <Text style={styles.subtitle}>Mot-clé, montant, catégorie…</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          testID="search-input"
          placeholder="Rechercher dans toutes les notes"
          placeholderTextColor={COLORS.textTertiary}
          value={q}
          onChangeText={setQ}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {q.length > 0 && (
          <Pressable testID="clear-search" onPress={() => setQ("")}>
            <Ionicons name="close-circle" size={20} color={COLORS.textTertiary} />
          </Pressable>
        )}
      </View>

      {q.trim().length === 0 && (
        <View style={styles.suggestionsBox}>
          <Text style={styles.suggestionsTitle}>Idées de recherche</Text>
          <View style={styles.suggestions}>
            {suggestions.map((s) => (
              <Pressable
                key={s}
                testID={`suggestion-${s}`}
                onPress={() => setQ(s)}
                style={styles.suggestion}
              >
                <Ionicons name="sparkles-outline" size={14} color={COLORS.text} />
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.black} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NoteCard note={item} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, paddingTop: 4 }}
          ListEmptyComponent={
            q.trim().length > 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Aucun résultat pour « {q} »</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  suggestionsBox: { paddingHorizontal: 20, marginTop: 8 },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  suggestionText: { fontSize: 13, color: COLORS.text, fontWeight: "500" },
  loading: { padding: 30, alignItems: "center" },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14 },
});
