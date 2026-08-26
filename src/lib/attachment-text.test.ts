import { describe, it, expect } from "vitest";
import { extractAttachmentText, tidy, MAX_EXTRACTED_CHARS } from "./attachment-text";

/**
 * Builds a real, if minimal, PDF so the extraction is tested against bytes a
 * parser has to actually walk — not a stub that assumes it works.
 */
function makePdf(lines: string[]): Buffer {
  const escape = (s: string) => s.replace(/([\\()])/g, "\\$1");
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
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

describe("tidy", () => {
  it("collapses the whitespace PDF extraction leaves behind", () => {
    expect(tidy("a   b\t\tc")).toBe("a b c");
    expect(tidy("one\n\n\n\n\ntwo")).toBe("one\n\ntwo");
    expect(tidy("  padded  ")).toBe("padded");
  });
});

describe("extractAttachmentText: PDFs", () => {
  it("pulls the words out of a real PDF", async () => {
    const pdf = makePdf(["Invoice 4412", "Total due 8,383.68", "Due 12 September 2026"]);
    const result = await extractAttachmentText("application/pdf", pdf);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.text).toContain("Invoice 4412");
    expect(result.text).toContain("8,383.68");
    expect(result.pages).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it("says a PDF with no text layer needs OCR, rather than returning nothing", async () => {
    // A PDF with no text operators stands in for a scan.
    const blank = makePdf([]);
    const result = await extractAttachmentText("application/pdf", blank);

    expect(result.status).toBe("empty");
    if (result.status !== "empty") return;
    expect(result.reason).toMatch(/scan|OCR/i);
  });

  it("reports unreadable bytes instead of throwing", async () => {
    const result = await extractAttachmentText("application/pdf", Buffer.from("not a pdf"));
    expect(result.status).toBe("unsupported");
  });
});

describe("extractAttachmentText: text files", () => {
  it("reads a plain text file", async () => {
    const result = await extractAttachmentText("text/plain", Buffer.from("Sort code 04-00-72"));
    expect(result).toMatchObject({ status: "ok", text: "Sort code 04-00-72" });
  });

  it("reads a type declared with a charset parameter", async () => {
    const result = await extractAttachmentText("text/csv; charset=utf-8", Buffer.from("a,b\n1,2"));
    expect(result.status).toBe("ok");
  });

  it("reads JSON", async () => {
    const result = await extractAttachmentText("application/json", Buffer.from('{"a":1}'));
    expect(result.status).toBe("ok");
  });

  it("truncates a very long file and says so", async () => {
    const long = Buffer.from("x".repeat(MAX_EXTRACTED_CHARS + 5000));
    const result = await extractAttachmentText("text/plain", long);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(MAX_EXTRACTED_CHARS);
  });

  it("calls an empty file empty", async () => {
    const result = await extractAttachmentText("text/plain", Buffer.from("   \n\n  "));
    expect(result.status).toBe("empty");
  });
});

describe("extractAttachmentText: what it will not read", () => {
  it("declines images, and says why rather than guessing from the name", async () => {
    const result = await extractAttachmentText("image/png", Buffer.from([0x89, 0x50]));
    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") return;
    expect(result.reason).toMatch(/text only/i);
  });

  it("declines a binary type it cannot make words from", async () => {
    const result = await extractAttachmentText("application/zip", Buffer.from([0x50, 0x4b]));
    expect(result.status).toBe("unsupported");
    if (result.status !== "unsupported") return;
    expect(result.reason).toMatch(/PDFs and text files/i);
  });

  it("declines an empty content type without throwing", async () => {
    const result = await extractAttachmentText("", Buffer.from("x"));
    expect(result.status).toBe("unsupported");
  });
});
