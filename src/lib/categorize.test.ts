import { describe, it, expect } from "vitest";
import { categorize, domainOf, localPartOf, type CategoryInput } from "./categorize";

function input(over: Partial<CategoryInput> = {}): CategoryInput {
  return {
    fromEmail: "sarah@example.com",
    fromName: "Sarah Chen",
    subject: "Lunch tomorrow",
    snippet: "Just checking in.",
    labelIds: [],
    to: "me@gmail.com",
    userEmail: "me@gmail.com",
    ...over,
  };
}

describe("address parsing", () => {
  it("splits on the last @, so quoted local parts survive", () => {
    expect(domainOf('"odd@name"@example.com')).toBe("example.com");
    expect(localPartOf("sarah@example.com")).toBe("sarah");
  });

  it("returns empty for a malformed address rather than throwing", () => {
    expect(domainOf("not-an-address")).toBe("");
  });
});

describe("the substring bug this replaced", () => {
  // The previous heuristic tested address.includes("mail"), which matches
  // every gmail.com address, so ordinary personal mail was filed as marketing.
  it("does not treat a personal gmail address as marketing", () => {
    const c = categorize(input({ fromEmail: "sarah.chen@gmail.com" }));
    expect(c).not.toBe("marketing");
  });

  it("does not treat 'coffee' as an 'off' discount", () => {
    const c = categorize(
      input({ subject: "Coffee this week?", snippet: "Fancy a coffee?", to: "someone@else.com", userEmail: "me@gmail.com" })
    );
    expect(c).not.toBe("marketing");
  });

  it("does not treat an office address as automated", () => {
    const c = categorize(input({ fromEmail: "dan@officeworks.com", subject: "Notes" }));
    expect(c).not.toBe("notification");
  });
});

describe("marketing", () => {
  it("trusts Gmail's own promotions label", () => {
    expect(categorize(input({ labelIds: ["CATEGORY_PROMOTIONS"] }))).toBe("marketing");
  });

  it("treats List-Unsubscribe from a human-ish sender as bulk mail", () => {
    expect(categorize(input({ listUnsubscribe: "<https://x.com/u>" }))).toBe("marketing");
  });

  it("matches known bulk domains and their subdomains", () => {
    expect(categorize(input({ fromEmail: "hi@substack.com" }))).toBe("marketing");
    expect(categorize(input({ fromEmail: "hi@mail.substack.com" }))).toBe("marketing");
  });

  it("matches promotional phrases as whole words", () => {
    expect(categorize(input({ subject: "30% off everything" }))).toBe("marketing");
  });
});

describe("notifications", () => {
  it("catches no-reply local parts", () => {
    expect(categorize(input({ fromEmail: "no-reply@acme.com" }))).toBe("notification");
  });

  it("catches known service domains", () => {
    expect(categorize(input({ fromEmail: "notify@github.com", subject: "PR approved" }))).toBe("notification");
  });

  it("does not call a build failure marketing just because it has List-Unsubscribe", () => {
    const c = categorize(input({ fromEmail: "no-reply@vercel.com", listUnsubscribe: "<https://v/u>" }));
    expect(c).toBe("notification");
  });
});

describe("meetings", () => {
  it("catches calendar senders", () => {
    expect(categorize(input({ fromEmail: "calendar-notification@calendar.google.com" }))).toBe("meeting-update");
  });

  it("catches invitation subjects", () => {
    expect(categorize(input({ subject: "Invitation: Standup @ Mon 9am" }))).toBe("meeting-update");
  });

  it("prefers meeting over automated for calendar mail", () => {
    const c = categorize(input({ fromEmail: "noreply@calendar.google.com" }));
    expect(c).toBe("meeting-update");
  });
});

describe("mail that wants something from you", () => {
  it("flags a direct question addressed to you", () => {
    expect(categorize(input({ subject: "Can you review this?" }))).toBe("to-respond");
  });

  it("flags an ask phrase in the body", () => {
    expect(categorize(input({ subject: "Roadmap", snippet: "Let me know what you think." }))).toBe("to-respond");
  });

  it("flags unread mail addressed directly to you", () => {
    expect(categorize(input({ labelIds: ["UNREAD"] }))).toBe("to-respond");
  });

  it("calls a reply with no ask a comment", () => {
    const c = categorize(input({ subject: "Re: debrief notes", snippet: "Agreed.", to: "team@example.com", userEmail: "me@gmail.com" }));
    expect(c).toBe("comment");
  });

  it("leaves read mail you were only cc'd on as FYI", () => {
    const c = categorize(input({ to: "someone@else.com", subject: "FYI numbers", snippet: "Sharing." }));
    expect(c).toBe("fyi");
  });
});

describe("your own mail", () => {
  it("is already actioned", () => {
    expect(categorize(input({ labelIds: ["SENT"], subject: "Can you review this?" }))).toBe("actioned");
  });
});

describe("every branch is reachable", () => {
  // The previous heuristic could never return to-respond, awaiting-reply or
  // comment, which meant the "needs a reply" count was always zero.
  it("reaches to-respond and comment", () => {
    const reached = new Set<string>();
    reached.add(categorize(input({ subject: "Can you review this?" })));
    reached.add(categorize(input({ subject: "Re: notes", snippet: "ok", to: "t@e.com" })));
    expect(reached.has("to-respond")).toBe(true);
    expect(reached.has("comment")).toBe(true);
  });
});
