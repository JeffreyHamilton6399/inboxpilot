"use client";

import * as React from "react";
import { Send, Trash2, Loader2, ArrowUpRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { useEmails } from "@/lib/use-emails";
import { SUGGESTED_CHAT_PROMPTS } from "@/lib/defaults";
import { buildInboxContext } from "@/lib/inbox-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

/**
 * The markdown an answer is allowed to be, kept legible at 14px. Written as
 * element selectors rather than `prose` classes because the typography plugin
 * is not installed here — those classes were doing nothing at all.
 */
const PROSE =
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_pre]:my-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-foreground [&_strong]:font-semibold [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_a]:text-primary [&_a]:underline";

export function ChatView() {
  const chat = useStore((s) => s.chat);
  const addChat = useStore((s) => s.addChat);
  const appendChat = useStore((s) => s.appendChat);
  const clearChat = useStore((s) => s.clearChat);
  const chatBusy = useStore((s) => s.chatBusy);
  const setChatBusy = useStore((s) => s.setChatBusy);
  const { emails } = useEmails();
  const { toast } = useToast();

  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const grounded = Boolean(emails && emails.length > 0);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || chatBusy) return;

    const userMsg = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content,
      at: new Date().toISOString(),
    };
    const aiId = crypto.randomUUID();
    const aiMsg = {
      id: aiId,
      role: "assistant" as const,
      content: "",
      at: new Date().toISOString(),
    };
    addChat(userMsg);
    addChat(aiMsg);
    setChatBusy(true);
    setInput("");

    const history = [...chat, userMsg].map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    // Everything loaded, newest first, with the arrival times and read state
    // that questions about waiting and recency actually turn on. Ranking the
    // top twelve by a local heuristic threw away exactly the messages that
    // "what has been sitting here longest" needed, and carried no dates at all.
    const context = emails ? buildInboxContext(emails, { now: new Date() }) : "";

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history,
          context: context || undefined,
          // The reader's clock, not the server's: "today" is a question about
          // where they are sitting.
          now: new Date().toISOString(),
        }),
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b py-2.5">
        <div className="mx-auto flex h-7 max-w-2xl items-center justify-between px-5 sm:px-6">
          <p className="eyebrow">
            {grounded ? "Grounded in your inbox" : "No mail loaded"}
          </p>
          {chat.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground"
              onClick={clearChat}
              disabled={chatBusy}
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-2xl px-5 py-8 sm:px-6">
          {chat.length === 0 ? (
            <div>
              <h2 className="display text-3xl sm:text-4xl">Ask about your mail.</h2>
              <p className="measure mt-3 text-sm leading-relaxed text-muted-foreground">
                Answers are drawn from the messages actually in your inbox, and name which ones.
                {!grounded && " Connect Gmail first, or these will be guesses."}
              </p>

              <ul className="mt-8">
                {SUGGESTED_CHAT_PROMPTS.map((p) => (
                  <li key={p} className="rule-top first:border-t-0">
                    <button
                      onClick={() => send(p)}
                      className="group flex w-full items-center gap-3 py-3 text-left text-sm transition-colors hover:text-primary"
                    >
                      <span className="flex-1">{p}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            /* No robot avatar beside every line. The question is short and
               belongs to you, so it sits right and tinted; the answer is long
               and belongs to the page, so it is set as prose across it. */
            <div className="space-y-6">
              {chat.map((m, i) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-xl rounded-br-sm bg-secondary px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div key={m.id} className="animate-fade-in-fast">
                    <p className="eyebrow">InboxPilot</p>
                    <div className="mt-2.5 text-sm leading-relaxed">
                      {m.content ? (
                        <div className={PROSE}>
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking…
                        </span>
                      )}
                      {chatBusy && i === chat.length - 1 && m.content && (
                        <span className="typing-cursor" />
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t bg-background py-3">
        <div className="mx-auto flex max-w-2xl items-end gap-2 px-5 sm:px-6">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about your inbox…"
            className={cn("max-h-40 min-h-[42px] resize-none")}
            rows={1}
          />
          {chatBusy ? (
            <Button variant="outline" onClick={stop} className="h-[42px]">
              Stop
            </Button>
          ) : (
            <Button
              className="h-[42px] px-4"
              onClick={() => send(input)}
              disabled={!input.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mx-auto mt-2 max-w-2xl px-5 text-[11px] text-muted-foreground sm:px-6">
          Enter sends · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
