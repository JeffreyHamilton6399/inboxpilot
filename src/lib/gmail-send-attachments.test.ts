import { describe, it, expect, vi } from "vitest";

vi.mock("./db", () => ({ db: { account: { findFirst: vi.fn(), update: vi.fn() } } }));

const { buildReplyMime, MAX_OUTGOING_ATTACHMENT_BYTES } = await import("./gmail");

const ctx = {
  threadId: "thread_1",
  to: "Sarah Chen <sarah@example.com>",
  subject: "Re: Q3 roadmap",
  inReplyTo: "<abc123@mail.example.com>",
  references: "<older@mail.example.com> <abc123@mail.example.com>",
};

/** The raw message as text, the way a receiving client would read it. */
function raw(encoded: string): string {
  return Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function boundaryOf(message: string): string {
  const match = /boundary="([^"]+)"/.exec(message);
  if (!match) throw new Error("no boundary in message");
  return match[1];
}

/** Splits a multipart body into its parts, headers and decoded content. */
function partsOf(message: string): { headers: string; content: Buffer }[] {
  const boundary = boundaryOf(message);
  const body = message.split("\r\n\r\n").slice(1).join("\r\n\r\n");
  return body
    .split(`--${boundary}`)
    .map((chunk) => chunk.replace(/^\r\n/, "").replace(/\r\n$/, ""))
    .filter((chunk) => chunk && chunk !== "--")
    .map((chunk) => {
      const [headers, ...rest] = chunk.split("\r\n\r\n");
      const b64 = rest.join("\r\n\r\n").replace(/\r\n/g, "");
      return { headers, content: Buffer.from(b64, "base64") };
    });
}

const pdf = {
  filename: "invoice.pdf",
  mimeType: "application/pdf",
  data: Buffer.from("%PDF-1.4 fake"),
};

describe("buildReplyMime without attachments", () => {
  it("stays a single text/plain part", () => {
    const message = raw(buildReplyMime(ctx, "Sounds good."));
    expect(message).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(message).not.toContain("multipart/mixed");
  });
});

