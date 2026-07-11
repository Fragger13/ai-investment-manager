import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ArrowUp } from "lucide-react-native";
import { PressableScale } from "@/components/ui";
import { cardShadow, colors, radius, spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { ChatCard } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: ChatCard[];
};

const OPENERS = [
  { emoji: "🪙", text: "Am I saving enough?" },
  { emoji: "🌱", text: "Where should I start investing?" },
  { emoji: "📈", text: "How is my money doing?" },
];

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0.35);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.35, { duration: 320 })), -1));
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 3 }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

function TypingBubble() {
  return (
    <View style={styles.papaRow}>
      <Image source={require("@/assets/images/papa-avatar.png")} style={styles.bubbleAvatar} />
      <View style={[styles.bubble, styles.bubblePapa, { flexDirection: "row", gap: 5, paddingVertical: 14 }]}>
        <Dot delay={0} />
        <Dot delay={140} />
        <Dot delay={280} />
      </View>
    </View>
  );
}

export default function PapaScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const listRef = useRef<FlatList<Message>>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setBusy(true);
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const response = await api.chat(trimmed, profile, history);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: response.reply, cards: response.cards },
      ]);
      setSuggestions(response.suggestions?.length ? response.suggestions.slice(0, 3) : []);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "Papa could not reach the server just now. Check your connection and ask again.",
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <Image source={require("@/assets/images/papa-avatar.png")} style={styles.headerAvatar} />
          <View style={styles.onlineDot} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Papa</Text>
          <Text style={styles.headerSub}>Knows your numbers. Judges lovingly.</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image source={require("@/assets/images/papa-avatar.png")} style={styles.emptyAvatar} />
            <Text style={styles.emptyTitle}>Ask me anything about money</Text>
            <Text style={styles.emptySub}>I answer with your real numbers in mind, beta.</Text>
            <View style={{ marginTop: spacing.xl, gap: spacing.sm, width: "100%" }}>
              {OPENERS.map((o, i) => (
                <Animated.View key={o.text} entering={FadeInDown.duration(400).delay(i * 90)}>
                  <PressableScale onPress={() => send(o.text)} style={styles.openerCard}>
                    <Text style={{ fontSize: 20 }}>{o.emoji}</Text>
                    <Text style={styles.openerText}>{o.text}</Text>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={busy ? <TypingBubble /> : null}
        renderItem={({ item }) => (
          <Animated.View entering={FadeInDown.duration(300)} style={{ gap: spacing.sm }}>
            {item.role === "user" ? (
              <View style={[styles.bubble, styles.bubbleUser]}>
                <Text style={styles.bubbleUserText}>{item.content}</Text>
              </View>
            ) : (
              <View style={styles.papaRow}>
                <Image source={require("@/assets/images/papa-avatar.png")} style={styles.bubbleAvatar} />
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <View style={[styles.bubble, styles.bubblePapa]}>
                    <Text style={styles.bubblePapaText}>{item.content}</Text>
                  </View>
                  {item.cards?.map((card, i) =>
                    card.type === "metrics" && card.metrics?.length ? (
                      <View key={i} style={styles.metricsCard}>
                        {card.intro ? <Text style={styles.metricsIntro}>{card.intro}</Text> : null}
                        {card.metrics.map((m, j) => (
                          <View key={j} style={styles.metricRow}>
                            <Text style={styles.metricLabel}>{m.label}</Text>
                            <Text style={styles.metricValue}>{formatINR(m.amount)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null
                  )}
                </View>
              </View>
            )}
          </Animated.View>
        )}
      />

      {/* Follow-up suggestions */}
      {suggestions.length > 0 && !busy && messages.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
        >
          {suggestions.map((s) => (
            <PressableScale key={s} onPress={() => send(s)} style={styles.suggestionChip}>
              <Text style={styles.suggestionText}>{s}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + 4 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask Papa about your money"
          placeholderTextColor={"hsl(222, 12%, 62%)"}
          style={styles.input}
          multiline
          onSubmitEditing={() => send(input)}
        />
        <PressableScale
          onPress={() => send(input)}
          disabled={busy || !input.trim()}
          style={[styles.sendBtn, (busy || !input.trim()) && { opacity: 0.35 }]}
        >
          <ArrowUp color={colors.primaryForeground} size={20} strokeWidth={2.6} />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.positive,
    borderWidth: 2,
    borderColor: colors.background,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: colors.foreground, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: colors.mutedForeground },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  emptyAvatar: { width: 76, height: 76, borderRadius: 38, marginBottom: spacing.md },
  emptyTitle: { fontSize: 19, fontWeight: "800", color: colors.foreground, letterSpacing: -0.3 },
  emptySub: { fontSize: 13.5, color: colors.mutedForeground, marginTop: 4 },
  openerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    ...cardShadow,
  },
  openerText: { fontSize: 15, fontWeight: "700", color: colors.foreground, flex: 1 },
  papaRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-end", maxWidth: "92%" },
  bubbleAvatar: { width: 26, height: 26, borderRadius: 13, marginBottom: 2 },
  bubble: { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11 },
  bubbleUser: { alignSelf: "flex-end", maxWidth: "86%", backgroundColor: colors.primary, borderBottomRightRadius: 8 },
  bubblePapa: { alignSelf: "flex-start", backgroundColor: colors.surface, borderBottomLeftRadius: 8, ...cardShadow },
  bubbleUserText: { color: colors.primaryForeground, fontSize: 15.5, lineHeight: 22 },
  bubblePapaText: { color: colors.foreground, fontSize: 15.5, lineHeight: 23 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.mutedForeground },
  metricsCard: {
    alignSelf: "stretch",
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: 8,
  },
  metricsIntro: { fontSize: 12, fontWeight: "800", color: colors.accentForeground, textTransform: "uppercase", letterSpacing: 0.5 },
  metricRow: { flexDirection: "row", justifyContent: "space-between" },
  metricLabel: { fontSize: 13.5, color: colors.accentForeground },
  metricValue: { fontSize: 13.5, fontWeight: "800", color: colors.accentForeground },
  suggestionChip: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...cardShadow,
  },
  suggestionText: { fontSize: 13, fontWeight: "700", color: colors.accentForeground },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15.5,
    color: colors.foreground,
    backgroundColor: colors.surface,
    ...cardShadow,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow,
  },
});
