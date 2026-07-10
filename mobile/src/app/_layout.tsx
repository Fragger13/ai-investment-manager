import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as LocalAuthentication from "expo-local-authentication";
import { StatusBar } from "expo-status-bar";
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
      <Text style={lockStyles.title}>Locked for your safety</Text>
      <Text style={lockStyles.subtitle}>Your money details stay sealed until it is really you.</Text>
      <View style={{ marginTop: spacing.xl, width: "100%", gap: spacing.md }}>
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
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  title: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: "800",
    color: colors.foreground,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
