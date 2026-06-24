"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, MessageSquarePlus, RefreshCw, Send, ShieldCheck, Square, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ChatCardsRenderer } from "@/components/structured-chat-response";
import { PapaAvatar, type PapaMood } from "@/app/onboarding/_components/papa-bubble";
import { api } from "@/lib/api";
import { SCRIPT_FAMILY, SCRIPT_GREEN } from "@/lib/fonts";
import {
  appendMessage,
  createId,
  dropLastAssistantMessage,
  groupConversationsByDate,
  loadChatState,
  newConversation,
  saveChatState,
  type ChatMessage,
  type ChatState,
  type Conversation
} from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { useEnsureProfile } from "@/lib/use-ensure-profile";
import { useAuthStore } from "@/store/auth-store";

const STARTER_PROMPTS = [
  "Can I afford a car?",
  "Am I saving enough?",
  "Where should I invest ₹50,000?",
  "I want to get married in 6 months, what should I do?",
  "Which goal needs attention?",
  "How can I retire early?"
];

const INTRO_LINES = [
  "Arrey, come, sit. Tell me what's on your mind — money, a big purchase, a plan, anything. I'll be straight with you, beta.",
  "Acha, what's the question today? Don't hold back — money, goals, big decisions, whatever it is.",
  "Sit down, sit down. What money problem are we solving today, beta?",
  "Haan, tell me everything. What's been on your mind lately?",
  "Theek hai, I'm listening. What's the financial question, beta?",
  "What's troubling you today? Spending, saving, a big plan — tell me.",
  "Come, before you do something silly with money — tell me what you're thinking.",
  "Acha, finally you came to ask. What's on your mind, beta?",
  "Sit. Talk. I have all day for this one.",
  "So — what big decision is brewing in that head of yours today?"
];

const TIME_INTRO_LINES: Record<"morning" | "afternoon" | "evening" | "night", string[]> = {
  morning: [
    "Acha, early bird. What's the question today, beta?",
    "Good — caught you before the day swallows you. What's on your mind?",
    "Coffee in hand? Good. Now tell me what's bothering you about money.",
  ],
  afternoon: [
    "Take a break, beta. What's on your mind?",
    "Mid-day already — what's troubling you?",
    "Acha, escaped work for a minute? Tell me, what's the question?",
  ],
  evening: [
    "Long day? Now tell me what's bothering you about money, beta.",
    "Evening already. What's been on your mind today?",
    "Sit. End of the day, perfect time to think clearly. What's the question?",
  ],
  night: [
    "Still up? Must be something on your mind. Tell me, beta.",
    "Late night money thoughts — classic. What is it?",
    "Can't sleep over money worries? Talk to me.",
  ]
};

