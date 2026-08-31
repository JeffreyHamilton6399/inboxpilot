import { describe, it, expect } from "vitest";
import {
  buildInboxContext,
  relativeAge,
  absoluteTime,
  tidySnippet,
} from "./inbox-context";
import type { Email } from "./types";

/**
 * These assert what the model is actually told, because every weak answer so
 * far has come from something simply not being in the prompt rather than from
 * the model failing to reason about it.
 */

const NOW = new Date("2026-08-30T17:00:00");

function email(over: Partial<Email> = {}): Email {
  return {
    id: "m1",
    threadId: "t1",
    from: { name: "Sarah Chen", email: "sarah@acme.com", avatarColor: "bg-violet-500" },
    to: "me@example.com",
    subject: "Q3 roadmap",
    preview: "Can you confirm the migration lands before the 14th?",
    body: "",
    receivedAt: "2026-08-30T16:00:00",
    category: "to-respond",
    unread: true,
    starred: false,
    ...over,
  };
}

describe("relativeAge", () => {
  it("uses the coarsest unit that still says something", () => {
    expect(relativeAge(new Date("2026-08-30T16:59:40"), NOW)).toBe("just now");
    expect(relativeAge(new Date("2026-08-30T16:52:00"), NOW)).toBe("8m ago");
    expect(relativeAge(new Date("2026-08-30T14:00:00"), NOW)).toBe("3h ago");
    expect(relativeAge(new Date("2026-08-27T17:00:00"), NOW)).toBe("3d ago");
    expect(relativeAge(new Date("2026-08-02T17:00:00"), NOW)).toBe("4w ago");
  });
});

describe("absoluteTime", () => {
  it("does not change shape with the machine's locale", () => {
    // Hardcoded names are the point: a prompt whose format depends on the
    // server's language settings is one nobody can reason about.
    expect(absoluteTime(new Date("2026-08-30T09:05:00"))).toBe("Sun 30 Aug, 09:05");
  });
});

describe("tidySnippet", () => {
  it("flattens the newlines a Gmail snippet arrives with", () => {
    expect(tidySnippet("one\n  two\tthree ", 50)).toBe("one two three");
  });

  it("truncates on an ellipsis rather than mid-word noise", () => {
    expect(tidySnippet("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("buildInboxContext", () => {
  it("says nothing at all for an empty inbox", () => {
    // An empty heading would leave the model to decide whether that meant "no
    // mail" or "mail I was not shown".
    expect(buildInboxContext([], { now: NOW })).toBe("");
  });

  it("carries the arrival time of every message", () => {
    // The regression this exists for: with no dates in the prompt, "what has
    // been sitting in my inbox the longest?" could only be guessed at.
    const out = buildInboxContext([email()], { now: NOW });
    expect(out).toContain("1h ago");
    expect(out).toContain("Sun 30 Aug, 16:00");
  });

  it("carries read state and starring", () => {
    const out = buildInboxContext([email({ unread: false, starred: true })], { now: NOW });
    expect(out).toContain("read, starred");
  });

  it("names the category in words the user sees, not the id", () => {
    const out = buildInboxContext([email({ category: "awaiting-reply" })], { now: NOW });
    expect(out).toContain("Awaiting Reply");
    expect(out).not.toContain("awaiting-reply");
  });

  it("orders newest first whatever order it is handed", () => {
    const out = buildInboxContext(
      [
        email({ id: "old", subject: "OLDEST", receivedAt: "2026-08-20T09:00:00" }),
        email({ id: "new", subject: "NEWEST", receivedAt: "2026-08-30T16:30:00" }),
      ],
      { now: NOW }
    );
    expect(out.indexOf("NEWEST")).toBeLessThan(out.indexOf("OLDEST"));
  });

  it("says how many it left out rather than silently dropping them", () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      email({ id: `m${i}`, receivedAt: `2026-08-3${i % 10}T10:00:00` })
    );
    const out = buildInboxContext(many, { now: NOW, limit: 2 });
    expect(out).toContain("3 older loaded messages not listed");
  });

  it("includes the sender's address, not just their display name", () => {
    // "Who is waiting on me" needs something to key on that two people called
    // Sarah do not share.
    expect(buildInboxContext([email()], { now: NOW })).toContain("<sarah@acme.com>");
  });
});
