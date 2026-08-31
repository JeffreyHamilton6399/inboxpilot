import { describe, it, expect } from "vitest";
import { buildListQuery } from "./gmail";

describe("buildListQuery", () => {
  it("falls back to the inbox when nothing is typed", () => {
    expect(buildListQuery()).toBe("in:inbox");
    expect(buildListQuery("")).toBe("in:inbox");
    expect(buildListQuery("   ")).toBe("in:inbox");
  });

  it("searches all mail rather than only the inbox", () => {
    // The point of the change: an archived message from last year is findable,
    // which it was not when searching meant filtering the loaded forty.
    expect(buildListQuery("invoice")).toBe("invoice");
    expect(buildListQuery("invoice")).not.toContain("in:inbox");
  });

  it("hands Gmail's own operators through untouched", () => {
    expect(buildListQuery("from:sarah has:attachment")).toBe(
      "from:sarah has:attachment"
    );
    expect(buildListQuery("older_than:7d is:unread")).toBe("older_than:7d is:unread");
  });

  it("keeps quotes and colons intact, which the operators need", () => {
    expect(buildListQuery('subject:"quarterly report"')).toBe(
      'subject:"quarterly report"'
    );
  });

  it("trims the edges without touching the middle", () => {
    expect(buildListQuery("  from:a b  ")).toBe("from:a b");
  });
});
