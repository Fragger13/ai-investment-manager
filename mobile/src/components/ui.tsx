import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { colors, cardShadow, radius, spacing } from "@/constants/theme";

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ children, size = 22 }: { children: React.ReactNode; size?: number }) {
  return <Text style={[styles.heading, { fontSize: size, lineHeight: size * 1.25 }]}>{children}</Text>;
}

export function Body({ children, muted = false, size = 14, style }: { children: React.ReactNode; muted?: boolean; size?: number; style?: object }) {
  return (
    <Text style={[{ fontSize: size, lineHeight: size * 1.45, color: muted ? colors.mutedForeground : colors.foreground }, style]}>
      {children}
    </Text>
  );
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
  variant?: "primary" | "ghost";
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonGhost,
        (disabled || loading) && { opacity: 0.55 },
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.primaryForeground : colors.primary} />
      ) : (
        <Text style={[styles.buttonText, { color: isPrimary ? colors.primaryForeground : colors.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string; error?: string }) {
  const { label, error, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={[styles.fieldInput, error ? { borderColor: colors.destructive } : null]}
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...cardShadow,
  },
  heading: {
    fontWeight: "800",
    color: colors.foreground,
  },
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
});
