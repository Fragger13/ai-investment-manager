import { useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button, Field } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
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
        setError("Please verify your email first. Check your inbox for the code, then log in again.");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center" }}>
          <Image source={require("@/assets/images/papa-avatar.png")} style={styles.avatar} />
          <Text style={styles.brand}>AskPapa</Text>
          <Text style={styles.tagline}>Your Papa for all things Finance</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(120)} style={styles.form}>
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
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(220)} style={{ alignItems: "center" }}>
          <Pressable onPress={() => Linking.openURL("https://www.askpapa.in/register")}>
            <Text style={styles.footerLink}>
              New here? <Text style={{ color: colors.primary, fontWeight: "800" }}>Create your account at askpapa.in</Text>
            </Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL("https://www.askpapa.in/password-reset")}>
            <Text style={[styles.footerLink, { marginTop: 10 }]}>Forgot password?</Text>
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
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  brand: {
    marginTop: 16,
    fontSize: 34,
    fontWeight: "900",
    color: colors.foreground,
    letterSpacing: -0.8,
  },
  tagline: {
    marginTop: 4,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  form: {
    width: "100%",
    marginTop: 36,
    gap: spacing.lg,
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
