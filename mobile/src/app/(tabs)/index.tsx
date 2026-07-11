import { useCallback, useEffect, useState } from "react";
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Body, Button, Card, Heading, ScoreRing, SectionLabel } from "@/components/ui";
import { colors, heroShadow, radius, spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { DashboardData } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

function goalEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("house") || n.includes("home") || n.includes("flat")) return "🏠";
  if (n.includes("car") || n.includes("bike")) return "🚗";
  if (n.includes("wedding") || n.includes("marriage")) return "💍";
  if (n.includes("emergency")) return "🛟";
  if (n.includes("retire")) return "🌴";
  if (n.includes("educat") || n.includes("study") || n.includes("college") || n.includes("mba")) return "🎓";
  if (n.includes("travel") || n.includes("trip") || n.includes("vacation")) return "✈️";
  if (n.includes("phone") || n.includes("laptop") || n.includes("gadget")) return "📱";
  return "🎯";
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  // The hero header is deep green, so the status bar flips to light while this
  // screen is focused (other tabs sit on cream and need dark icons).
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );
  const { user, profile, loadProfile, onboardingComplete } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = (profile?.name as string) || user?.name || "friend";
  const firstName = displayName.split(" ")[0];
  const goalCardWidth = Math.min(width - 88, 300);

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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isFocused ? <StatusBar style="light" /> : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryForeground}
            colors={[colors.primary]}
            progressViewOffset={insets.top + 20}
          />
        }
      >
        {/* Hero header: the one number that matters, full bleed */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + spacing.md }, heroShadow]}
        >
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroGreeting}>Namaste, {firstName} 👋</Text>
            </View>
            <Image source={require("@/assets/images/papa-avatar.png")} style={styles.avatar} />
          </View>

          {data ? (
            <>
              <Text style={styles.heroLabel}>You can invest this month</Text>
              <Text style={styles.heroAmount}>{formatINR(data.summary.investableSurplus)}</Text>
              <View style={styles.heroChips}>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipLabel}>Income</Text>
                  <Text style={styles.heroChipValue}>{formatINR(data.summary.monthlyIncome)}</Text>
                </View>
                <View style={styles.heroChip}>
                  <Text style={styles.heroChipLabel}>Spends</Text>
                  <Text style={styles.heroChipValue}>{formatINR(data.summary.monthlyExpenses)}</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.heroLabel}>{loading ? "Papa is adding up your numbers" : "Your money, one glance"}</Text>
              <Text style={styles.heroAmount}>{loading ? "…" : "₹ —"}</Text>
            </>
          )}
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          {error === "no-profile" && !onboardingComplete ? (
            <Animated.View entering={FadeInDown.duration(400)}>
              <Card style={{ marginTop: spacing.lg }}>
                <Heading size={18}>One step left</Heading>
                <Body muted style={{ marginTop: 6 }}>
                  Papa needs to meet you first. Five minutes, and your whole money picture lights up.
                </Body>
                <View style={{ marginTop: spacing.lg }}>
                  <Button title="Start onboarding" onPress={() => router.push("/onboarding")} />
                </View>
              </Card>
            </Animated.View>
          ) : null}

          {error && error !== "no-profile" ? (
            <Card style={{ marginTop: spacing.lg }}>
              <Body style={{ color: colors.negativeForeground }}>{error}</Body>
              <View style={{ marginTop: spacing.md }}>
                <Button title="Try again" variant="ghost" onPress={() => { setLoading(true); fetchDashboard(); }} />
              </View>
            </Card>
          ) : null}

          {data ? (
            <>
              {/* Health score, overlapping the hero */}
              <Animated.View entering={FadeInDown.duration(450)} style={{ marginTop: -28 }}>
                <Card style={styles.healthCard}>
                  <ScoreRing score={data.health.score} />
                  <View style={{ flex: 1 }}>
                    <Heading size={16}>Financial health</Heading>
                    <Body muted size={13} style={{ marginTop: 4 }}>
                      {data.health.explanation}
                    </Body>
                  </View>
                </Card>
              </Animated.View>

              {/* Do this first */}
              {data.health.actions.length > 0 ? (
                <Animated.View entering={FadeInDown.duration(450).delay(80)} style={{ gap: spacing.md }}>
                  <SectionLabel>Do this first</SectionLabel>
                  <Card style={{ gap: spacing.lg }}>
                    {data.health.actions.slice(0, 3).map((action, i) => (
                      <View key={i} style={styles.actionRow}>
                        <View style={styles.actionNum}>
                          <Text style={styles.actionNumText}>{i + 1}</Text>
                        </View>
                        <Body style={{ flex: 1 }} size={14.5}>
                          {action}
                        </Body>
                      </View>
                    ))}
                  </Card>
                </Animated.View>
              ) : null}

              {/* Goals carousel */}
              {data.goals.length > 0 ? (
                <Animated.View entering={FadeInDown.duration(450).delay(160)} style={{ gap: spacing.md }}>
                  <SectionLabel>Your goals</SectionLabel>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={goalCardWidth + spacing.md}
                    decelerationRate="fast"
                    contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}
                    style={{ marginHorizontal: -spacing.lg, paddingLeft: spacing.lg }}
                  >
                    {data.goals.map((goal) => {
                      const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentProgress / goal.targetAmount) * 100)) : 0;
                      return (
                        <Card key={goal.id} style={{ width: goalCardWidth, gap: spacing.sm }}>
                          <View style={styles.goalHead}>
                            <Text style={{ fontSize: 26 }}>{goalEmoji(goal.name)}</Text>
                            <View style={styles.goalPct}>
                              <Text style={styles.goalPctText}>{pct}%</Text>
                            </View>
                          </View>
                          <Heading size={16}>{goal.name}</Heading>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${pct}%` }]} />
                          </View>
                          <Body muted size={12.5}>
                            {formatINR(goal.requiredMonthlyInvestment)} a month keeps this on track
                          </Body>
                        </Card>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              ) : null}

              {/* Papa noticed */}
              {data.alerts.length > 0 ? (
                <Animated.View entering={FadeInDown.duration(450).delay(240)} style={{ gap: spacing.md }}>
                  <SectionLabel>Papa noticed</SectionLabel>
                  <Card style={{ backgroundColor: colors.warningSoft, gap: spacing.sm }}>
                    {data.alerts.slice(0, 3).map((alert, i) => (
                      <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
                        <Text style={{ fontSize: 14 }}>👀</Text>
                        <Body size={13.5} style={{ flex: 1, color: colors.warningForeground }}>
                          {alert}
                        </Body>
                      </View>
                    ))}
                  </Card>
                </Animated.View>
              ) : null}

              <Body muted size={11} style={{ textAlign: "center", paddingHorizontal: spacing.md }}>
                {data.disclaimer ||
                  "AskPapa shares educational information and recommendations, not investment advice. Investments carry market risk."}
              </Body>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 44,
    borderBottomLeftRadius: radius["3xl"] + 6,
    borderBottomRightRadius: radius["3xl"] + 6,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  heroGreeting: {
    color: colors.primaryForeground,
    fontSize: 17,
    fontWeight: "800",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
  },
  heroLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13.5,
    fontWeight: "600",
  },
  heroAmount: {
    color: colors.primaryForeground,
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 2,
  },
  heroChips: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroChip: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  heroChipLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
  },
  heroChipValue: {
    color: colors.primaryForeground,
    fontSize: 12.5,
    fontWeight: "800",
  },
  healthCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  actionNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  actionNumText: {
    color: colors.accentForeground,
    fontSize: 13,
    fontWeight: "800",
  },
  goalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalPct: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  goalPctText: {
    color: colors.accentForeground,
    fontSize: 12,
    fontWeight: "800",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSoft,
    overflow: "hidden",
    marginTop: 2,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
