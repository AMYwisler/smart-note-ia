import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/lib/theme";

export type SortKey = "recent" | "oldest" | "urgent" | "reminder" | "category";

const OPTIONS: { key: SortKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "recent",   label: "Plus récentes",     icon: "time" },
  { key: "oldest",   label: "Plus anciennes",    icon: "hourglass" },
  { key: "urgent",   label: "Urgences d'abord",  icon: "alert-circle" },
  { key: "reminder", label: "Par rappel",        icon: "calendar" },
  { key: "category", label: "Par catégorie",     icon: "pricetags" },
];

type Props = {
  value: SortKey;
  onChange: (k: SortKey) => void;
};

export default function SortMenu({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.key === value) ?? OPTIONS[0];

  return (
    <>
      <Pressable
        testID="sort-button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.btn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="swap-vertical" size={16} color={COLORS.text} />
        <Text style={styles.btnText}>{current.label}</Text>
        <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet} testID="sort-sheet">
            <Text style={styles.title}>Trier les notes</Text>
            {OPTIONS.map((o) => {
              const active = o.key === value;
              return (
                <Pressable
                  key={o.key}
                  testID={`sort-option-${o.key}`}
                  onPress={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    active && styles.optionActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons
                    name={o.icon}
                    size={18}
                    color={active ? "#fff" : COLORS.text}
                  />
                  <Text style={[styles.optionText, active && { color: "#fff" }]}>
                    {o.label}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnText: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 14,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionActive: { backgroundColor: COLORS.black, borderColor: COLORS.black },
  optionText: { flex: 1, fontSize: 15, fontWeight: "600", color: COLORS.text },
});
