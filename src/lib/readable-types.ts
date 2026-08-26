/**
 * Which content types can be turned into text for the model.
 *
 * Kept apart from `attachment-text.ts` because that module is server-only —
 * it loads pdf.js — while the UI needs the same answer to decide whether
 * offering to answer questions about a file is honest. Two copies of this
 * rule would drift, and the drift would show up as an Ask box that always
 * fails.
 */

const TEXT_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/x-yaml",
  "application/javascript",
]);

/** Strips any `; charset=…` and lowercases, so callers can pass a raw header. */
function normalize(mimeType: string): string {
  return mimeType.toLowerCase().split(";")[0].trim();
}

export function isTextual(mimeType: string): boolean {
  const type = normalize(mimeType);
  return type.startsWith("text/") || TEXT_TYPES.has(type);
}

/** True when the file can be read as text — a PDF, or something already textual. */
export function canExtractText(mimeType: string): boolean {
  const type = normalize(mimeType);
  return type === "application/pdf" || isTextual(type);
}
