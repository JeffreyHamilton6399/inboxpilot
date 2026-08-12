import "server-only";

import ZAI from "z-ai-web-dev-sdk";

/**
 * Unified AI layer for InboxPilot.
 *
 * Primary: built-in z-ai-web-dev-sdk (works with zero configuration, no key).
 * Optional: xAI Grok when GROK_API_KEY is set AND valid.
 *
 * If Grok is configured but fails (bad key, no credits, wrong model), we
 * silently fall back to the built-in SDK so the app keeps working.
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

// Lazy-init z-ai SDK; may fail if no config file exists (e.g. on Vercel).
let zaiPromise: Promise<unknown> | null = null;
let zaiAvailable: boolean | null = null;
async function getZai() {
  if (zaiAvailable === false) return null;
  if (!zaiPromise) {
    zaiPromise = ZAI.create().catch((err) => {
      console.error("[ai] z-ai SDK init failed:", String(err));
      zaiAvailable = false;
      return null;
    });
  }
  const zai = await zaiPromise;
  if (zai) zaiAvailable = true;
  return zai as Awaited<ReturnType<typeof ZAI.create>> | null;
}

export function getProvider(): {
  provider: "grok" | "zai" | "none";
  model: string;
  ready: boolean;
} {
  if (GROK_KEY) return { provider: "grok", model: GROK_MODEL, ready: true };
  return { provider: "zai", model: "built-in", ready: true };
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
  if (!zai) throw new Error("Built-in AI unavailable");
  const mapped = messages.map((m) =>
    m.role === "system" ? { role: "assistant" as const, content: m.content } : m
  );
  void opts;
  const completion = await zai.chat.completions.create({
    messages: mapped,
    thinking: { type: "disabled" },
  });
  return completion.choices[0]?.message?.content ?? "";
}

async function tryGrok(messages: ChatMsg[], opts: ChatOpts): Promise<string | null> {
  if (!GROK_KEY) return null;
  try {
    const res = await grokChat(messages, opts, false);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Grok HTTP ${res.status}: ${body.slice(0, 150)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content) return content as string;
    throw new Error("Grok returned empty response");
  } catch (err) {
    console.error("[ai] grok failed, falling back to built-in:", String(err));
    return null;
  }
}

// --- Public API ---

/** Non-streaming chat completion. Returns the full text. */
export async function chat(messages: ChatMsg[], opts: ChatOpts = {}): Promise<string> {
  // Try Grok first (if configured), then fall back to built-in z-ai SDK.
  const grokResult = await tryGrok(messages, opts);
  if (grokResult !== null) return grokResult;
  return zaiChat(messages, opts);
}

/**
 * Streaming chat completion. Yields incremental text chunks.
 */
export async function* chatStream(
  messages: ChatMsg[],
  opts: ChatOpts = {}
): AsyncGenerator<string, void, unknown> {
  // Try Grok streaming first
  if (GROK_KEY) {
    try {
      const res = await grokChat(messages, opts, true);
      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        throw new Error(`Grok HTTP ${res.status}: ${body.slice(0, 150)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let yielded = false;
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
            if (delta) {
              yielded = true;
              yield delta as string;
            }
          } catch {
            // ignore keep-alive / partial
          }
        }
      }
      if (yielded) return;
      // If we got here with no yielded content, fall through to z-ai
      console.error("[ai] grok stream yielded nothing, falling back to built-in");
    } catch (err) {
      console.error("[ai] grok stream failed, falling back to built-in:", String(err));
    }
  }
  // z-ai fallback: fetch full text, then simulate streaming
  const full = await zaiChat(messages, opts);
  const tokens = full.match(/\S+\s*/g) ?? [full];
  for (const t of tokens) {
    yield t;
    await new Promise((r) => setTimeout(r, 12));
  }
}

/** Convenience: ask for JSON output (best-effort parse). */
export async function chatJSON<T = unknown>(
  messages: ChatMsg[],
  opts: ChatOpts = {}
): Promise<T> {
  const text = await chat(messages, opts);
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
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
