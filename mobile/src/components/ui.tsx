import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";
import { colors, cardShadow, radius, spacing } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable that shrinks slightly under the finger and ticks a light haptic.
 * The base tactile unit of the app: everything tappable goes through this.
 */
export function PressableScale({ children, onPress, haptic = true, style, ...rest }: PressableProps & { haptic?: boolean }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPressIn={() => (scale.value = withSpring(0.96, { damping: 18, stiffness: 400 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 18, stiffness: 400 }))}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={[animatedStyle, style as ViewStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ children, size = 22, style }: { children: React.ReactNode; size?: number; style?: object }) {
  return <Text style={[styles.heading, { fontSize: size, lineHeight: size * 1.25 }, style]}>{children}</Text>;
}

export function Body({ children, muted = false, size = 14, style }: { children: React.ReactNode; muted?: boolean; size?: number; style?: object }) {
  return (
    <Text style={[{ fontSize: size, lineHeight: size * 1.5, color: muted ? colors.mutedForeground : colors.foreground }, style]}>
      {children}
    </Text>
  );
}

/** Small bold section label above content groups, native list-header style. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost" | "danger";
}) {
  const palette =
    variant === "primary"
      ? { bg: colors.primary, fg: colors.primaryForeground }
      : variant === "danger"
        ? { bg: colors.negativeSoft, fg: colors.negativeForeground }
        : { bg: colors.surfaceSoft, fg: colors.foreground };
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { backgroundColor: palette.bg }, (disabled || loading) && { opacity: 0.55 }]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
      )}
    </PressableScale>
  );
}

/** Filled input, no hard border. A green ring appears on focus. */
export function Field(props: TextInputProps & { label: string; error?: string }) {
  const { label, error, ...rest } = props;
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={"hsl(222, 12%, 62%)"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.fieldInput,
          focused && { borderColor: colors.primary, backgroundColor: colors.surface },
          error ? { borderColor: colors.destructive } : null,
        ]}
        {...rest}
      />
      {error ? <Text style={{ color: colors.negativeForeground, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

export function Pill({ label, tone = "accent" }: { label: string; tone?: "accent" | "warning" | "negative" }) {
  const bg = tone === "accent" ? colors.accent : tone === "warning" ? colors.warningSoft : colors.negativeSoft;
  const fg = tone === "accent" ? colors.accentForeground : tone === "warning" ? colors.warningForeground : colors.negativeForeground;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

/** Circular health score ring. Color follows the score band. */
export function ScoreRing({ score, size = 84 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = clamped >= 70 ? colors.primary : clamped >= 45 ? colors.warning : colors.negative;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceSoft} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - clamped / 100)}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: size * 0.3, fontWeight: "900", color: colors.foreground }}>{clamped}</Text>
        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.mutedForeground, marginTop: -2 }}>of 100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius["2xl"],
    padding: spacing.lg,
    ...cardShadow,
  },
  heading: {
    fontWeight: "800",
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  button: {
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "800",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: "hsl(36, 45%, 93%)",
  },
});
