import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button, Field } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export default function RegisterScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Redirect href="/(tabs)" />;

  async function submit() {
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) {
      setError("Tell Papa your name.");
      return;
    }
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setError("That email does not look right.");
      return;
    }
    if (password.length < 8) {
      setError("Password needs at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.register(name.trim(), cleanEmail, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: "/verify", params: { email: cleanEmail } });
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (e instanceof ApiError && e.status === 409) {
        setError("This email already has an account. Log in instead.");
      } else if (e instanceof ApiError && e.status === 429) {
        setError("Too many tries. Wait a minute and try again.");
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center" }}>
          <Image source={require("@/assets/images/papa-avatar.png")} style={styles.avatar} />
          <Text style={styles.brand}>Meet Papa</Text>
          <Text style={styles.tagline}>Two minutes to sign up. A lifetime of unsolicited advice.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(120)} style={styles.form}>
          <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g., Rohan Sharma" autoComplete="name" />
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <Text style={styles.privacyNote}>
            Your money details get encrypted with a key born from this password. Not even Papa can peek.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Create my account" onPress={submit} loading={busy} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(220)} style={{ alignItems: "center" }}>
          <Pressable onPress={() => router.replace("/login")}>
            <Text style={styles.footerLink}>
              Already have an account? <Text style={{ color: colors.primary, fontWeight: "800" }}>Log in</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
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
    letterSpacing: -0.6,
  },
  tagline: {
    marginTop: 6,
    fontSize: 13.5,
    color: colors.mutedForeground,
    textAlign: "center",
    lineHeight: 19,
  },
  form: {
    width: "100%",
    marginTop: 32,
    gap: spacing.lg,
  },
  privacyNote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedForeground,
  },
  error: {
    color: colors.negativeForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  footerLink: {
    marginTop: 26,
    fontSize: 13.5,
    color: colors.mutedForeground,
  },
});
