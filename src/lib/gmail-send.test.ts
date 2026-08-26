import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({ db: { account: { findFirst: vi.fn(), update: vi.fn() } } }));

const { buildReplyMime, GMAIL_SCOPES, GmailApiError } = await import("./gmail");

/** Reverses buildReplyMime so the assertions read against real headers. */
function decode(raw: string): { headers: string; body: string } {
  const text = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  const [headers, ...rest] = text.split("\r\n\r\n");
  const b64 = rest.join("\r\n\r\n").replace(/\r\n/g, "");
  return { headers, body: Buffer.from(b64, "base64").toString("utf-8") };
}

const ctx = {
  threadId: "thread_1",
  to: "Sarah Chen <sarah@example.com>",
  subject: "Re: Q3 roadmap",
  inReplyTo: "<abc123@mail.example.com>",
  references: "<older@mail.example.com> <abc123@mail.example.com>",
};

beforeEach(() => vi.restoreAllMocks());

describe("scopes", () => {
  it("asks for send as well as read and change", () => {
    expect(GMAIL_SCOPES).toContain("https://www.googleapis.com/auth/gmail.modify");
    expect(GMAIL_SCOPES).toContain("https://www.googleapis.com/auth/gmail.send");
  });

  it("does not ask for readonly alongside modify", () => {
    // gmail.modify already covers reading. Asking for both would show the
    // user two permissions on the consent screen for one capability.
    expect(GMAIL_SCOPES).not.toContain("https://www.googleapis.com/auth/gmail.readonly");
  });

  it("stays clear of the scopes that can delete mail", () => {
    // gmail.modify cannot delete a message permanently; the full mail.google.com
    // scope can. Archiving is a label change, so there is no reason to hold it.
    expect(GMAIL_SCOPES).not.toContain("https://mail.google.com/");
    expect(GMAIL_SCOPES.every((s) => !s.includes("gmail.settings"))).toBe(true);
  });
});

describe("buildReplyMime", () => {
  it("keeps the reply in the same conversation", () => {
    // Gmail threads on threadId, but everyone else threads on these two
    // headers. Dropping them is how a reply arrives as a new thread.
    const { headers } = decode(buildReplyMime(ctx, "Sounds good."));
    expect(headers).toContain("In-Reply-To: <abc123@mail.example.com>");
    expect(headers).toContain("References: <older@mail.example.com> <abc123@mail.example.com>");
  });

  it("addresses the reply and carries the subject", () => {
    const { headers } = decode(buildReplyMime(ctx, "Sounds good."));
    expect(headers).toContain("To: Sarah Chen <sarah@example.com>");
    expect(headers).toContain("Subject: Re: Q3 roadmap");
  });

  it("round-trips the body exactly", () => {
    const body = "Hi Sarah,\n\nI'll review it by Wednesday.\n\nAlex";
    expect(decode(buildReplyMime(ctx, body)).body).toBe(body);
  });

  it("survives non-ASCII in the body", () => {
    const body = "Café — naïve — 日本語 — 🎉";
    expect(decode(buildReplyMime(ctx, body)).body).toBe(body);
  });

  it("encodes a non-ASCII subject rather than emitting raw bytes", () => {
    const { headers } = decode(buildReplyMime({ ...ctx, subject: "Re: Café ☕" }, "hi"));
    expect(headers).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
    expect(headers).not.toContain("Café");
  });

  it("leaves a plain ASCII subject unencoded", () => {
    const { headers } = decode(buildReplyMime(ctx, "hi"));
    expect(headers).toContain("Subject: Re: Q3 roadmap");
  });

  it("omits threading headers when there are none, rather than sending empty ones", () => {
    const { headers } = decode(
      buildReplyMime({ ...ctx, inReplyTo: "", references: "" }, "hi")
    );
    expect(headers).not.toContain("In-Reply-To:");
    expect(headers).not.toContain("References:");
  });

  it("wraps long base64 bodies so no line breaks the transport", () => {
    const raw = buildReplyMime(ctx, "x".repeat(5000));
    const text = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    const longest = Math.max(...text.split("\r\n").map((l) => l.length));
    expect(longest).toBeLessThanOrEqual(998); // RFC 5322 hard limit
  });

  it("produces base64url, which is what the API expects", () => {
    expect(buildReplyMime(ctx, "hi")).not.toMatch(/[+/=]/);
  });
});

describe("a grant that cannot send", () => {
  it("treats insufficient scope as something reconnecting fixes", () => {
    // Every account connected before sending existed has a read-only grant.
    const body = JSON.stringify({
      error: { code: 403, message: "Request had insufficient authentication scopes." },
    });
    expect(new GmailApiError(403, body).needsReconnect).toBe(true);
  });

  it("does not treat other 403s as a reconnect", () => {
    const body = JSON.stringify({
      error: { code: 403, message: "Gmail API has not been used in project 123 before or it is disabled." },
    });
    expect(new GmailApiError(403, body).needsReconnect).toBe(false);
  });
});

describe("getThread", () => {
  const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64url");

  function msg(over: Record<string, unknown> = {}) {
    return {
      id: "m1",
      internalDate: "1700000000000",
      labelIds: [],
      payload: {
        mimeType: "text/plain",
        body: { data: b64("hello") },
        headers: [
          { name: "From", value: "Sarah Chen <sarah@example.com>" },
          { name: "To", value: "me@gmail.com" },
          { name: "Date", value: "Tue, 3 Sep 2024 09:12:00 +0000" },
        ],
      },
      ...over,
    };
  }

  async function thread(messages: unknown[]) {
    const { getThread } = await import("./gmail");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ messages }), { status: 200 }))
    );
    return getThread("token", "t1", "me@gmail.com");
  }

  it("returns the conversation oldest first with bodies decoded", async () => {
    const out = await thread([msg({ id: "a" }), msg({ id: "b" })]);
    expect(out.map((m) => m.id)).toEqual(["a", "b"]);
    expect(out[0].body).toBe("hello");
  });

  it("marks messages carrying the SENT label as mine", async () => {
    const out = await thread([msg({ labelIds: ["SENT"] })]);
    expect(out[0].fromMe).toBe(true);
  });

  it("marks messages from my own address as mine, alias casing included", async () => {
    const out = await thread([
      msg({
        payload: {
          mimeType: "text/plain",
          body: { data: b64("mine") },
          headers: [{ name: "From", value: "Me <ME@Gmail.com>" }],
        },
      }),
    ]);
    expect(out[0].fromMe).toBe(true);
  });

  it("does not mark the other party as mine", async () => {
    const out = await thread([msg()]);
    expect(out[0].fromMe).toBe(false);
    expect(out[0].from).toEqual({ name: "Sarah Chen", email: "sarah@example.com" });
  });

  it("falls back to internalDate when there is no Date header", async () => {
    const out = await thread([
      msg({ payload: { mimeType: "text/plain", body: { data: b64("x") }, headers: [] } }),
    ]);
    expect(new Date(out[0].receivedAt).getTime()).toBe(1700000000000);
  });

  it("returns an empty list for a thread with no messages", async () => {
    expect(await thread([])).toEqual([]);
  });
});