export default function ChatPage() {
  const profile = useEnsureProfile();
  const [state, setState] = useState<ChatState>({ conversations: {}, order: [], activeId: null });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate from localStorage (client-only).
  useEffect(() => {
    const initial = loadChatState();
    if (!initial.order.length) {
      const conv = newConversation();
      setState({ conversations: { [conv.id]: conv }, order: [conv.id], activeId: conv.id });
    } else {
      setState(initial);
    }
    setHydrated(true);
  }, []);

  // Persist on every change.
  useEffect(() => {
    if (!hydrated) return;
    saveChatState(state);
  }, [state, hydrated]);

  const active: Conversation | null = state.activeId ? state.conversations[state.activeId] : null;

  // Auto-scroll on new message or loading.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages.length, loading]);

  // Auto-resize input.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Stop in-flight on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const setActive = useCallback((id: string) => {
    setState((prev) => ({ ...prev, activeId: id }));
  }, []);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setErrorBanner(null);
    setState((prev) => {
      const conv = newConversation();
      return {
        conversations: { ...prev.conversations, [conv.id]: conv },
        order: [conv.id, ...prev.order],
        activeId: conv.id
      };
    });
    setInput("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setState((prev) => {
      const { [id]: _removed, ...rest } = prev.conversations;
      const nextOrder = prev.order.filter((x) => x !== id);
      let nextActive = prev.activeId;
      if (prev.activeId === id) {
        nextActive = nextOrder[0] || null;
      }
      // If we deleted the last one, spin up a fresh empty conversation.
      if (!nextOrder.length) {
        const conv = newConversation();
        return {
          conversations: { [conv.id]: conv },
          order: [conv.id],
          activeId: conv.id
        };
      }
      return { conversations: rest, order: nextOrder, activeId: nextActive };
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !active) return;
      setErrorBanner(null);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: ChatMessage = {
        id: createId(),
        role: "user",
        content: text,
        createdAt: Date.now()
      };

      // Snapshot history BEFORE the new user msg is added (server gets prior turns).
      const historyForServer = active.messages
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      // Add user message + reorder to front.
      setState((prev) => {
        const conv = prev.conversations[active.id];
        if (!conv) return prev;
        const updated = appendMessage(conv, userMsg);
        const order = [active.id, ...prev.order.filter((x) => x !== active.id)];
        return {
          ...prev,
          conversations: { ...prev.conversations, [active.id]: updated },
          order
        };
      });
      setInput("");
      setLoading(true);

      try {
        const response = await api.chat(text, profile, historyForServer, { signal: controller.signal });
        const assistantMsg: ChatMessage = {
          id: createId(),
          role: "assistant",
          content: response.reply,
          cards: response.cards,
          suggestions: response.suggestions,
          mood: response.mood,
          createdAt: Date.now()
        };
        setState((prev) => {
          const conv = prev.conversations[active.id];
          if (!conv) return prev;
          const updated = appendMessage(conv, assistantMsg);
          return {
            ...prev,
            conversations: { ...prev.conversations, [active.id]: updated }
          };
        });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          // User cancelled. No error banner.
        } else {
          const errorMsg: ChatMessage = {
            id: createId(),
            role: "assistant",
            content:
              err instanceof Error
                ? `Couldn't reach my side just now (${err.message}). Try again?`
                : "Couldn't reach my side just now. Try again?",
            createdAt: Date.now(),
            mood: "concerned",
            error: true
          };
          setState((prev) => {
            const conv = prev.conversations[active.id];
            if (!conv) return prev;
            const updated = appendMessage(conv, errorMsg);
            return { ...prev, conversations: { ...prev.conversations, [active.id]: updated } };
          });
          setErrorBanner("Connection trouble. Your message was sent — you can retry the last one.");
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setLoading(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [active, profile]
  );

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  const regenerate = useCallback(async () => {
    if (!active || loading) return;
    // Find the last user message in the active conversation.
    const lastUser = [...active.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setState((prev) => {
      const conv = prev.conversations[active.id];
      if (!conv) return prev;
      return {
        ...prev,
        conversations: { ...prev.conversations, [active.id]: dropLastAssistantMessage(conv) }
      };
    });
    // Re-run the last user message.
    await sendMessage(lastUser.content);
  }, [active, loading, sendMessage]);

  const dateGroups = useMemo(() => groupConversationsByDate(state), [state]);

  return (
    <AppShell sidebarExtra={<CoachSidebarWidget />}>
      <div className="flex h-[calc(100vh-4rem)] flex-col lg:h-[calc(100vh-5rem)]">
        <ChatHeader onNewChat={startNewChat} />
        <div className="mt-4 flex min-h-0 flex-1 gap-4">
          <ConversationsPanel
            groups={dateGroups}
            activeId={active?.id || null}
            onSelect={setActive}
            onNew={startNewChat}
            onDelete={deleteConversation}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-3xl border border-border bg-surface shadow-md">
            <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              {active && active.messages.length === 0 ? (
                <WelcomeIntro
                  profile={profile}
                  conversationId={active.id}
                  onSelectPrompt={sendMessage}
                  disabled={loading}
                />
              ) : null}
              {active?.messages.map((message, idx) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  onOption={sendMessage}
                  onCopy={() => copyToClipboard(message.content)}
                  onRegenerate={
                    !loading && idx === active.messages.length - 1 && message.role === "assistant"
                      ? regenerate
                      : undefined
                  }
                />
              ))}
              {loading ? <ThinkingBubble /> : null}
              {errorBanner ? (
                <p role="alert" className="text-xs text-warning-foreground">
                  {errorBanner}
                </p>
              ) : null}
            </div>
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => sendMessage(input)}
              onStop={cancelGeneration}
              loading={loading}
              inputRef={inputRef}
            />
          </div>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Educational guidance only — not investment advice. Your data never leaves your profile.
        </p>
      </div>
    </AppShell>
  );
}

