import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "@/src/lib/theme";
import { apiForgotPassword } from "@/src/lib/auth";
import { styles } from "./login";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Email requis");
      return;
    }
    setLoading(true);
    try {
      await apiForgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="forgot-screen">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: 12 }}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>

          <Text style={styles.title}>Mot de passe oublié</Text>
          <Text style={{ color: COLORS.textSecondary, marginBottom: 20, lineHeight: 20 }}>
            Entrez votre email, nous vous enverrons un lien pour réinitialiser votre mot de passe.
          </Text>

          {sent ? (
            <View
              style={{
                backgroundColor: "#DCFCE7",
                borderWidth: 1,
                borderColor: "#86EFAC",
                borderRadius: 12,
                padding: 16,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
              }}
              testID="forgot-sent"
            >
              <Ionicons name="checkmark-circle" size={20} color="#166534" />
              <Text style={{ color: "#166534", flex: 1, lineHeight: 20, fontWeight: "600" }}>
                Si cet email existe dans notre base, un lien de réinitialisation vient d'être envoyé. Vérifiez vos spams.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="forgot-email"
                value={email}
                onChangeText={setEmail}
                placeholder="votre@email.com"
                placeholderTextColor={COLORS.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />

              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.urgent} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                testID="forgot-submit"
                onPress={submit}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.85 },
                  loading && { opacity: 0.7 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Envoyer le lien</Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
