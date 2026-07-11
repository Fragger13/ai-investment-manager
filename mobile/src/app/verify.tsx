import { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const adoptSession = useAuthStore((s) => s.adoptSession);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function submit(value?: string) {
    const otp = (value ?? code).trim();
    if (otp.length < CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH} digit code from your email.`);
      return;
    }
    if (!email) {
      setError("Something went wrong. Go back and register again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const auth = await api.verifyEmail(String(email), otp);
      adoptSession(auth);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/onboarding");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (e instanceof ApiError && e.status === 409) {
        setError("This email is already verified. Log in instead.");
      } else if (e instanceof ApiError) {
        setError(e.detail);
      } else {
        setError(e instanceof Error ? e.message : "Verification failed. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || !email) return;
    setError(null);
    try {
      await api.resendVerification(String(email));
      setResent(true);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend the code. Try again in a minute.");
    }
  }

  // Render the code as tappable boxes backed by one invisible input, so the
  // keyboard flow stays simple and paste works.
  const digits = code.padEnd(CODE_LENGTH).split("").slice(0, CODE_LENGTH);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center" }}>
          <Image source={require("@/assets/images/papa-avatar.png")} style={styles.avatar} />
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.sub}>
            Papa mailed a {CODE_LENGTH} digit code to{"\n"}
            <Text style={{ fontWeight: "800", color: colors.foreground }}>{email}</Text>
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(120)} style={{ width: "100%", gap: spacing.lg }}>
          <Pressable onPress={() => inputRef.current?.focus()} style={styles.codeRow}>
            {digits.map((digit, i) => (
              <View key={i} style={[styles.codeBox, i === code.length && styles.codeBoxActive]}>
                <Text style={styles.codeDigit}>{digit.trim()}</Text>
              </View>
            ))}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(text) => {
              const clean = text.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH);
              setCode(clean);
              setError(null);
              if (clean.length === CODE_LENGTH) submit(clean);
            }}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            style={styles.hiddenInput}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Verify" onPress={() => submit()} loading={busy} />
          <Pressable onPress={resend} disabled={cooldown > 0}>
            <Text style={[styles.resend, cooldown > 0 && { opacity: 0.5 }]}>
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : resent
                  ? "Send the code again"
                  : "No email? Check spam, or resend the code"}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 36,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  title: {
    marginTop: 14,
    fontSize: 26,
    fontWeight: "900",
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  codeBox: {
    width: 48,
    height: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  codeBoxActive: {
    borderColor: colors.primary,
  },
  codeDigit: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.foreground,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 1,
    width: 1,
  },
  error: {
    color: colors.negativeForeground,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  resend: {
    textAlign: "center",
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.primary,
    paddingVertical: 6,
  },
});