// -----------------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------------

function ChatHeader({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <PapaAvatar avatarClass="h-16 w-16" mood="warm" ringClass="ring-2 ring-white shadow-md" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Ask Papa</h1>
          <p
            className="mt-0.5 text-lg leading-tight"
            style={{ fontFamily: SCRIPT_FAMILY, color: SCRIPT_GREEN }}
          >
            Bring your money questions. I&apos;ll bring the answers.
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={onNewChat} className="rounded-full">
        <MessageSquarePlus className="h-4 w-4" /> New chat
      </Button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Conversation list sidebar (desktop only)
// -----------------------------------------------------------------------------

function ConversationsPanel({
  groups,
  activeId,
  onSelect,
  onNew,
  onDelete
}: {
  groups: { label: string; items: Conversation[] }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col rounded-3xl border border-border bg-surface p-3 shadow-sm lg:flex">
      <Button onClick={onNew} className="mb-3 w-full justify-center gap-2 rounded-xl">
        <MessageSquarePlus className="h-4 w-4" /> New chat
      </Button>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {groups.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">Your conversations will appear here.</p>
        ) : null}
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((conv) => (
                <li key={conv.id} className="group/item relative">
                  <button
                    type="button"
                    onClick={() => onSelect(conv.id)}
                    className={cn(
                      "w-full rounded-lg px-2 py-2 pr-7 text-left text-sm transition",
                      activeId === conv.id
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-surface-hover"
                    )}
                    title={conv.title}
                  >
                    <span className="line-clamp-1">{conv.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground group-hover/item:block"
                    aria-label={`Delete ${conv.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

// -----------------------------------------------------------------------------
// Welcome intro shown for empty conversations
// -----------------------------------------------------------------------------

function WelcomeIntro({
  profile,
  conversationId,
  onSelectPrompt,
  disabled
}: {
  profile: ReturnType<typeof useAuthStore.getState>["profile"];
  conversationId: string;
  onSelectPrompt: (prompt: string) => void;
  disabled: boolean;
}) {
  const greeting = useMemo(() => timeGreeting(profile?.name), [profile?.name]);
  // Pick a fresh intro line per conversation (stable for that conversation).
  const intro = useMemo(() => pickIntroLine(conversationId), [conversationId]);
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex items-start gap-3">
        <PapaAvatar avatarClass="h-14 w-14" mood="warm" ringClass="ring-2 ring-white shadow-sm" />
        <div className="rounded-3xl border border-border bg-surface-soft px-4 py-3 text-sm leading-7 text-foreground/90 shadow-sm">
          <p className="text-[17px] leading-8 text-foreground">{greeting}</p>
          <p className="mt-2 text-[17px] leading-8 text-foreground">{intro}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-[68px]">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(prompt)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:border-primary hover:bg-accent disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Message bubbles
// -----------------------------------------------------------------------------

function ChatBubble({
  message,
  onOption,
  onCopy,
  onRegenerate
}: {
  message: ChatMessage;
  onOption: (text: string) => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
}) {
  const profile = useAuthStore((state) => state.profile);
  if (message.role === "user") {
    const initial = (profile?.name || "You").slice(0, 1).toUpperCase();
    return (
      <div className="flex flex-row-reverse gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <span className="text-sm font-semibold">{initial}</span>
        </span>
        <div className="max-w-[78%] rounded-3xl bg-primary px-4 py-3 text-primary-foreground shadow-sm">
          <p className="whitespace-pre-line text-[17px] leading-8">{message.content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="group/msg flex gap-3">
      <PapaAvatar
        avatarClass="h-14 w-14"
        mood={(message.mood as PapaMood) || "warm"}
        ringClass="ring-2 ring-white shadow-sm"
      />
      <div className="min-w-0 max-w-[88%] flex-1">
        <div
          className={cn(
            "rounded-3xl border px-4 py-3 text-sm leading-7 shadow-sm",
            message.error
              ? "border-warning/30 bg-warning-soft/30"
              : "border-border bg-surface-soft"
          )}
        >
          <p className="whitespace-pre-line text-[17px] leading-8 text-foreground">{message.content}</p>
        </div>
        {message.cards?.length ? <ChatCardsRenderer cards={message.cards} onOption={onOption} /> : null}
        {message.suggestions?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onOption(suggestion)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        {(onCopy || onRegenerate) && !message.error ? (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition group-hover/msg:opacity-100 focus-within:opacity-100">
            {onCopy ? <CopyButton onCopy={onCopy} /> : null}
            {onRegenerate ? (
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
                aria-label="Regenerate response"
              >
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CopyButton({ onCopy }: { onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        onCopy();
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
      aria-label="Copy message"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3">
      <PapaAvatar avatarClass="h-14 w-14" mood="thoughtful" ringClass="ring-2 ring-white shadow-sm" />
      <div className="rounded-3xl border border-border bg-surface-soft px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <span className="inline-flex gap-1" aria-label="Papa is thinking">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
            style={{ animationDelay: "300ms" }}
          />
        </span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Composer
// -----------------------------------------------------------------------------

function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  loading,
  inputRef
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  loading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="border-t border-border bg-surface p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ask Papa anything…  (Enter to send, Shift+Enter for a new line)"
          rows={1}
          className="min-h-12 max-h-[200px] flex-1 resize-none rounded-2xl border-0 bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (loading) onStop();
              else onSend();
            }
            if (event.key === "Escape" && loading) {
              event.preventDefault();
              onStop();
            }
          }}
        />
        {loading ? (
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-full"
            onClick={onStop}
            aria-label="Stop generating"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={onSend}
            disabled={!value.trim()}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sidebar widget in AppShell
// -----------------------------------------------------------------------------

function CoachSidebarWidget() {
  const profile = useAuthStore((state) => state.profile);
  return (
    <div className="rounded-2xl border border-positive-soft bg-positive-soft/40 p-4 shadow-sm">
      <p className="text-sm font-semibold text-foreground">Papa is listening</p>
      <p
        className="mt-1 text-[17px] leading-snug"
        style={{ fontFamily: SCRIPT_FAMILY, color: SCRIPT_GREEN }}
      >
        Ask anything. About money, life, both.
      </p>
      {profile ? (
        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-muted-foreground shadow-sm">
          <p className="font-semibold text-foreground">Profile loaded</p>
          <p className="mt-0.5">Goals: {profile.goals?.length || 0}</p>
          <p>EMIs: {(profile.emiLoans || []).length}</p>
        </div>
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function timeGreeting(name?: string | null): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const first = (name || "").trim().split(/\s+/)[0];
  if (first) {
    return `Good ${part}, ${first} Beta.`;
  }
  return `Good ${part}, Beta.`;
}

function copyToClipboard(text: string) {
  if (typeof navigator === "undefined") return;
  try {
    navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

function pickIntroLine(conversationId: string): string {
  const hour = new Date().getHours();
  const timeBucket: "morning" | "afternoon" | "evening" | "night" =
    hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : hour < 22 ? "evening" : "night";
  // Mix the time-of-day pool with the generic pool so we always have variety.
  const pool = [...TIME_INTRO_LINES[timeBucket], ...INTRO_LINES];
  // Pick a stable line per conversation so it doesn't flicker on re-render.
  const seed = hashString(conversationId);
  return pool[seed % pool.length];
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
