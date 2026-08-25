import { describe, it, expect } from "vitest";
import { splitQuotedReply, tidy, unwrap } from "./message-format";

describe("tidy", () => {
  it("collapses runs of blank lines", () => {
    expect(tidy("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("strips trailing whitespace per line and around the whole thing", () => {
    expect(tidy("  \na   \n\tb\t\n  ")).toBe("a\n\tb");
  });

  it("normalises CRLF", () => {
    expect(tidy("a\r\nb")).toBe("a\nb");
  });
});

describe("splitQuotedReply", () => {
  it("cuts at the On … wrote: line", () => {
    const raw = [
      "Sounds good, Thursday works.",
      "",
      "On Tue, 3 Sep 2024 at 09:12, Sarah Chen <s@example.com> wrote:",
      "> Can you review the doc?",
      "> Thanks",
    ].join("\n");
    const { body, quoted } = splitQuotedReply(raw);
    expect(body).toBe("Sounds good, Thursday works.");
    expect(quoted).toContain("Can you review the doc?");
  });

  it("cuts at an Outlook original-message divider", () => {
    const raw = "Will do.\n\n-----Original Message-----\nFrom: someone\nBlah";
    expect(splitQuotedReply(raw).body).toBe("Will do.");
  });

  it("cuts at a trailing block of > lines with no marker", () => {
    const raw = "Yes.\n\n> the original\n> second line";
    const { body, quoted } = splitQuotedReply(raw);
    expect(body).toBe("Yes.");
    expect(quoted).toBe("> the original\n> second line");
  });

  it("keeps inline quoting that the writer replied underneath", () => {
    // This is the writer quoting a sentence to answer it, not a mail client
    // appending history. Hiding it would remove half of what they said.
    const raw = "> what time?\nThree o'clock.\n> where?\nThe usual place.";
    const { body, quoted } = splitQuotedReply(raw);
    expect(quoted).toBe("");
    expect(body).toContain("Three o'clock.");
    expect(body).toContain("The usual place.");
  });

  it("leaves a message with no quoting alone", () => {
    const raw = "Just a note.\n\nNothing quoted here.";
    expect(splitQuotedReply(raw)).toEqual({ body: raw, quoted: "" });
  });

  it("does not hide everything when the whole message is quoted", () => {
    const raw = "> only quoted content\n> nothing else";
    const { body, quoted } = splitQuotedReply(raw);
    expect(body).toBe(raw);
    expect(quoted).toBe("");
  });

  it("returns empty for an empty body rather than throwing", () => {
    expect(splitQuotedReply("")).toEqual({ body: "", quoted: "" });
    expect(splitQuotedReply("   \n\n ")).toEqual({ body: "", quoted: "" });
  });
});

describe("unwrap", () => {
  it("reflows text hard-wrapped at a fixed column", () => {
    const raw =
      "This is a long line that some mail client wrapped at about seventy two\ncharacters, which looks wrong in a wide pane.";
    expect(unwrap(raw)).toBe(
      "This is a long line that some mail client wrapped at about seventy two characters, which looks wrong in a wide pane."
    );
  });

  it("keeps paragraph breaks", () => {
    const raw = "A long enough line to be treated as wrapped content here ok\n\nSecond paragraph.";
    expect(unwrap(raw)).toContain("\n\nSecond paragraph.");
  });

  it("leaves bullet lists alone", () => {
    const raw = "Here are the things we agreed on in the meeting this morning\n- first\n- second";
    const out = unwrap(raw);
    expect(out).toContain("\n- first");
    expect(out).toContain("\n- second");
  });

  it("leaves numbered lists alone", () => {
    const raw = "Here are the things we agreed on in the meeting this morning\n1. first\n2. second";
    expect(unwrap(raw)).toContain("\n1. first");
  });

  it("leaves short lines alone, which is what signatures are made of", () => {
    const raw = "Thanks,\nAlex\nProduct\n";
    expect(unwrap(raw).trim()).toBe("Thanks,\nAlex\nProduct");
  });

  it("does not merge across a quote marker", () => {
    const raw = "A long enough line here to look like wrapped body text yes ok\n> quoted";
    expect(unwrap(raw)).toContain("\n> quoted");
  });
});
