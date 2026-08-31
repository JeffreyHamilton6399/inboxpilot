import { describe, it, expect, vi } from "vitest";
import { chat, chatJSON, chatStream, getProvider } from "./ai";
import { CATEGORIES } from "./defaults";
import type { CategoryId } from "./types";

/**
 * Talks to the configured provider for real. Skipped unless AI_API_KEY is set,
 * so `bun run test` stays offline and deterministic:
 *
 *   AI_API_KEY=... bunx vitest run src/lib/ai.integration.test.ts
 *
 * The unit tests stub fetch and prove what gets *sent*. These prove a real
 * model on the other end actually answers, using the prompts the routes use.
 * That distinction matters: every failure so far has been in the gap between
 * a request that looked right and a response that was empty.
 */

const live = process.env.AI_API_KEY ? describe : describe.skip;
const VALID = CATEGORIES.map((c) => c.id);

live("against the configured provider", () => {
  it("reports itself ready", () => {
    const p = getProvider();
    expect(p.ready).toBe(true);
    console.log(`  provider: ${p.host} · ${p.model} · reasoning=${p.reasoningEffort ?? "off"}`);
  });

  it("drafts a reply with the draft route's budget", { timeout: 60_000 }, async () => {
    const draft = await chat(
      [
        {
          role: "system",
          content:
            'You are drafting an email reply in the personal voice of Alex, a Product Manager.\nWrite in a neutral professional tone that is clear and concise.\nLength: one short paragraph.\nSign off as "Alex" (just the name, no title line).\n\nOutput ONLY the reply body. No subject line, no preamble.',
        },
        {
          role: "user",
          content:
            "Original email from Sarah Chen:\nSubject: Q3 roadmap review\n\nCan you take a look at the roadmap doc before Thursday? Happy to walk through it.\n\n---\nWrite the reply.",
        },
      ],
      { temperature: 0.6, maxTokens: 1400 }
    );

    expect(draft.length).toBeGreaterThan(20);
    expect(draft).not.toMatch(/<think>/i);
    console.log(`  draft: ${draft.slice(0, 90).replace(/\n/g, " ")}…`);
  });

  it("returns a category id that actually exists, with the categorize route's budget", { timeout: 60_000 }, async () => {
    // The route falls back to "fyi" for anything unrecognised, so a model that
    // invents category names looks like it works while doing nothing.
    const list = CATEGORIES.map((c) => `- ${c.id}: ${c.label} — ${c.description}`).join("\n");
    const result = await chatJSON<{ category?: string; reason?: string }>(
      [
        {
          role: "system",
          content: `You are InboxPilot's inbox classifier. Read an email and assign exactly ONE category.\nCategories:\n${list}\n\nRespond with strict JSON: {"category": "<id>", "reason": "<short reason, <= 12 words>"}\nThe category must be one of: ${VALID.join(", ")}.`,
        },
        {
          role: "user",
          content:
            "From: Sarah Chen <sarah@example.com>\nSubject: Can you review the Q3 doc?\nPreview: Need your sign-off before Thursday.\nBody:\nCould you take a look and let me know?",
        },
      ],
      { temperature: 0.2, maxTokens: 900 }
    );

    console.log(`  category: ${result.category} — ${result.reason}`);
    expect(VALID).toContain(result.category as CategoryId);
    expect(result.category).toBe("to-respond");
  });

  it("summarizes a transcript into JSON", { timeout: 60_000 }, async () => {
    const result = await chatJSON<{ summary?: string; actionItems?: string[] }>(
      [
        {
          role: "system",
          content:
            'You are InboxPilot\'s meeting notetaker. Given a meeting transcript, produce a tight summary and concrete action items.\nRespond with strict JSON: {"summary": "<3-4 sentences>", "actionItems": ["<action 1>"]}\nAction items must be specific and start with a verb. 2-5 items max.',
        },
        {
          role: "user",
          content:
            "Meeting: Q3 planning\n\nTranscript:\nAlex: We need the pricing page done by the 14th.\nSarah: I'll draft copy by Friday.\nAlex: I'll get design to review it Monday.",
        },
      ],
      { temperature: 0.3, maxTokens: 1200 }
    );

    expect(typeof result.summary).toBe("string");
    expect(result.summary!.length).toBeGreaterThan(20);
    expect(Array.isArray(result.actionItems)).toBe(true);
    expect(result.actionItems!.length).toBeGreaterThan(0);
    console.log(`  action items: ${result.actionItems!.length} — ${result.actionItems![0]}`);
  });

  it("recovers when the model thinks past its budget for real", { timeout: 60_000 }, async () => {
    // The exact failure that took the app down: reasoning off, a budget sized
    // for a small JSON answer. Before the retry existed this returned empty and
    // the route 503'd. Re-imported so the module re-reads the env.
    vi.resetModules();
    vi.stubEnv("AI_REASONING_EFFORT", "");
    const { chat: coldChat } = await import("./ai");

    const out = await coldChat(
      [
        { role: "system", content: 'Respond with strict JSON: {"category":"<id>"}' },
        { role: "user", content: "Subject: Can you review the Q3 doc?" },
      ],
      { temperature: 0.2, maxTokens: 200 }
    );

    expect(out.length).toBeGreaterThan(0);
    console.log(`  recovered without reasoning_effort: ${out.slice(0, 60).replace(/\n/g, " ")}`);
    vi.unstubAllEnvs();
  });

  it("streams, in more than one chunk, with nothing leaking", { timeout: 60_000 }, async () => {
    const chunks: string[] = [];
    for await (const c of chatStream(
      [
        { role: "system", content: "You are InboxPilot. Be concise." },
        { role: "user", content: "List three things sitting in an inbox that need a reply. One line each." },
      ],
      { temperature: 0.25, maxTokens: 1600 }
    )) {
      chunks.push(c);
    }

    const full = chunks.join("");
    expect(chunks.length).toBeGreaterThan(1);
    expect(full.length).toBeGreaterThan(20);
    expect(full).not.toMatch(/<think>|<\/think>/i);
    console.log(`  streamed ${chunks.length} chunks, ${full.length} chars`);
  });
});

