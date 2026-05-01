import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, CATEGORY_COLORS, CATEGORY_ICONS, ALL_CATEGORIES } from "@/src/lib/theme";

type Props = {
  selected: string | null;
  onSelect: (cat: string | null) => void;
  counts?: Record<string, number>;
};

/**
 * Horizontal scroll of colored category cards with icons.
 * Used for filtering and quickly seeing how many items per category.
 */
export default function CategoryRail({ selected, onSelect, counts }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {/* "All" pill */}
      <Pressable
        testID="cat-rail-all"
        onPress={() => onSelect(null)}
        style={[
          styles.allChip,
          !selected && styles.allChipActive,
        ]}
      >
        <Ionicons
          name="grid"
          size={14}
          color={!selected ? "#fff" : COLORS.text}
        />
        <Text style={[styles.allChipText, !selected && { color: "#fff" }]}>
          Toutes
        </Text>
      </Pressable>

      {ALL_CATEGORIES.map((c) => {
        const color = CATEGORY_COLORS[c];
        const icon = (CATEGORY_ICONS[c] || "pricetag") as keyof typeof Ionicons.glyphMap;
        const isActive = selected === c;
        const n = counts?.[c] ?? 0;
        return (
          <Pressable
            key={c}
            testID={`cat-rail-${c}`}
            onPress={() => onSelect(isActive ? null : c)}
            style={[
              styles.card,
              { backgroundColor: color.bg, borderColor: color.border },
              isActive && { borderColor: color.text, borderWidth: 2 },
            ]}
          >
            <View style={[styles.iconBubble, { backgroundColor: "#FFFFFF" }]}>
              <Ionicons name={icon} size={16} color={color.text} />
            </View>
            <Text style={[styles.cardName, { color: color.text }]} numberOfLines={1}>
              {c}
            </Text>
            {counts && (
              <View style={[styles.countBubble, { backgroundColor: color.text }]}>
                <Text style={styles.countText}>{n}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  allChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 56,
  },
  allChipActive: { backgroundColor: COLORS.black, borderColor: COLORS.black },
  allChipText: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    height: 56,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: { fontSize: 13, fontWeight: "700", maxWidth: 100 },
  countBubble: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
