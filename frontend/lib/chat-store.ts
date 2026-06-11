import type { ChatCard } from "@/lib/api";

const STORAGE_KEY = "askpapa_chat_v1";
const ACTIVE_KEY = "askpapa_chat_active_v1";

export type ChatMessageRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  cards?: ChatCard[];
  suggestions?: string[];
  mood?: string;
  createdAt: number;
  error?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type ChatState = {
  conversations: Record<string, Conversation>;
  order: string[]; // newest first
  activeId: string | null;
};

const EMPTY_STATE: ChatState = {
  conversations: {},
  order: [],
  activeId: null
};

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadChatState(): ChatState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const activeId = window.localStorage.getItem(ACTIVE_KEY);
    if (!raw) return { ...EMPTY_STATE, activeId };
    const parsed = JSON.parse(raw) as Pick<ChatState, "conversations" | "order">;
    if (!parsed || typeof parsed !== "object" || !parsed.conversations) return EMPTY_STATE;
    const order = Array.isArray(parsed.order) && parsed.order.length
      ? parsed.order.filter((id) => id in parsed.conversations)
      : Object.values(parsed.conversations)
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
          .map((c) => c.id);
    return {
      conversations: parsed.conversations,
      order,
      activeId: activeId && activeId in parsed.conversations ? activeId : (order[0] || null)
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveChatState(state: ChatState): void {
  if (typeof window === "undefined") return;
  try {
    const minimal = { conversations: state.conversations, order: state.order };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
    if (state.activeId) {
      window.localStorage.setItem(ACTIVE_KEY, state.activeId);
    } else {
      window.localStorage.removeItem(ACTIVE_KEY);
    }
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded). Silent.
  }
}

export function newConversation(now: number = Date.now()): Conversation {
  return {
    id: createId(),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now
  };
}

export function appendMessage(conversation: Conversation, message: ChatMessage): Conversation {
  const messages = [...conversation.messages, message];
  const firstUser = messages.find((m) => m.role === "user");
  const derivedTitle =
    conversation.title === "New chat" && firstUser
      ? truncate(firstUser.content, 48)
      : conversation.title;
  return {
    ...conversation,
    title: derivedTitle,
    messages,
    updatedAt: message.createdAt
  };
}

export function replaceMessage(conversation: Conversation, messageId: string, next: ChatMessage): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((m) => (m.id === messageId ? next : m)),
    updatedAt: next.createdAt
  };
}

export function dropLastAssistantMessage(conversation: Conversation): Conversation {
  const messages = [...conversation.messages];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "assistant") {
      messages.splice(i, 1);
      break;
    }
  }
  return { ...conversation, messages, updatedAt: Date.now() };
}

export function groupConversationsByDate(state: ChatState): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Earlier: []
  };

  state.order.forEach((id) => {
    const conv = state.conversations[id];
    if (!conv) return;
    if (conv.updatedAt >= startOfToday) groups.Today.push(conv);
    else if (conv.updatedAt >= startOfYesterday) groups.Yesterday.push(conv);
    else if (conv.updatedAt >= startOfWeek) groups["This week"].push(conv);
    else groups.Earlier.push(conv);
  });

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function truncate(value: string, max: number): string {
  const v = value.trim().replace(/\s+/g, " ");
  if (v.length <= max) return v;
  return `${v.slice(0, max).trimEnd()}…`;
}