live("batch classification", () => {
  it("labels a whole batch, mapping every result back to its message", { timeout: 90_000 }, async () => {
    const list = CATEGORIES.map((c) => `- ${c.id}: ${c.label} — ${c.description}`).join("\n");
    const inbox = [
      { from: "Sarah Chen <sarah@example.com>", subject: "Can you review the Q3 doc?", preview: "Need your sign-off before Thursday." },
      { from: "GitHub <noreply@github.com>", subject: "PR #128 approved", preview: "octocat approved your pull request." },
      { from: "Substack <hi@substack.com>", subject: "This week in design", preview: "Unsubscribe at any time." },
      { from: "Google Calendar <calendar-notification@google.com>", subject: "Invitation: Standup @ Mon 9am", preview: "You have been invited." },
    ];

    const result = await chatJSON<{ results?: { index?: number; category?: string }[] }>(
      [
        {
          role: "system",
          content: `You are InboxPilot's inbox classifier. You will be given several emails, each with an index.\nAssign exactly ONE category to each.\n\nCategories:\n${list}\n\nThe category must be one of: ${VALID.join(", ")}.\n\nRespond with strict JSON and nothing else:\n{"results":[{"index":0,"category":"<id>","reason":"<max 10 words>"}]}\nReturn one entry for every index you were given.`,
        },
        {
          role: "user",
          content: inbox
            .map((e, i) => `[${i}]\nFrom: ${e.from}\nSubject: ${e.subject}\nPreview: ${e.preview}`)
            .join("\n\n"),
        },
      ],
      { temperature: 0.2, maxTokens: 2048 }
    );

    const results = result.results ?? [];
    console.log(`  ${results.length}/${inbox.length} classified`);
    for (const r of results) {
      console.log(`    [${r.index}] ${inbox[r.index as number]?.subject.slice(0, 34)} -> ${r.category}`);
    }

    // One entry per message, every index accounted for, every category real.
    expect(results.length).toBe(inbox.length);
    expect(new Set(results.map((r) => r.index))).toEqual(new Set([0, 1, 2, 3]));
    for (const r of results) expect(VALID).toContain(r.category as CategoryId);
  });
});

