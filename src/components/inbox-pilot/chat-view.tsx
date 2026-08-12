"use client";

import * as React from "react";
import {
  Send,
  Sparkles,
  Trash2,
  Loader2,
  Bot,
  User as UserIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useEmails } from "@/lib/use-emails";
import { SUGGESTED_CHAT_PROMPTS, CATEGORY_MAP } from "@/lib/sample-data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function ChatView() {
  const chat = useStore((s) => s.chat);
  const addChat = useStore((s) => s.addChat);
  const appendChat = useStore((s) => s.appendChat);
  const clearChat = useStore((s) => s.clearChat);
  const chatBusy = useStore((s) => s.chatBusy);
  const setChatBusy = useStore((s) => s.setChatBusy);
  const { data: emails } = useEmails();
  const { toast } = useToast();

  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || chatBusy) return;

    const userMsg = { id: crypto.randomUUID(), role: "user" as const, content, at: new Date().toISOString() };
    const aiId = crypto.randomUUID();
    const aiMsg = { id: aiId, role: "assistant" as const, content: "", at: new Date().toISOString() };
    addChat(userMsg);
    addChat(aiMsg);
    setChatBusy(true);
    setInput("");

    const history = [...chat, userMsg].map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    // Build context from the real inbox (if connected).
    let context = "";
    if (emails && emails.length > 0) {
      const ranked = [...emails].sort((a, b) => {
        const score = (e: (typeof emails)[number]) => (e.category === "to-respond" ? 4 : 0) + (e.unread ? 2 : 0) + (e.starred ? 1 : 0);
        return score(b) - score(a);
      });
      context = ranked.slice(0, 12).map((e) => `• from ${e.from.name} <${e.from.email}> | category: ${CATEGORY_MAP[e.category].label} | subject: ${e.subject} | preview: ${e.preview}`).join("\n");
    }

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history, context: context || undefined }),
        signal: controller.signal,
      });
      if (res.status === 401) {
        appendChat(aiId, "Please log in to use the AI.");
        setChatBusy(false);
        return;
      }
      if (!res.ok || !res.body) throw new Error("chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) appendChat(aiId, chunk);
      }
      if (!emails || emails.length === 0) {
        appendChat(aiId, "\n\n_(Connect your Gmail in the Inbox tab for inbox-aware answers.)_");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        appendChat(aiId, "\n\n[stopped]");
      } else {
        appendChat(aiId, `Sorry — I couldn't reach the AI. (${String(e)})`);
        toast({ title: "Chat error", description: String(e), variant: "destructive" });
      }
    } finally {
      setChatBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          {emails && emails.length > 0 ? "Grounded in your live inbox · streaming" : "General AI · connect Gmail for inbox context"}
        </div>
        {chat.length > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={clearChat} disabled={chatBusy}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin min-h-0">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
          {chat.length === 0 ? (
            <div className="text-center py-10">
              <div className="h-14 w-14 rounded-2xl brand-gradient mx-auto flex items-center justify-center mb-4">
                <Bot className="h-7 w-7 text-white" />
              </div>
              <h3 className="font-semibold text-lg">Chat with your inbox</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Ask about who you need to reply to, summarize a thread, or draft a follow-up.
                {(!emails || emails.length === 0) && " Connect Gmail first for inbox-aware answers."}
              </p>
              <div className="mt-6 grid sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                {SUGGESTED_CHAT_PROMPTS.map((p) => (
                  <button key={p} onClick={() => send(p)} className="text-left text-sm rounded-lg border bg-card px-3 py-2.5 hover:border-primary/40 hover:bg-muted/40 transition-colors">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chat.map((m) => (
              <div key={m.id} className={cn("flex gap-3 animate-fade-in", m.role === "user" && "flex-row-reverse")}>
                <span className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white", m.role === "user" ? "bg-muted-foreground" : "brand-gradient")}>
                  {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </span>
                <div className={cn("rounded-2xl px-4 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap leading-relaxed", m.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm")}>
                  {m.content || (
                    <span className="inline-flex gap-1 items-center text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> thinking…
                    </span>
                  )}
                  {chatBusy && m.role === "assistant" && m.id === chat[chat.length - 1].id && m.content && <span className="typing-cursor" />}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border-t bg-background p-3 shrink-0">
        <div className="mx-auto max-w-3xl flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about your inbox…  (Enter to send, Shift+Enter for newline)"
            className="min-h-[44px] max-h-40 resize-none"
            rows={1}
          />
          {chatBusy ? (
            <Button variant="outline" onClick={stop} className="h-11">Stop</Button>
          ) : (
            <Button className="brand-gradient text-white h-11 px-4" onClick={() => send(input)} disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
