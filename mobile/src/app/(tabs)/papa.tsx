import { useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SendHorizonal } from "lucide-react-native";
import { colors, radius, spacing } from "@/constants/theme";
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

const OPENERS = ["Am I saving enough?", "Where should I start investing?", "How is my money doing?"];

export default function PapaScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(OPENERS);
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
        <Image source={require("@/assets/images/papa-avatar.png")} style={styles.headerAvatar} />
        <View>
          <Text style={styles.headerTitle}>Ask Papa!</Text>
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
            <Text style={styles.emptyTitle}>Ask anything about money</Text>
            <Text style={styles.emptySub}>Papa answers with your real numbers in mind.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ gap: spacing.sm }}>
            <View style={[styles.bubble, item.role === "user" ? styles.bubbleUser : styles.bubblePapa]}>
              <Text style={item.role === "user" ? styles.bubbleUserText : styles.bubblePapaText}>{item.content}</Text>
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
        )}
      />

      {/* Suggestions */}
      {suggestions.length > 0 && !busy ? (
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <Pressable key={s} onPress={() => send(s)} style={styles.suggestionChip}>
              <Text style={styles.suggestionText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {busy ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: 6 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Papa is thinking…</Text>
        </View>
      ) : null}

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask Papa about your money…"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          multiline
          onSubmitEditing={() => send(input)}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={busy || !input.trim()}
          style={[styles.sendBtn, (busy || !input.trim()) && { opacity: 0.4 }]}
        >
          <SendHorizonal color={colors.primaryForeground} size={18} />
        </Pressable>
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.foreground },
  headerSub: { fontSize: 11, color: colors.mutedForeground },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.foreground },
  emptySub: { fontSize: 13, color: colors.mutedForeground },
  bubble: { maxWidth: "86%", borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: colors.primary },
  bubblePapa: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleUserText: { color: colors.primaryForeground, fontSize: 15, lineHeight: 21 },
  bubblePapaText: { color: colors.foreground, fontSize: 15, lineHeight: 22 },
  metricsCard: {
    alignSelf: "flex-start",
    minWidth: "70%",
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  metricsIntro: { fontSize: 12, fontWeight: "700", color: colors.accentForeground },
  metricRow: { flexDirection: "row", justifyContent: "space-between" },
  metricLabel: { fontSize: 13, color: colors.accentForeground },
  metricValue: { fontSize: 13, fontWeight: "800", color: colors.accentForeground },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  suggestionChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestionText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
