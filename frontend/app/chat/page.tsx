"use client";

import { useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

const prompts = [
  "How should I invest my monthly surplus?",
  "Am I overspending?",
  "Can I afford 2 international trips per year?",
  "How risky is my current portfolio?",
  "Can I afford a house EMI?"
];

type Message = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const profile = useAuthStore((state) => state.profile);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Ask me about cashflow, trips, goals, portfolio risk, EMIs, or recommendations. I use your saved profile when available." }
  ]);
  const [loading, setLoading] = useState(false);

  async function send(text = input) {
    if (!text.trim()) return;
    setLoading(true);
    setMessages((current) => [...current, { role: "user", content: text }]);
    setInput("");
    const response = await api.chat(text, profile);
    setMessages((current) => [...current, { role: "assistant", content: response.reply }]);
    setLoading(false);
  }

  return (
    <AppShell>
      <PageHeader title="AI Financial Assistant" subtitle="A simple-language assistant that uses your saved income, expenses, goals, risk comfort, behavior, and recommendations." badge="Profile-aware chat" />
      <div className="grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-white">Suggested prompts</p>
            <div className="mt-4 space-y-2">
              {prompts.map((prompt) => (
                <Button key={prompt} variant="outline" className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => send(prompt)}>
                  {prompt}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="min-h-[680px]">
          <CardContent className="flex min-h-[680px] flex-col p-5">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={cn("flex gap-3", message.role === "user" && "justify-end")}>
                  {message.role === "assistant" ? <Bot className="mt-1 h-5 w-5 text-primary" /> : null}
                  <div className={cn("max-w-[78%] rounded-lg p-4 text-sm leading-6", message.role === "assistant" ? "bg-white/[0.06] text-slate-200" : "bg-primary text-primary-foreground")}>
                    {message.content}
                  </div>
                  {message.role === "user" ? <User className="mt-1 h-5 w-5 text-primary" /> : null}
                </div>
              ))}
              {loading ? <div className="text-sm text-muted-foreground">Thinking through your profile...</div> : null}
            </div>
            <div className="mt-4 flex gap-3">
              <Textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your surplus, goals, portfolio risk, or spending..." className="min-h-12" />
              <Button size="icon" onClick={() => send()}><Send className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
