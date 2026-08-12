import "server-only";

import ZAI from "z-ai-web-dev-sdk";

/**
 * Unified AI layer for InboxPilot.
 *
 * - Uses xAI Grok when GROK_API_KEY is configured (OpenAI-compatible API).
 * - Falls back to the built-in z-ai-web-dev-sdk (no key required) otherwise.
 * - If a Grok call fails (bad model, quota, network), we transparently fall
 *   back to the z-ai SDK so the app keeps working.
 *
 * Everything here is server-side only.
 */

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOpts {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

const GROK_KEY = process.env.GROK_API_KEY?.trim();
const GROK_MODEL = process.env.GROK_MODEL?.trim() || "grok-2-latest";
const GROK_ENDPOINT = "https://api.x.ai/v1/chat/completions";

let zaiPromise: Promise<unknown> | null = null;
async function getZai() {
  if (!zaiPromise) zaiPromise = ZAI.create();
  return zaiPromise as Promise<Awaited<ReturnType<typeof ZAI.create>>>;
}

export function getProvider(): {
  provider: "grok" | "zai";
  model: string;
  ready: boolean;
} {
  if (GROK_KEY) return { provider: "grok", model: GROK_MODEL, ready: true };
  return { provider: "zai", model: "z-ai-web-dev-sdk", ready: true };
}

// --- Grok helpers ---

async function grokChat(
  messages: ChatMsg[],
  opts: ChatOpts = {},
  stream = false
): Promise<Response> {
  return fetch(GROK_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROK_KEY}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1024,
      stream,
    }),
    signal: opts.signal,
  });
}

// --- z-ai SDK helpers (OpenAI-compatible surface) ---

async function zaiChat(messages: ChatMsg[], opts: ChatOpts = {}): Promise<string> {
  const zai = await getZai();
  // The z-ai SDK uses the "assistant" role for system instructions.
  const mapped = messages.map((m) =>
    m.role === "system" ? { role: "assistant" as const, content: m.content } : m
  );
  void opts; // z-ai fallback ignores temperature/max_tokens; Grok path honors them.
  const completion = await zai.chat.completions.create({
    messages: mapped,
    thinking: { type: "disabled" },
  });
  return completion.choices[0]?.message?.content ?? "";
}

// --- Public API ---

/** Non-streaming chat completion. Returns the full text. */
export async function chat(messages: ChatMsg[], opts: ChatOpts = {}): Promise<string> {
  if (GROK_KEY) {
    try {
      const res = await grokChat(messages, opts, false);
      if (!res.ok) {
        throw new Error(`grok http ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      return data?.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      console.error("[ai] grok failed, falling back to z-ai:", String(err));
    }
  }
  return zaiChat(messages, opts);
}

/**
 * Streaming chat completion. Yields incremental text chunks.
 * For Grok we parse SSE; for z-ai we fetch the full text then simulate a stream
 * (word-by-word) so the UI experience is consistent.
 */
export async function* chatStream(
  messages: ChatMsg[],
  opts: ChatOpts = {}
): AsyncGenerator<string, void, unknown> {
  if (GROK_KEY) {
    try {
      const res = await grokChat(messages, opts, true);
      if (!res.ok || !res.body) {
        throw new Error(`grok http ${res.status}: ${await res.text()}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) yield delta as string;
          } catch {
            // ignore keep-alive / partial
          }
        }
      }
      return;
    } catch (err) {
      console.error("[ai] grok stream failed, falling back to z-ai:", String(err));
    }
  }
  // z-ai fallback: fetch full text, then simulate streaming.
  const full = await zaiChat(messages, opts);
  const tokens = full.match(/\S+\s*/g) ?? [full];
  for (const t of tokens) {
    yield t;
    // small delay for UX; abortable between yields
    await new Promise((r) => setTimeout(r, 12));
  }
}

/** Convenience: ask for JSON output (best-effort parse). */
export async function chatJSON<T = unknown>(
  messages: ChatMsg[],
  opts: ChatOpts = {}
): Promise<T> {
  const text = await chat(messages, opts);
  // strip code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // try to find the first {...} or [...]
    const match = cleaned.match(/[{[][\s\S]*[}\]]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* ignore */
      }
    }
    throw new Error("AI did not return valid JSON");
  }
}
