import { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { ArrowLeft } from "lucide-react-native";
import { Button, PressableScale } from "@/components/ui";
import { colors, heroShadow, radius, spacing } from "@/constants/theme";
import { api, ApiError } from "@/lib/api";
import type { OnboardingProfile } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";
import {
  STEP_ORDER,
  blankDraft,
  buildPayload,
  draftFromProfile,
  validateStep,
  type OnboardingDraft,
  type StepId,
} from "@/features/onboarding/logic";
import { AboutStep, IncomeStep, SpendingStep } from "@/features/onboarding/step-basics";
import { DocumentsStep } from "@/features/onboarding/step-docs";
import { LoansStep } from "@/features/onboarding/step-loans";
import { HabitsStep, RiskStep } from "@/features/onboarding/step-mind";
import { GoalsStep } from "@/features/onboarding/step-goals";
import { ReviewStep } from "@/features/onboarding/step-review";

const STEP_META: Record<StepId, { title: string; sub?: string; papa: string }> = {
  documents: {
    title: "Skip the typing",
    sub: "Upload what you have, one by one. Papa fills the form and you just check it.",
    papa: "Hand me the paperwork, beta. I read fast and I never gossip.",
  },
  about: {
    title: "About you",
    sub: "Whatever you share here shapes everything Papa suggests.",
    papa: "I'm only asking because your money behaves differently from mine.",
  },
  income: {
    title: "Money coming in",
    sub: "In hand, after tax. Not your CTC.",
    papa: "Don't round up too much, beta. Your bank account knows the truth.",
  },
  spending: {
    title: "Money going out",
    sub: "Roughly is fine. Papa is not the income tax department.",
    papa: "Money talks. Yours seems to be saying goodbye a lot.",
  },
  loans: {
    title: "Loans and EMIs",
    sub: "Anything where you pay monthly.",
    papa: "Let's count how many people are waiting for your salary before you do.",
  },
  risk: {
    title: "How you feel about risk",
    sub: "Two gut checks and a date with retirement.",
    papa: "No wrong answers here. Nobody gets extra marks for being a hero.",
  },
  habits: {
    title: "Your money habits",
    sub: "Pick whatever is closest to how you actually act.",
    papa: "Let's find out if you're Warren Buffett or Add to Cart Buffett.",
  },
  goals: {
    title: "Your goals",
    sub: "Papa plans every rupee around these.",
    papa: "No dream is too big, no goal too small. Bring them all here, beta.",
  },
  review: {
    title: "Check everything",
    sub: "Tap edit on anything that looks off.",
    papa: "One last look. Papa checks everything twice, you should too.",
  },
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, hasHydrated, profile, loadProfile, markOnboarded } = useAuthStore();

  const [draft, setDraft] = useState<OnboardingDraft>(blankDraft());
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const hydratedDraft = useRef(false);

  // Resume a half-done onboarding: earlier partial saves land in the profile
  // store, so pull whatever exists once and prefill the draft from it.
  useEffect(() => {
    if (hydratedDraft.current || !token) return;
    hydratedDraft.current = true;
    (async () => {
      const existing = profile ?? (await loadProfile().catch(() => null));
      if (existing && typeof existing === "object") {
        setDraft(draftFromProfile(existing as Record<string, unknown>));
      }
    })();
  }, [token, profile, loadProfile]);

  if (hasHydrated && !token) return <Redirect href="/login" />;

  const step = STEP_ORDER[stepIndex];
  const meta = STEP_META[step];
  const progress = (stepIndex + 1) / STEP_ORDER.length;

  const update = (patch: Partial<OnboardingDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  const jumpTo = (target: StepId) => {
    setStepIndex(STEP_ORDER.indexOf(target));
    setError(null);
  };

  async function next() {
    const problem = validateStep(step, draft);
    if (problem) {
      setError(problem);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setError(null);

    if (step === "review") {
      await submit();
      return;
    }

    // Fire-and-forget partial save so progress survives app restarts.
    api.saveOnboarding(buildPayload(draft), { partial: true }).catch(() => {});
    setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function back() {
    setError(null);
    if (stepIndex === 0) {
      router.back();
      return;
    }
    setStepIndex((i) => i - 1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  async function submit() {
    setSubmitting(true);
    try {
      const payload = buildPayload(draft);
      await api.saveOnboarding(payload);
      markOnboarded(payload as OnboardingProfile);
      // Warm the dashboard + recommendations while the celebrate screen plays.
      api.dashboard(payload as OnboardingProfile).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCelebrating(true);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.detail);
      } else {
        setError(e instanceof Error ? e.message : "Save failed. Try again.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  }

  if (celebrating) {
    return <CelebrateScreen name={draft.name.split(" ")[0]} onDone={() => router.replace("/(tabs)")} />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header: back, progress */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <PressableScale onPress={back} style={styles.backBtn} haptic={false}>
          <ArrowLeft color={colors.foreground} size={20} />
        </PressableScale>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.stepCount}>
          {stepIndex + 1}/{STEP_ORDER.length}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 24, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={`head-${step}`} entering={FadeInUp.duration(300)} style={{ gap: spacing.md }}>
          <View>
            <Text style={styles.title}>{meta.title}</Text>
            {meta.sub ? <Text style={styles.sub}>{meta.sub}</Text> : null}
          </View>
          <View style={styles.papaRow}>
            <Image source={require("@/assets/images/papa-avatar.png")} style={styles.papaAvatar} />
            <View style={styles.papaBubble}>
              <Text style={styles.papaText}>{meta.papa}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View key={`body-${step}`} entering={FadeInDown.duration(300)}>
          {step === "documents" ? <DocumentsStep draft={draft} update={update} /> : null}
          {step === "about" ? <AboutStep draft={draft} update={update} /> : null}
          {step === "income" ? <IncomeStep draft={draft} update={update} /> : null}
          {step === "spending" ? <SpendingStep draft={draft} update={update} /> : null}
          {step === "loans" ? <LoansStep draft={draft} update={update} /> : null}
          {step === "risk" ? <RiskStep draft={draft} update={update} /> : null}
          {step === "habits" ? <HabitsStep draft={draft} update={update} /> : null}
          {step === "goals" ? <GoalsStep draft={draft} update={update} /> : null}
          {step === "review" ? <ReviewStep draft={draft} jumpTo={jumpTo} /> : null}
        </Animated.View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + 6 }]}>
        <Button
          title={step === "review" ? "Meet your plan" : "Continue"}
          onPress={next}
          loading={submitting}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function CelebrateScreen({ name, onDone }: { name: string; onDone: () => void }) {
  return (
    <LinearGradient colors={[colors.primary, colors.primaryDeep]} style={styles.celebrate}>
      <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center", gap: spacing.md }}>
        <Text style={{ fontSize: 64 }}>🎉</Text>
        <Text style={styles.celebrateTitle}>Shabash{name ? `, ${name}` : ""}!</Text>
        <Text style={styles.celebrateSub}>
          Papa knows your money now. Your plan, your health score and your goals are ready.
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(250)} style={{ width: "100%" }}>
        <PressableScale onPress={onDone} style={styles.celebrateBtn}>
          <Text style={styles.celebrateBtnText}>Show me my money</Text>
        </PressableScale>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...heroShadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "hsl(36, 45%, 90%)",
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  stepCount: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.mutedForeground,
    minWidth: 30,
    textAlign: "right",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 13.5,
    color: colors.mutedForeground,
    marginTop: 3,
    lineHeight: 19,
  },
  papaRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  papaAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginBottom: 2,
  },
  papaBubble: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    borderBottomLeftRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  papaText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.accentForeground,
    fontWeight: "600",
  },
  error: {
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.negativeForeground,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  celebrate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 48,
  },
  celebrateTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.primaryForeground,
    letterSpacing: -0.6,
  },
  celebrateSub: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  celebrateBtn: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: "center",
  },
  celebrateBtnText: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.primary,
  },
});
