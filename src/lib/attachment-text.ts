import "server-only";

/**
 * Turns an attachment into text a chat model can read.
 *
 * The configured provider is an OpenAI-compatible `/chat/completions`
 * endpoint, which takes text and nothing else. So a PDF has to be turned into
 * words here rather than handed over whole, and an image cannot be answered
 * about at all — saying so is better than sending a filename and letting the
 * model invent the contents.
 */

/** Roughly 15k tokens of the file, leaving the rest of the window for the answer. */
export const MAX_EXTRACTED_CHARS = 60_000;

export type Extraction =
  | { status: "ok"; text: string; pages?: number; truncated: boolean }
  | { status: "unsupported"; reason: string }
  | { status: "empty"; reason: string };

const TEXT_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/x-yaml",
  "application/javascript",
]);

function isTextual(mimeType: string): boolean {
  const type = mimeType.toLowerCase().split(";")[0].trim();
  return type.startsWith("text/") || TEXT_TYPES.has(type);
}

function cap(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_EXTRACTED_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_EXTRACTED_CHARS), truncated: true };
}

/** Collapses the runs of whitespace PDF extraction leaves behind. */
export function tidy(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractAttachmentText(
  mimeType: string,
  data: Buffer
): Promise<Extraction> {
  const type = mimeType.toLowerCase().split(";")[0].trim();

  if (type === "application/pdf") return extractPdf(data);

  if (isTextual(type)) {
    const tidied = tidy(data.toString("utf-8"));
    if (!tidied) return { status: "empty", reason: "That file is empty." };
    const { text, truncated } = cap(tidied);
    return { status: "ok", text, truncated };
  }

  if (type.startsWith("image/")) {
    return {
      status: "unsupported",
      reason:
        "This model reads text only, so it cannot look at images. Open the image to read it yourself.",
    };
  }

  return {
    status: "unsupported",
    reason: `Cannot read ${mimeType || "this file type"} as text. PDFs and text files work.`,
  };
}

async function extractPdf(data: Buffer): Promise<Extraction> {
  try {
    // Imported here rather than at module load: it pulls in a copy of pdf.js,
    // which is not worth paying for on requests that never touch a PDF.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });

    const tidied = tidy(Array.isArray(text) ? text.join("\n\n") : text);
    if (!tidied) {
      return {
        status: "empty",
        // A scan is pages of pictures; there is no text layer to pull out.
        reason:
          "No text in this PDF — it is likely a scan. Reading it would need OCR, which is not set up.",
      };
    }

    const capped = cap(tidied);
    return { status: "ok", text: capped.text, pages: totalPages, truncated: capped.truncated };
  } catch (err) {
    return {
      status: "unsupported",
      reason: `That PDF could not be read: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
