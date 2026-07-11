import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronRight, Compass, FileText, Fingerprint, LogOut, NotebookTabs, Pencil, PieChart, ShieldCheck } from "lucide-react-native";
import { Body, Card, Heading, PressableScale, SectionLabel } from "@/components/ui";
import { cardShadow, colors, radius, spacing } from "@/constants/theme";
import { useAuthStore } from "@/store/auth-store";

function LinkRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <ChevronRight color={colors.mutedForeground} size={18} />
    </PressableScale>
  );
}

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, logout } = useAuthStore();
  const [biometrics, setBiometrics] = useState<"on" | "unavailable" | null>(null);

  useEffect(() => {
    (async () => {
      const capable = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      setBiometrics(capable ? "on" : "unavailable");
    })();
  }, []);

  const displayName = (profile?.name as string) || user?.name || "friend";
  const initial = displayName.trim().charAt(0).toUpperCase() || "A";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.lg,
        paddingTop: insets.top + spacing.xl,
        paddingBottom: 40,
        gap: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Identity */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.identity}>
        <View style={styles.initialCircle}>
          <Text style={styles.initialText}>{initial}</Text>
        </View>
        <Heading size={22}>{displayName}</Heading>
        {user?.email ? (
          <Body muted size={13}>
            {user.email}
          </Body>
        ) : null}
      </Animated.View>

      {/* Profile */}
      <Animated.View entering={FadeInDown.duration(400).delay(60)} style={{ gap: spacing.md }}>
        <SectionLabel>Your details</SectionLabel>
        <Card style={{ padding: spacing.sm, gap: 2 }}>
          <LinkRow
            icon={<Pencil color={colors.primary} size={20} />}
            title="Edit your details"
            subtitle="Income, spends, loans, goals, risk. Everything Papa knows."
            onPress={() => router.push("/onboarding")}
          />
        </Card>
      </Animated.View>

      {/* More of AskPapa, on the web for now */}
      <Animated.View entering={FadeInDown.duration(400).delay(80)} style={{ gap: spacing.md }}>
        <SectionLabel>More from Papa</SectionLabel>
        <Card style={{ padding: spacing.sm, gap: 2 }}>
          <LinkRow
            icon={<NotebookTabs color={colors.primary} size={20} />}
            title="Your full plan"
            subtitle="On the web while Papa builds it here"
            onPress={() => Linking.openURL("https://www.askpapa.in/plan")}
          />
          <LinkRow
            icon={<PieChart color={colors.primary} size={20} />}
            title="Portfolio"
            subtitle="Holdings, allocation and health"
            onPress={() => Linking.openURL("https://www.askpapa.in/portfolio")}
          />
          <LinkRow
            icon={<Compass color={colors.primary} size={20} />}
            title="Discover funds"
            subtitle="Recommendations with reasons"
            onPress={() => Linking.openURL("https://www.askpapa.in/discover")}
          />
        </Card>
      </Animated.View>

      {/* Trust */}
      <Animated.View entering={FadeInDown.duration(400).delay(160)} style={{ gap: spacing.md }}>
        <SectionLabel>Your data</SectionLabel>
        <Card style={{ padding: spacing.sm, gap: 2 }}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Fingerprint color={colors.primary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>App lock</Text>
              <Text style={styles.rowSub}>
                {biometrics === "on"
                  ? "Fingerprint or face unlock is on"
                  : biometrics === "unavailable"
                    ? "No biometrics set up on this phone"
                    : "Checking"}
              </Text>
            </View>
            {biometrics === "on" ? <ShieldCheck color={colors.positive} size={20} /> : null}
          </View>
          <LinkRow
            icon={<FileText color={colors.primary} size={20} />}
            title="Privacy"
            subtitle="Your money details are encrypted. Even we cannot read them."
            onPress={() => Linking.openURL("https://www.askpapa.in/privacy")}
          />
        </Card>
      </Animated.View>

      {/* Log out */}
      <Animated.View entering={FadeInDown.duration(400).delay(240)}>
        <PressableScale onPress={logout} style={styles.logout}>
          <LogOut color={colors.negativeForeground} size={18} />
          <Text style={styles.logoutText}>Log out</Text>
        </PressableScale>
      </Animated.View>

      <Body muted size={11} style={{ textAlign: "center" }}>
        AskPapa 1.0.0 · Made with ❤️ in India
      </Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.md,
  },
  initialCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    ...cardShadow,
  },
  initialText: {
    color: colors.primaryForeground,
    fontSize: 30,
    fontWeight: "900",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderRadius: radius.lg,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
  },
  rowSub: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.negativeSoft,
    borderRadius: 999,
    paddingVertical: 15,
  },
  logoutText: {
    color: colors.negativeForeground,
    fontSize: 15,
    fontWeight: "800",
  },
});
