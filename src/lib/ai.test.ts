import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * These cover the request-shaping and recovery logic, not the model. `fetch` is
 * stubbed, so what is asserted is what InboxPilot sends and how it reacts —
 * which is exactly where the "AI unavailable" failures came from.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function completion(content: string, finish = "stop") {
  return { choices: [{ message: { content }, finish_reason: finish }] };
}

/** Re-imports the module so its top-level env reads are re-evaluated. */
async function loadAi(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("AI_API_KEY", "test-key");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("./ai");
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function bodyOf(call: unknown): Record<string, unknown> {
  const init = (call as [string, RequestInit])[1];
  return JSON.parse(init.body as string);
}

describe("reasoning effort", () => {
  it("defaults to low, because the default model is a reasoning model", async () => {
    // Without this the categorize route spends its whole 512-token budget
    // thinking and returns nothing, which is what "AI unavailable" was.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(completion("ok")));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi();
    await chat([{ role: "user", content: "hi" }]);

    expect(bodyOf(fetchMock.mock.calls[0]).reasoning_effort).toBe("low");
  });

  it("honours an explicit setting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(completion("ok")));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi({ AI_REASONING_EFFORT: "high" });
    await chat([{ role: "user", content: "hi" }]);

    expect(bodyOf(fetchMock.mock.calls[0]).reasoning_effort).toBe("high");
  });

  it("omits the parameter when explicitly blanked", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(completion("ok")));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi({ AI_REASONING_EFFORT: "" });
    await chat([{ role: "user", content: "hi" }]);

    expect(bodyOf(fetchMock.mock.calls[0])).not.toHaveProperty("reasoning_effort");
  });

  it("drops the parameter and retries when the provider rejects it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: "Unrecognized request argument: reasoning_effort" } }, 400)
      )
      .mockResolvedValueOnce(jsonResponse(completion("recovered")));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi();
    await expect(chat([{ role: "user", content: "hi" }])).resolves.toBe("recovered");

    expect(bodyOf(fetchMock.mock.calls[0])).toHaveProperty("reasoning_effort");
    expect(bodyOf(fetchMock.mock.calls[1])).not.toHaveProperty("reasoning_effort");
  });

  it("does not swallow a 400 that is about something else", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { message: "model_not_found" } }, 400));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi();
    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow(/model_not_found/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("thinking past the budget", () => {
  it("retries once with more room when the model returns nothing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(completion("", "length")))
      .mockResolvedValueOnce(jsonResponse(completion("finally an answer")));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi();
    await expect(chat([{ role: "user", content: "hi" }], { maxTokens: 200 })).resolves.toBe(
      "finally an answer"
    );

    expect(bodyOf(fetchMock.mock.calls[0]).max_tokens).toBe(200);
    expect(bodyOf(fetchMock.mock.calls[1]).max_tokens).toBe(800);
  });

  it("caps the retry rather than asking for an unbounded budget", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(completion("", "length")))
      .mockResolvedValueOnce(jsonResponse(completion("ok")));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi();
    await chat([{ role: "user", content: "hi" }], { maxTokens: 3000 });

    expect(bodyOf(fetchMock.mock.calls[1]).max_tokens).toBe(4096);
  });

  it("gives an actionable error when even the retry comes back empty", async () => {
    // A fresh Response per call: a body can only be read once, and this path
    // deliberately makes two requests.
    const fetchMock = vi.fn(async () => jsonResponse(completion("", "length")));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi();
    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow(
      /ran out of tokens.*even after a retry/i
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("configuration", () => {
  it("refuses to call out with no key, and says which variable to set", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi({ AI_API_KEY: "" });
    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow(/AI_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the effort in use, so a missing setting is visible from outside", async () => {
    const { getProvider } = await loadAi();
    expect(getProvider()).toMatchObject({
      host: "api.groq.com",
      ready: true,
      reasoningEffort: "low",
    });
  });

  it("strips a trailing slash from the base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(completion("ok")));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi({ AI_BASE_URL: "https://example.com/v1/" });
    await chat([{ role: "user", content: "hi" }]);

    expect((fetchMock.mock.calls[0] as [string, RequestInit])[0]).toBe(
      "https://example.com/v1/chat/completions"
    );
  });
});

describe("<think> leakage", () => {
  it("never reaches the caller", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(completion("<think>scratch</think>Dear Sarah,")));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi();
    await expect(chat([{ role: "user", content: "hi" }])).resolves.toBe("Dear Sarah,");
  });
});

describe("environment values as people actually paste them", () => {
  it("strips surrounding double quotes from the key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(completion("ok")));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi({ AI_API_KEY: '"gsk_realkey"' });
    await chat([{ role: "user", content: "hi" }]);

    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer gsk_realkey");
  });

  it("strips surrounding single quotes", async () => {
    const { readEnv } = await loadAi({ AI_MODEL: "'some/model'" });
    expect(readEnv("AI_MODEL")).toBe("some/model");
  });

  it("survives a whole NAME=value line being pasted in", async () => {
    const { readEnv } = await loadAi({ AI_API_KEY: "AI_API_KEY=gsk_realkey" });
    expect(readEnv("AI_API_KEY")).toBe("gsk_realkey");
  });

  it("handles a quoted NAME=value line", async () => {
    const { readEnv } = await loadAi({ AI_BASE_URL: 'AI_BASE_URL="https://api.x.ai/v1"' });
    expect(readEnv("AI_BASE_URL")).toBe("https://api.x.ai/v1");
  });

  it("leaves a normal value alone, quotes inside included", async () => {
    const { readEnv } = await loadAi({ AI_MODEL: 'a"b' });
    expect(readEnv("AI_MODEL")).toBe('a"b');
  });

  it("does not strip a lone leading quote", async () => {
    const { readEnv } = await loadAi({ AI_MODEL: '"unbalanced' });
    expect(readEnv("AI_MODEL")).toBe('"unbalanced');
  });
});

describe("a key the provider refuses", () => {
  it("names the variable to fix instead of echoing the provider", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: { message: "Invalid API Key", code: "invalid_api_key" } }, 401)
    );
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi();
    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow(/AI_API_KEY is not valid/);
  });

  it("treats 403 the same way", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "forbidden" }, 403));
    vi.stubGlobal("fetch", fetchMock);

    const { chat } = await loadAi();
    await expect(chat([{ role: "user", content: "hi" }])).rejects.toThrow(/rejected the API key \(403\)/);
  });
});

describe("the key probe", () => {
  it("reports a working key as accepted", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: [] }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const { probeKey } = await loadAi();
    await expect(probeKey()).resolves.toMatchObject({ accepted: true });
    expect(String((fetchMock.mock.calls as unknown as string[][])[0][0])).toBe("https://api.groq.com/openai/v1/models");
  });

  it("names AI_API_KEY when the provider rejects it", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "Invalid API Key" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const { probeKey } = await loadAi();
    const r = await probeKey();
    expect(r.accepted).toBe(false);
    expect(r.detail).toMatch(/AI_API_KEY is wrong/);
  });

  it("does not call out at all when no key is set", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { probeKey } = await loadAi({ AI_API_KEY: "" });
    await expect(probeKey()).resolves.toMatchObject({ accepted: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caches, so repeated checks do not hammer the provider", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: [] }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const { probeKey } = await loadAi();
    await probeKey();
    await probeKey();
    await probeKey();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
