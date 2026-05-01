import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/src/lib/theme";

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Cross-platform confirmation modal — works on Android (Expo Go), iOS, and web.
 * Used instead of Alert.alert (which has callback issues on react-native-web).
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: destructive ? COLORS.urgentBg : COLORS.bg2 },
            ]}
          >
            <Ionicons
              name={destructive ? "trash" : "alert-circle"}
              size={26}
              color={destructive ? COLORS.urgent : COLORS.text}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.row}>
            <Pressable
              testID="confirm-dialog-cancel"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.btn,
                styles.btnCancel,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.btnCancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              testID="confirm-dialog-confirm"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.btn,
                destructive ? styles.btnDestructive : styles.btnConfirm,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.btnConfirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  box: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.bg,
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    width: "100%",
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnCancel: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnConfirm: { backgroundColor: COLORS.black },
  btnDestructive: { backgroundColor: COLORS.urgent },
  btnCancelText: { color: COLORS.text, fontWeight: "700", fontSize: 15 },
  btnConfirmText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
