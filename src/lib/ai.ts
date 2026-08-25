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
  /**
   * Reported because its absence is invisible from the outside and breaks
   * reasoning models in a way that looks like a provider outage.
   */
  reasoningEffort: string | null;
}

/**
 * Reads an environment variable the way a person pastes one.
 *
 * A dashboard field is not a shell, so `AI_API_KEY="gsk_..."` stores the
 * quotes, and pasting a whole line stores the name too. Both produce a
 * credential that is wrong by two characters and an error from the provider
 * that says only "Invalid API Key". Neither is worth an afternoon.
 */
export function readEnv(name: string): string {
  let v = process.env[name]?.trim() ?? "";
  if (!v) return "";
  // A pasted "NAME=value" line.
  if (v.startsWith(`${name}=`)) v = v.slice(name.length + 1).trim();
  // Matching surrounding quotes, single or double.
  const first = v[0];
  if (v.length >= 2 && (first === '"' || first === "'") && v[v.length - 1] === first) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

const BASE_URL = (readEnv("AI_BASE_URL") || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const API_KEY = readEnv("AI_API_KEY");
const MODEL = readEnv("AI_MODEL") || "openai/gpt-oss-120b";

/**
 * Reasoning models spend their token budget thinking before they answer, and a
 * budget sized for an email reply is one they can exhaust entirely — returning
 * finish_reason "length" and an empty message.
 *
 * The default model is one of those, so this defaults to "low" rather than to
 * nothing: shipping a reasoning model whose companion setting has to be
 * discovered separately is how you get an app that fails on a fresh install.
 * Providers that have never heard of the parameter reject the whole request,
 * which is handled by dropping it and retrying — see `post`.
 */
const REASONING_EFFORT = process.env.AI_REASONING_EFFORT === undefined ? "low" : readEnv("AI_REASONING_EFFORT");

/**
 * Set once a provider tells us it does not understand `reasoning_effort`, so
 * the cost of finding out is paid a single time per process rather than on
 * every request.
 */
let reasoningRejected = false;

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
  return {
    host,
    model: MODEL,
    ready: Boolean(API_KEY),
    reasoningEffort: REASONING_EFFORT && !reasoningRejected ? REASONING_EFFORT : null,
  };
}

/**
 * Asks the provider whether the key is any good.
 *
 * `ready` only ever meant "a key is present", which is why a deployment with
 * the wrong value in AI_API_KEY reported itself healthy while every AI feature
 * returned 503. The answer is cached because it changes when someone edits an
 * environment variable, not by the second.
 */
let probeCache: { at: number; accepted: boolean; detail: string } | null = null;
const PROBE_TTL = 60_000;

export async function probeKey(): Promise<{ accepted: boolean; detail: string }> {
  if (!API_KEY) return { accepted: false, detail: "AI_API_KEY is not set" };
  if (probeCache && Date.now() - probeCache.at < PROBE_TTL) {
    return { accepted: probeCache.accepted, detail: probeCache.detail };
  }

  let accepted = false;
  let detail = "";
  try {
    const res = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    accepted = res.ok;
    detail = res.ok
      ? "key accepted"
      : res.status === 401 || res.status === 403
        ? `${getProvider().host} rejected the key (${res.status}) — AI_API_KEY is wrong for this provider`
        : `${getProvider().host} returned ${res.status}`;
  } catch (err) {
    detail = `could not reach ${getProvider().host}: ${String(err)}`;
  }

  probeCache = { at: Date.now(), accepted, detail };
  return { accepted, detail };
}

async function post(messages: ChatMsg[], opts: ChatOpts, stream: boolean): Promise<Response> {
  if (!API_KEY) {
    throw new AIError("AI is not configured. Set AI_API_KEY (and optionally AI_BASE_URL and AI_MODEL).");
  }

  const send = async (withReasoning: boolean): Promise<Response> => {
    try {
      return await fetch(`${BASE_URL}/chat/completions`, {
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
          ...(withReasoning ? { reasoning_effort: REASONING_EFFORT } : {}),
        }),
        signal: opts.signal,
      });
    } catch (err) {
      throw new AIError(`Could not reach ${getProvider().host}: ${String(err)}`);
    }
  };

  const useReasoning = Boolean(REASONING_EFFORT) && !reasoningRejected;
  let res = await send(useReasoning);

  // A provider that does not know the parameter says so with a 400. Drop it
  // and try once more, rather than making the operator work out that their
  // model and their config disagree.
  if (!res.ok && res.status === 400 && useReasoning) {
    const body = await res.text().catch(() => "");
    if (/reasoning_effort|unknown|unrecognized|unsupported|not supported/i.test(body)) {
      console.warn("[ai] provider rejected reasoning_effort; retrying without it");
      reasoningRejected = true;
      res = await send(false);
    } else {
      throw new AIError(`${getProvider().host} returned 400: ${body.slice(0, 200)}`);
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const host = getProvider().host;
    if (res.status === 401 || res.status === 403) {
      // The key reached the provider and the provider refused it. Say which
      // variable is wrong, because "Invalid API Key" alone sends people to
      // check the model, the base URL and their billing first.
      throw new AIError(
        `${host} rejected the API key (${res.status}). The value in AI_API_KEY is not valid for ${host} — check it is the right key for this provider and that it was pasted without surrounding quotes.`
      );
    }
    throw new AIError(`${host} returned ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

/** Ceiling for the one automatic retry when a model thinks past its budget. */
const RETRY_TOKEN_CEILING = 4096;

/** Non-streaming completion. Returns the full text. */
export async function chat(messages: ChatMsg[], opts: ChatOpts = {}): Promise<string> {
  const attempt = async (o: ChatOpts) => {
    const res = await post(messages, o, false);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    return {
      content: typeof raw === "string" ? stripThinking(raw) : "",
      finish: data?.choices?.[0]?.finish_reason as string | undefined,
    };
  };

  let { content, finish } = await attempt(opts);

  // A reasoning model can spend the entire budget thinking and return nothing.
  // One retry with real headroom is cheaper than handing the user an error for
  // a request that was only ever a few hundred tokens short.
  if (!content && finish === "length") {
    const roomier = Math.min((opts.maxTokens ?? 1024) * 4, RETRY_TOKEN_CEILING);
    console.warn(`[ai] ${MODEL} exhausted its budget thinking; retrying with max_tokens=${roomier}`);
    ({ content, finish } = await attempt({ ...opts, maxTokens: roomier }));
  }

  if (!content) {
    throw new AIError(
      finish === "length"
        ? `${MODEL} ran out of tokens before answering, even after a retry. Lower AI_REASONING_EFFORT, or choose a model that does not reason before replying.`
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
