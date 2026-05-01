import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "@/src/lib/theme";
import { createNote } from "@/src/lib/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function QuickCaptureSheet({ visible, onClose, onCreated }: Props) {
  const [content, setContent] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setContent("");
    setImageBase64(null);
    setImageMime(null);
    setLoading(false);
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const pickImage = async (fromCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission requise", "Autorisez l'accès à la caméra.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
          base64: true,
          allowsEditing: false,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission requise", "Autorisez l'accès à la galerie.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.6,
          base64: true,
          allowsEditing: false,
        });
      }
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        if (a.base64) {
          setImageBase64(a.base64);
          setImageMime(a.mimeType || "image/jpeg");
        }
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible d'accéder à l'image");
    }
  };

  const submit = async () => {
    if (!content.trim() && !imageBase64) {
      Alert.alert("Note vide", "Ajoutez du texte ou une photo.");
      return;
    }
    setLoading(true);
    try {
      await createNote({
        content: content.trim(),
        image_base64: imageBase64,
        image_mime: imageMime,
      });
      reset();
      onCreated();
      onClose();
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Création impossible");
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardWrap}
        >
          <View style={styles.sheet} testID="quick-capture-sheet">
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.title}>Nouvelle note</Text>
              <Pressable onPress={close} testID="close-quick-capture">
                <Ionicons name="close" size={26} color={COLORS.text} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
              <TextInput
                testID="note-content-input"
                value={content}
                onChangeText={setContent}
                placeholder="Écrivez en vrac… L'IA s'occupe du reste."
                placeholderTextColor={COLORS.textTertiary}
                multiline
                autoFocus
                style={styles.input}
              />

              {imageBase64 && (
                <View style={styles.preview}>
                  <Image
                    source={{ uri: `data:${imageMime || "image/jpeg"};base64,${imageBase64}` }}
                    style={styles.previewImg}
                  />
                  <Pressable
                    testID="remove-image"
                    style={styles.removeImg}
                    onPress={() => { setImageBase64(null); setImageMime(null); }}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              )}
            </ScrollView>

            <View style={styles.actionsRow}>
              <Pressable
                testID="capture-camera"
                onPress={() => pickImage(true)}
                style={styles.iconBtn}
                disabled={loading}
              >
                <Ionicons name="camera-outline" size={22} color={COLORS.text} />
                <Text style={styles.iconBtnText}>Photo</Text>
              </Pressable>
              <Pressable
                testID="capture-gallery"
                onPress={() => pickImage(false)}
                style={styles.iconBtn}
                disabled={loading}
              >
                <Ionicons name="images-outline" size={22} color={COLORS.text} />
                <Text style={styles.iconBtnText}>Galerie</Text>
              </Pressable>
            </View>

            <Pressable
              testID="submit-note"
              onPress={submit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submit,
                pressed && { opacity: 0.85 },
                loading && { opacity: 0.7 },
              ]}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.submitText}>L'IA organise…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={styles.submitText}>Laisser l'IA organiser</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  keyboardWrap: { width: "100%" },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: "92%",
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  input: {
    minHeight: 140,
    maxHeight: 260,
    backgroundColor: COLORS.bg2,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  preview: {
    marginTop: 12,
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewImg: { width: "100%", height: 180 },
  removeImg: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, padding: 6,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.bg2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBtnText: { color: COLORS.text, fontWeight: "600" },
  submit: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },
});
