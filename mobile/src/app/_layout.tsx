import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as LocalAuthentication from "expo-local-authentication";
import { StatusBar } from "expo-status-bar";
import { Fingerprint } from "lucide-react-native";
import { Button } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { useAuthStore } from "@/store/auth-store";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { token, hasHydrated, logout } = useAuthStore();
  // Sessions resume behind a biometric check: the token carries the key to
  // the user's financial data, so picking up an unlocked phone must not mean
  // an open money app. Devices without biometrics fall through gracefully.
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    SplashScreen.hideAsync();
    if (!token) {
      setLocked(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const capable = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      if (!capable) {
        if (!cancelled) setLocked(false);
        return;
      }
      if (!cancelled) setLocked(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock AskPapa",
        cancelLabel: "Cancel",
      });
      if (!cancelled && result.success) setLocked(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasHydrated, token]);

  if (!hasHydrated || locked === null) return null;

  if (locked) {
    return <LockScreen onUnlocked={() => setLocked(false)} onLogout={() => { logout(); setLocked(false); }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </View>
  );
}

function LockScreen({ onUnlocked, onLogout }: { onUnlocked: () => void; onLogout: () => void }) {
  async function retry() {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock AskPapa" });
    if (result.success) onUnlocked();
  }

  return (
    <View style={lockStyles.container}>
      <Image source={require("@/assets/images/papa-avatar.png")} style={lockStyles.avatar} />
      <View style={lockStyles.badge}>
        <Fingerprint color={colors.accentForeground} size={22} />
      </View>
      <Text style={lockStyles.title}>Locked for your safety</Text>
      <Text style={lockStyles.subtitle}>Your money details stay sealed until it is really you.</Text>
      <View style={{ marginTop: spacing["2xl"], width: "100%", gap: spacing.md }}>
        <Button title="Unlock" onPress={retry} />
        <Button title="Log out instead" variant="ghost" onPress={onLogout} />
      </View>
    </View>
  );
}

const lockStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  badge: {
    marginTop: -18,
    marginLeft: 64,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.background,
  },
  title: {
    marginTop: 18,
    fontSize: 23,
    fontWeight: "900",
    color: colors.foreground,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
