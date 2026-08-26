import { describe, it, expect } from "vitest";
import { extractAttachments } from "./gmail";

/** Shapes a Gmail part the way the API actually returns one. */
const filePart = (
  filename: string,
  mimeType: string,
  attachmentId: string,
  extra: Record<string, unknown> = {}
) => ({
  filename,
  mimeType,
  body: { attachmentId, size: 1024 },
  ...extra,
});

describe("extractAttachments", () => {
  it("returns nothing for a plain-text message", () => {
    expect(
      extractAttachments({ mimeType: "text/plain", body: { data: "aGk=" } })
    ).toEqual([]);
  });

  it("returns nothing when there is no payload at all", () => {
    expect(extractAttachments(undefined)).toEqual([]);
  });

  it("finds a file alongside the body parts", () => {
    const found = extractAttachments({
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/plain", body: { data: "aGk=" } },
        { mimeType: "text/html", body: { data: "PHA+aGk8L3A+" } },
        filePart("invoice.pdf", "application/pdf", "ATT-1"),
      ],
    });

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      id: "ATT-1",
      filename: "invoice.pdf",
      mimeType: "application/pdf",
      size: 1024,
      inline: false,
    });
  });

  it("walks nested multipart trees", () => {
    // multipart/mixed wrapping multipart/alternative is the common shape for
    // "formatted message plus a file", and the file sits a level down.
    const found = extractAttachments({
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: "aGk=" } },
            { mimeType: "text/html", body: { data: "PHA+aGk8L3A+" } },
          ],
        },
        {
          mimeType: "multipart/related",
          parts: [filePart("deck.pptx", "application/vnd.ms-powerpoint", "ATT-2")],
        },
      ],
    });

    expect(found.map((a) => a.filename)).toEqual(["deck.pptx"]);
  });

  it("flags a cid-referenced part as inline", () => {
    const found = extractAttachments({
      mimeType: "multipart/related",
      parts: [
        filePart("logo.png", "image/png", "ATT-3", {
          headers: [
            { name: "Content-Disposition", value: "inline; filename=\"logo.png\"" },
            { name: "Content-ID", value: "<logo@sig>" },
          ],
        }),
      ],
    });

    expect(found[0].inline).toBe(true);
  });

  it("does not flag an ordinary attachment as inline", () => {
    // A Content-ID with an attachment disposition is still a real file — both
    // halves have to say inline before it is treated as decoration.
    const found = extractAttachments({
      parts: [
        filePart("report.pdf", "application/pdf", "ATT-4", {
          headers: [
            { name: "Content-Disposition", value: "attachment; filename=\"report.pdf\"" },
            { name: "Content-ID", value: "<report@x>" },
          ],
        }),
      ],
    });

    expect(found[0].inline).toBe(false);
  });

  it("ignores a part with a filename but no attachment id", () => {
    // Small inline bodies arrive with data rather than an id; there is
    // nothing to fetch, so they are not offered as downloads.
    const found = extractAttachments({
      parts: [{ filename: "note.txt", mimeType: "text/plain", body: { data: "aGk=" } }],
    });

    expect(found).toEqual([]);
  });

  it("falls back to a generic type when Gmail omits one", () => {
    const found = extractAttachments({
      parts: [{ filename: "data", body: { attachmentId: "ATT-5", size: 12 } }],
    });

    expect(found[0].mimeType).toBe("application/octet-stream");
  });

  it("keeps every file when several are attached", () => {
    const found = extractAttachments({
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/plain", body: { data: "aGk=" } },
        filePart("a.pdf", "application/pdf", "ATT-6"),
        filePart("b.png", "image/png", "ATT-7"),
        filePart("c.zip", "application/zip", "ATT-8"),
      ],
    });

    expect(found.map((a) => a.id)).toEqual(["ATT-6", "ATT-7", "ATT-8"]);
  });
});
