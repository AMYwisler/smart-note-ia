import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/src/lib/theme";

type Props = { name: string; small?: boolean };

export default function CategoryBadge({ name, small = false }: Props) {
  const color = CATEGORY_COLORS[name] || { bg: "#F3F4F6", text: "#4B5563", border: "#E5E7EB" };
  const iconName = (CATEGORY_ICONS[name] || "pricetag") as keyof typeof Ionicons.glyphMap;
  const iconSize = small ? 11 : 13;

  return (
    <View
      testID={`category-badge-${name}`}
      style={[
        styles.badge,
        { backgroundColor: color.bg, borderColor: color.border },
        small && styles.small,
      ]}
    >
      <Ionicons name={iconName} size={iconSize} color={color.text} />
      <Text style={[styles.text, { color: color.text }, small && styles.smallText]}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  small: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 3 },
  text: { fontSize: 12, fontWeight: "700" },
  smallText: { fontSize: 11 },
});
