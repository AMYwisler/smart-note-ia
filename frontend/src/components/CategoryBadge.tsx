import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CATEGORY_COLORS } from "@/src/lib/theme";

type Props = { name: string; small?: boolean };

export default function CategoryBadge({ name, small = false }: Props) {
  const color = CATEGORY_COLORS[name] || { bg: "#F3F4F6", text: "#4B5563" };
  return (
    <View
      testID={`category-badge-${name}`}
      style={[
        styles.badge,
        { backgroundColor: color.bg },
        small && styles.small,
      ]}
    >
      <Text style={[styles.text, { color: color.text }, small && styles.smallText]}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  small: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  text: { fontSize: 12, fontWeight: "600" },
  smallText: { fontSize: 11 },
});
