import { useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Button, Field } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export default function LoginScreen() {
  const router = useRouter();
  const { token, login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Redirect href="/(tabs)" />;

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (!result.emailVerified) {
        setError("Please verify your email first — check your inbox for the code, then log in again.");
        return;
      }
      router.replace("/(tabs)");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError("Wrong email or password. Try again.");
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={require("@/assets/images/papa-avatar.png")} style={styles.avatar} />
        <Text style={styles.brand}>AskPapa</Text>
        <Text style={styles.tagline}>Your Papa for all things Finance</Text>

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="Your password"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Log in" onPress={submit} loading={busy} />
        </View>

        <Pressable onPress={() => Linking.openURL("https://www.askpapa.in/register")}>
          <Text style={styles.footerLink}>
            New here? <Text style={{ color: colors.primary, fontWeight: "700" }}>Create your account at askpapa.in</Text>
          </Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL("https://www.askpapa.in/password-reset")}>
          <Text style={[styles.footerLink, { marginTop: 6 }]}>Forgot password?</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
    backgroundColor: colors.background,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  brand: {
    marginTop: 14,
    fontSize: 30,
    fontWeight: "900",
    color: colors.foreground,
  },
  tagline: {
    marginTop: 4,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  form: {
    width: "100%",
    marginTop: 28,
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  error: {
    color: colors.negativeForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  footerLink: {
    marginTop: 22,
    fontSize: 13,
    color: colors.mutedForeground,
  },
});
