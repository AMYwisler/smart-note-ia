import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Link } from "expo-router";
import { COLORS } from "@/src/lib/theme";
import { useAuth } from "@/src/contexts/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email et mot de passe requis");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Connexion impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="login-screen">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrap}>
            <Ionicons name="sparkles" size={36} color={COLORS.black} />
            <Text style={styles.brand}>Smart Notes IA</Text>
            <Text style={styles.tagline}>Organisez vos notes avec l'IA</Text>
          </View>

          <Text style={styles.title}>Connexion</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email"
            value={email}
            onChangeText={setEmail}
            placeholder="votre@email.com"
            placeholderTextColor={COLORS.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.pwWrap}>
            <TextInput
              testID="login-password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textTertiary}
              secureTextEntry={!showPw}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
            />
            <Pressable onPress={() => setShowPw((v) => !v)} style={styles.pwToggle}>
              <Ionicons
                name={showPw ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={COLORS.textSecondary}
              />
            </Pressable>
          </View>

          <Link href="/forgot-password" style={styles.forgotLink} testID="link-forgot">
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </Link>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={COLORS.urgent} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            testID="login-submit"
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
              <Text style={styles.primaryBtnText}>Se connecter</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <Link href="/register" asChild>
            <Pressable style={styles.secondaryBtn} testID="link-register">
              <Text style={styles.secondaryBtnText}>Créer un compte</Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 24, paddingTop: 12, paddingBottom: 40 },
  logoWrap: { alignItems: "center", marginTop: 20, marginBottom: 40 },
  brand: { fontSize: 22, fontWeight: "800", color: COLORS.text, marginTop: 8, letterSpacing: -0.3 },
  tagline: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  title: { fontSize: 28, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5, marginBottom: 24 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 4,
  },
  pwWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  pwToggle: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  forgotLink: { alignSelf: "flex-end", marginTop: 10, marginBottom: 8 },
  forgotText: { color: COLORS.text, fontSize: 13, fontWeight: "600" },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.urgentBg,
    borderWidth: 1,
    borderColor: COLORS.urgentBorder,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  errorText: { flex: 1, fontSize: 13, color: COLORS.urgent, fontWeight: "600" },

  primaryBtn: {
    marginTop: 20,
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },

  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600" },

  secondaryBtn: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.black,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: COLORS.black, fontWeight: "800", fontSize: 15 },
});