/**
 * The attachment question path, end to end bar Gmail: a real PDF, really
 * parsed, really asked about. The unit tests prove the text comes out; this
 * proves a model given that text answers from it rather than from the
 * filename.
 */
/** Any Unicode space separator, so an assertion is about words not glyphs. */
function normalizeSpaces(text: string): string {
  return text.replace(/[s  -​  　]+/g, " ");
}

live("answering questions about an attachment", () => {
  const makePdf = (lines: string[]): Buffer => {
    const escape = (s: string) => s.replace(/([\()])/g, "\$1");
    const stream = lines
      .map((line, i) => `BT /F1 12 Tf 72 ${720 - i * 20} Td (${escape(line)}) Tj ET`)
      .join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
        "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(pdf, "latin1"));
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf, "latin1");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, "latin1");
  };

  const invoice = [
    "Northwind Supply Co.",
    "INVOICE 4412",
    "Issued: 25 August 2026",
    "Due: 12 September 2026",
    "August retainer 4,200.00",
    "Onsite engineering days 2,300.00",
    "VAT 20% 1,397.28",
    "Total due 8,383.68",
  ];

  const askAbout = async (pdf: Buffer, question: string): Promise<string> => {
    const { extractAttachmentText } = await import("./attachment-text");
    const extracted = await extractAttachmentText("application/pdf", pdf);
    if (extracted.status !== "ok") throw new Error(`extraction failed: ${extracted.status}`);

    // The same prompt shape the route sends.
    return chat(
      [
        {
          role: "system",
          content:
            "You answer questions about one file attached to an email.\n\n" +
            "Answer only from the file's contents, which follow. If the file does not " +
            "contain the answer, say that plainly instead of guessing. Quote exact numbers, " +
            "dates and names where they matter. Be brief.",
        },
        {
          role: "user",
          content: `File: invoice-4412.pdf\n\n--- file contents ---\n${extracted.text}\n--- end of file ---\n\nQuestion: ${question}`,
        },
      ],
      { temperature: 0.2 }
    );
  };

  it("reads a figure off a real PDF", { timeout: 90_000 }, async () => {
    const answer = await askAbout(makePdf(invoice), "What is the total due?");
    console.log(`  answer: ${answer.slice(0, 160)}`);
    expect(answer).toMatch(/8[,.]?383[.,]68/);
  });

  it("reads a date off a real PDF", { timeout: 90_000 }, async () => {
    const answer = await askAbout(makePdf(invoice), "When is it due?");
    console.log(`  answer: ${answer.slice(0, 160)}`);
    // Models format dates with typographic spaces — this one came back with a
    // narrow no-break space between the day and the month. Normalise before
    // matching, or the assertion fails on an answer that is entirely correct.
    expect(normalizeSpaces(answer)).toMatch(/12 September|2026-09-12|September 12/i);
  });

  it("says it does not know rather than inventing an answer", { timeout: 90_000 }, async () => {
    // Nothing in the invoice names a delivery address; the wrong behaviour is
    // a confident fabrication, which is the failure that matters here.
    const answer = await askAbout(makePdf(invoice), "What is the delivery address?");
    console.log(`  answer: ${answer.slice(0, 200)}`);
    expect(answer).toMatch(/not|no |does not|isn't|cannot|can't|unable|absent/i);
  });
});
