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
      { temperature: 0.7, maxTokens: 600 }
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
      { temperature: 0.2, maxTokens: 512 }
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
      { temperature: 0.3, maxTokens: 500 }
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
      { temperature: 0.6, maxTokens: 900 }
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
