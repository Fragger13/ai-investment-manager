import { useCallback, useEffect, useState } from "react";
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Button, Card, Heading } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, loadProfile, onboardingComplete, logout } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = (profile?.name as string) || user?.name || "friend";
  const firstName = displayName.split(" ")[0];

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null);
      const p = profile ?? (await loadProfile());
      if (!p) {
        setError("no-profile");
        return;
      }
      const result = await api.dashboard(p);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.md, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Greeting */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Heading size={24}>Namaste, {firstName}! 👋</Heading>
          <Body muted size={13}>
            Let&apos;s look at your money together.
          </Body>
        </View>
        <Image source={require("@/assets/images/papa-avatar.png")} style={styles.avatar} />
      </View>

      {!onboardingComplete && error === "no-profile" ? (
        <Card>
          <Heading size={17}>One step left</Heading>
          <Body muted style={{ marginTop: 6 }}>
            Papa needs to meet you first. Finish your 5 minute onboarding on the web, then come back here.
          </Body>
          <View style={{ marginTop: spacing.lg }}>
            <Button title="Open askpapa.in" onPress={() => Linking.openURL("https://www.askpapa.in")} />
          </View>
        </Card>
      ) : null}

      {loading && !data ? (
        <Card>
          <Body muted>Papa is adding up your numbers…</Body>
        </Card>
      ) : null}

      {error && error !== "no-profile" ? (
        <Card>
          <Body style={{ color: colors.negativeForeground }}>{error}</Body>
          <View style={{ marginTop: spacing.md }}>
            <Button title="Try again" variant="ghost" onPress={() => { setLoading(true); fetchDashboard(); }} />
          </View>
        </Card>
      ) : null}

      {data ? (
        <>
          {/* Investable this month */}
          <Card style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
            <Text style={styles.investLabel}>You can invest this month</Text>
            <Text style={styles.investAmount}>{formatINR(data.summary.investableSurplus)}</Text>
            <Text style={styles.investSub}>
              Income {formatINR(data.summary.monthlyIncome)} · Spends {formatINR(data.summary.monthlyExpenses)}
            </Text>
          </Card>

          {/* Health score */}
          <Card>
            <View style={styles.rowBetween}>
              <Heading size={17}>Financial health</Heading>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>{Math.round(data.health.score)}</Text>
                <Text style={styles.scoreOutOf}>/100</Text>
              </View>
            </View>
            <Body muted style={{ marginTop: 8 }}>
              {data.health.explanation}
            </Body>
          </Card>

          {/* Do this first */}
          {data.health.actions.length > 0 ? (
            <Card>
              <Heading size={17}>Do this first</Heading>
              <View style={{ marginTop: spacing.md, gap: spacing.md }}>
                {data.health.actions.slice(0, 3).map((action, i) => (
                  <View key={i} style={styles.actionRow}>
                    <View style={styles.actionNum}>
                      <Text style={styles.actionNumText}>{i + 1}</Text>
                    </View>
                    <Body style={{ flex: 1 }}>{action}</Body>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Goals snapshot */}
          {data.goals.length > 0 ? (
            <Card>
              <Heading size={17}>Your goals</Heading>
              <View style={{ marginTop: spacing.md, gap: spacing.lg }}>
                {data.goals.map((goal) => {
                  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentProgress / goal.targetAmount) * 100)) : 0;
                  return (
                    <View key={goal.id} style={{ gap: 6 }}>
                      <View style={styles.rowBetween}>
                        <Body style={{ fontWeight: "700" }}>{goal.name}</Body>
                        <Body muted size={12}>{pct}%</Body>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${pct}%` }]} />
                      </View>
                      <Body muted size={12}>
                        {formatINR(goal.requiredMonthlyInvestment)}/month to stay on track
                      </Body>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : null}

          {/* Alerts */}
          {data.alerts.length > 0 ? (
            <Card>
              <Heading size={17}>Papa noticed</Heading>
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {data.alerts.slice(0, 3).map((alert, i) => (
                  <Body key={i} muted>
                    • {alert}
                  </Body>
                ))}
              </View>
            </Card>
          ) : null}

          {/* Disclaimer + logout */}
          <Body muted size={11} style={{ marginTop: spacing.sm }}>
            {data.disclaimer ||
              "AskPapa shares educational information and recommendations, not investment advice. Investments carry market risk."}
          </Body>
        </>
      ) : null}

      <Pressable onPress={logout} style={{ alignSelf: "center", marginTop: spacing.md, padding: 8 }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  investLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "600",
  },
  investAmount: {
    color: colors.primaryForeground,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 4,
  },
  investSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 6,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scoreText: {
    color: colors.accentForeground,
    fontSize: 18,
    fontWeight: "900",
  },
  scoreOutOf: {
    color: colors.accentForeground,
    fontSize: 11,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  actionNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  actionNumText: {
    color: colors.accentForeground,
    fontSize: 12,
    fontWeight: "800",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