describe("buildReplyMime with attachments", () => {
  it("becomes multipart/mixed and keeps the threading headers", () => {
    const message = raw(buildReplyMime(ctx, "Invoice attached.", [pdf]));
    expect(message).toContain("Content-Type: multipart/mixed;");
    expect(message).toContain("In-Reply-To: <abc123@mail.example.com>");
    expect(message).toContain("References: <older@mail.example.com> <abc123@mail.example.com>");
    expect(message).toContain("To: Sarah Chen <sarah@example.com>");
  });

  it("puts the reply text first, so a client showing one part shows the message", () => {
    const parts = partsOf(raw(buildReplyMime(ctx, "Invoice attached.", [pdf])));
    expect(parts[0].headers).toContain("text/plain");
    expect(parts[0].content.toString("utf-8")).toBe("Invoice attached.");
  });

  it("round-trips the attachment bytes exactly", () => {
    const parts = partsOf(raw(buildReplyMime(ctx, "See attached.", [pdf])));
    expect(parts[1].content.equals(pdf.data)).toBe(true);
    expect(parts[1].headers).toContain("Content-Type: application/pdf");
    expect(parts[1].headers).toContain('filename="invoice.pdf"');
  });

  it("round-trips binary bytes that are not valid text", () => {
    // A PNG header contains bytes no UTF-8 decoder would survive; base64 is
    // what keeps them intact through the transport.
    const png = {
      filename: "shot.png",
      mimeType: "image/png",
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0xfe]),
    };
    const parts = partsOf(raw(buildReplyMime(ctx, "Screenshot.", [png])));
    expect(parts[1].content.equals(png.data)).toBe(true);
  });

  it("carries several files, in order", () => {
    const files = [
      pdf,
      { filename: "notes.txt", mimeType: "text/plain", data: Buffer.from("hello") },
      { filename: "data.zip", mimeType: "application/zip", data: Buffer.from([0x50, 0x4b]) },
    ];
    const parts = partsOf(raw(buildReplyMime(ctx, "Three files.", files)));
    expect(parts).toHaveLength(4); // body + three files
    expect(parts[1].headers).toContain("invoice.pdf");
    expect(parts[2].headers).toContain("notes.txt");
    expect(parts[3].headers).toContain("data.zip");
  });

  it("encodes a non-ASCII filename without mangling the ASCII fallback", () => {
    const file = { ...pdf, filename: "facturé ☕.pdf" };
    const headers = partsOf(raw(buildReplyMime(ctx, "hi", [file])))[1].headers;
    // RFC 2231 form carries the real name...
    expect(headers).toContain("filename*=UTF-8''factur%C3%A9%20%E2%98%95.pdf");
    // ...and the plain parameter stays ASCII so old clients still get a name.
    const ascii = /filename="([^"]+)"/.exec(headers)?.[1] ?? "";
    expect(ascii).toMatch(/^[\x20-\x7E]+$/);
  });

  it("does not let a quote in a filename break out of the header", () => {
    const file = { ...pdf, filename: 'evil".pdf' };
    const headers = partsOf(raw(buildReplyMime(ctx, "hi", [file])))[1].headers;
    const ascii = /filename="([^"]+)"/.exec(headers)?.[1] ?? "";
    expect(ascii).not.toContain('"');
  });

  it("uses a boundary that does not appear in the content", () => {
    const message = raw(buildReplyMime(ctx, "Invoice attached.", [pdf]));
    const boundary = boundaryOf(message);
    // Three occurrences: the header, one opener per part, and the closer.
    const opens = message.split(`--${boundary}`).length - 1;
    expect(opens).toBe(3);
    expect(message.trimEnd().endsWith(`--${boundary}--`)).toBe(true);
  });

  it("gives each message a fresh boundary", () => {
    const a = boundaryOf(raw(buildReplyMime(ctx, "one", [pdf])));
    const b = boundaryOf(raw(buildReplyMime(ctx, "two", [pdf])));
    expect(a).not.toBe(b);
  });

  it("wraps base64 so no content line exceeds the MIME limit", () => {
    const big = { ...pdf, data: Buffer.alloc(5000, 0x41) };
    const message = raw(buildReplyMime(ctx, "big one", [big]));
    const encoded = message
      .split("\r\n")
      .filter((line) => /^[A-Za-z0-9+/=]{20,}$/.test(line));
    expect(encoded.length).toBeGreaterThan(10);
    expect(Math.max(...encoded.map((line) => line.length))).toBeLessThanOrEqual(76);
  });

  it("keeps every line inside RFC 5322's hard limit", () => {
    const long = { ...pdf, filename: `${"a".repeat(200)}.pdf` };
    const message = raw(buildReplyMime(ctx, "hi", [long]));
    expect(Math.max(...message.split("\r\n").map((l) => l.length))).toBeLessThan(998);
  });

  it("folds the disposition parameters so ordinary headers stay short", () => {
    // RFC 5322 asks for lines under 78; an unfolded disposition with two
    // filenames passes that on its own.
    const message = raw(buildReplyMime(ctx, "hi", [pdf]));
    const headerLines = message
      .split("\r\n")
      .filter(
        (line) => /^(Content-|To:|Subject:|In-Reply-To:|MIME-)/.test(line) || /^\t/.test(line)
      );
    expect(Math.max(...headerLines.map((l) => l.length))).toBeLessThanOrEqual(78);
  });

  it("sends a file with no accompanying text", () => {
    const parts = partsOf(raw(buildReplyMime(ctx, "", [pdf])));
    expect(parts).toHaveLength(2);
    expect(parts[0].content.toString("utf-8")).toBe("");
    expect(parts[1].content.equals(pdf.data)).toBe(true);
  });

  it("caps outgoing size below Gmail's own limit", () => {
    // Gmail rejects a raw message over 35 MB and base64 adds a third, so the
    // cap has to leave room for the encoding.
    expect(MAX_OUTGOING_ATTACHMENT_BYTES * (4 / 3)).toBeLessThan(35 * 1024 * 1024);
  });
});
