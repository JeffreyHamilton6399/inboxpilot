import type { Email } from "./types";
import { CATEGORY_MAP } from "./defaults";

/**
 * What the model is told about the inbox when you ask it a question.
 *
 * The old context was one line per message — sender, category, subject and
 * Gmail's snippet — for the twelve messages that scored highest on a local
 * relevance heuristic. It carried no dates at all, which meant "what has been
 * sitting in my inbox the longest?" — one of the app's own suggested prompts —
 * could only ever be answered by guessing, and the model duly guessed. It also
 * carried no read state and no starring, so "who is waiting on me" had nothing
 * to work from but the category label.
 *
 * So: every loaded message rather than a chosen twelve, newest first, each
 * with when it arrived, whether it has been read, and whether it is starred.
 * Forty lines of this is a few thousand characters — nothing next to the
 * context window, and the difference between an answer and a plausible
 * sentence.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * "Thu 28 Aug, 09:14". Hand-rolled rather than taken from `toLocaleString` so
 * that the same message produces the same line on a machine in any locale —
 * a prompt that changes shape with the server's language settings is a prompt
 * nobody can reason about.
 */
export function absoluteTime(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/** How long ago, in the coarsest unit that still says something useful. */
export function relativeAge(from: Date, now: Date): string {
  const mins = Math.floor((now.getTime() - from.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Collapses the whitespace a snippet arrives with and trims it to length. */
export function tidySnippet(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

export interface InboxContextOptions {
  /** The reader's clock. Passed in so ages are stable and testable. */
  now: Date;
  /** How many messages to describe, newest first. */
  limit?: number;
  /** How much of each snippet to keep. */
  snippetChars?: number;
}

/**
 * One block of plain text describing the loaded inbox, newest first.
 *
 * Returns an empty string for an empty inbox, so callers can tell "no mail"
 * from "mail I have not described" rather than sending a heading with nothing
 * under it and letting the model decide what that meant.
 */
export function buildInboxContext(
  emails: Email[],
  { now, limit = 40, snippetChars = 220 }: InboxContextOptions
): string {
  if (emails.length === 0) return "";

  const newestFirst = [...emails].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );
  const shown = newestFirst.slice(0, limit);

  const lines = shown.map((e, i) => {
    const at = new Date(e.receivedAt);
    const flags = [
      e.unread ? "unread" : "read",
      e.starred ? "starred" : null,
      e.hasAttachment ? "has attachment" : null,
    ].filter(Boolean);

    const category = CATEGORY_MAP[e.category]?.label ?? e.category;
    const sender = e.from.email ? `${e.from.name} <${e.from.email}>` : e.from.name;

    return [
      `[${i + 1}] ${relativeAge(at, now)} (${absoluteTime(at)}) · ${flags.join(", ")} · ${category}`,
      `    from: ${sender}`,
      `    subject: ${tidySnippet(e.subject, 160) || "(no subject)"}`,
      `    snippet: ${tidySnippet(e.preview, snippetChars) || "(none)"}`,
    ].join("\n");
  });

  const omitted = newestFirst.length - shown.length;
  const footer = omitted > 0 ? `\n\n(${omitted} older loaded messages not listed.)` : "";

  return `${shown.length} message${shown.length === 1 ? "" : "s"} from the inbox, newest first:\n\n${lines.join(
    "\n\n"
  )}${footer}`;
}
