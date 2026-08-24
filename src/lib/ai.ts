import "server-only";

/**
 * The AI layer. One provider, one code path, server-side only.
 *
 * InboxPilot talks to any OpenAI-compatible `/chat/completions` endpoint —
 * Groq, xAI, OpenAI, Together, or a local llama.cpp/Ollama server. Point
 * AI_BASE_URL at the one you want and give it a key.
 *
 * There is deliberately no fallback provider. A silent fallback turns a
 * misconfigured key into subtly worse answers instead of an error, which is
 * the harder failure to debug of the two.
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

export interface ProviderInfo {
  /** Host of the configured endpoint, e.g. "api.groq.com". */
  host: string;
  model: string;
  ready: boolean;
}

const BASE_URL = (process.env.AI_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const API_KEY = process.env.AI_API_KEY?.trim() ?? "";
const MODEL = process.env.AI_MODEL?.trim() || "openai/gpt-oss-120b";

/**
 * Reasoning models spend their token budget thinking before they answer, and
 * a budget sized for an email reply is one they can exhaust entirely — leaving
 * an empty completion. Sent only when set, because providers that have never
 * heard of the parameter reject the request outright.
 */
const REASONING_EFFORT = process.env.AI_REASONING_EFFORT?.trim() ?? "";

/**
 * Some open models emit their scratchpad into the reply as a <think> block.
 * Nobody wants that pasted into an email, so it is stripped on the way out.
 */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trimStart();
}

/** Thrown when AI is unconfigured or the upstream call fails. Routes map this to a 503. */
export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

/**
 * Map a thrown error to a status and a message safe to show the user.
 * AIError messages are written to be read by whoever deployed the app, so they
 * pass through; anything else could carry internals and is replaced.
 */
export function aiFailure(err: unknown): { status: number; message: string } {
  if (err instanceof AIError) return { status: 503, message: err.message };
  return { status: 500, message: "Something went wrong handling that request." };
}

export function getProvider(): ProviderInfo {
  let host = BASE_URL;
  try {
    host = new URL(BASE_URL).host;
  } catch {
    // Leave the raw string; an invalid URL is surfaced by the first request.
  }
  return { host, model: MODEL, ready: Boolean(API_KEY) };
}

async function post(messages: ChatMsg[], opts: ChatOpts, stream: boolean): Promise<Response> {
  if (!API_KEY) {
    throw new AIError("AI is not configured. Set AI_API_KEY (and optionally AI_BASE_URL and AI_MODEL).");
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        stream,
        ...(REASONING_EFFORT ? { reasoning_effort: REASONING_EFFORT } : {}),
      }),
      signal: opts.signal,
    });
  } catch (err) {
    throw new AIError(`Could not reach ${getProvider().host}: ${String(err)}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AIError(`${getProvider().host} returned ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

/** Non-streaming completion. Returns the full text. */
export async function chat(messages: ChatMsg[], opts: ChatOpts = {}): Promise<string> {
  const res = await post(messages, opts, false);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  const content = typeof raw === "string" ? stripThinking(raw) : "";
  if (!content) {
    // A reasoning model that hit max_tokens before it finished thinking lands
    // here, which is worth saying out loud rather than reporting as "empty".
    const reason = data?.choices?.[0]?.finish_reason;
    throw new AIError(
      reason === "length"
        ? `${MODEL} ran out of tokens before answering. Raise max_tokens, or set AI_REASONING_EFFORT=low.`
        : "The model returned an empty response."
    );
  }
  return content;
}

/** Streaming completion. Yields incremental text chunks as they arrive. */
export async function* chatStream(
  messages: ChatMsg[],
  opts: ChatOpts = {}
): AsyncGenerator<string, void, unknown> {
  const res = await post(messages, opts, true);
  if (!res.body) throw new AIError("The model returned no response body.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // A <think> block can be split across any number of deltas, so the filter
  // has to hold state and withhold a partial tag rather than emit it.
  let thinking = false;
  let pending = "";

  function* filter(delta: string): Generator<string> {
    pending += delta;
    while (pending) {
      if (thinking) {
        const close = pending.search(/<\/think>/i);
        if (close === -1) {
          // Keep only enough to recognise a tag straddling the boundary.
          pending = pending.slice(-8);
          return;
        }
        pending = pending.slice(close + 8);
        thinking = false;
        continue;
      }
      const open = pending.search(/<think>/i);
      if (open === -1) {
        // "<think" may be arriving one character at a time; hold the tail back.
        const safe = pending.length > 7 ? pending.slice(0, -7) : "";
        pending = pending.slice(safe.length);
        if (safe) yield safe;
        return;
      }
      if (open > 0) yield pending.slice(0, open);
      pending = pending.slice(open + 7);
      thinking = true;
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are newline-delimited; the tail may be a partial line.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        if (!thinking && pending) yield pending;
        return;
      }
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (delta) yield* filter(delta as string);
      } catch {
        // Keep-alive comments and split frames land here; both are safe to skip.
      }
    }
  }

  if (!thinking && pending) yield pending;
}

/**
 * Ask for JSON and parse it. Models wrap JSON in prose or fences often enough
 * that a bare JSON.parse is not worth relying on.
 */
export async function chatJSON<T = unknown>(messages: ChatMsg[], opts: ChatOpts = {}): Promise<T> {
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
        // Fall through to the error below.
      }
    }
    throw new AIError("The model did not return valid JSON.");
  }
}
