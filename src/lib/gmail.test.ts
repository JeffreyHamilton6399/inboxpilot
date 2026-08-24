import { describe, it, expect } from "vitest";
import { htmlToText, extractText } from "./gmail";

const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64url");

describe("htmlToText", () => {
  it("drops tags and keeps the words", () => {
    expect(htmlToText("<p>Hello <b>there</b></p>")).toBe("Hello there");
  });

  it("drops script and style content entirely", () => {
    const out = htmlToText("<style>p{color:red}</style><p>Hi</p><script>alert(1)</script>");
    expect(out).toBe("Hi");
  });

  it("turns block ends and breaks into newlines", () => {
    expect(htmlToText("<p>One</p><p>Two</p>")).toBe("One\nTwo");
    expect(htmlToText("A<br>B")).toBe("A\nB");
  });

  it("decodes the common entities", () => {
    expect(htmlToText("<p>Tom &amp; Jerry &quot;quoted&quot; &lt;tag&gt;</p>")).toBe(
      'Tom & Jerry "quoted" <tag>'
    );
  });

  it("caps the blank-line pileup that marketing HTML produces", () => {
    // Empty layout divs become newlines; the guarantee is that runs never
    // exceed one blank line, not that the gap disappears.
    expect(htmlToText("<div>A</div><div></div><div></div><div>B</div>")).toBe("A\n\nB");
    expect(htmlToText("<p>A</p>" + "<div></div>".repeat(20) + "<p>B</p>")).toBe("A\n\nB");
  });
});

describe("extractText", () => {
  it("reads a plain single-part body", () => {
    expect(extractText({ mimeType: "text/plain", body: { data: b64("hello") } })).toBe("hello");
  });

  it("prefers plain text over HTML in multipart/alternative", () => {
    const out = extractText({
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/html", body: { data: b64("<p>html version</p>") } },
        { mimeType: "text/plain", body: { data: b64("plain version") } },
      ],
    });
    expect(out).toBe("plain version");
  });

  it("falls back to HTML, converted, when there is no plain part", () => {
    const out = extractText({
      mimeType: "multipart/alternative",
      parts: [{ mimeType: "text/html", body: { data: b64("<p>only <i>html</i></p>") } }],
    });
    expect(out).toBe("only html");
  });

  it("converts a top-level HTML-only message", () => {
    expect(extractText({ mimeType: "text/html", body: { data: b64("<p>bare</p>") } })).toBe("bare");
  });

  it("recurses into nested multipart trees", () => {
    const out = extractText({
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "application/pdf", body: {} },
        {
          mimeType: "multipart/alternative",
          parts: [{ mimeType: "text/plain", body: { data: b64("buried") } }],
        },
      ],
    });
    expect(out).toBe("buried");
  });

  it("returns empty rather than throwing on an empty payload", () => {
    expect(extractText(undefined)).toBe("");
    expect(extractText({})).toBe("");
  });

  it("decodes base64url, which is what Gmail actually sends", () => {
    // Characters that differ between base64 and base64url.
    const text = "subjects>>??~~";
    expect(extractText({ mimeType: "text/plain", body: { data: b64(text) } })).toBe(text);
  });
});
