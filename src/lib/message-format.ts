/**
 * Makes a raw mail body readable.
 *
 * What arrives from Gmail is either plain text hard-wrapped at some width
 * chosen in 1985, or HTML flattened to text. Both carry the entire prior
 * conversation quoted underneath, which is usually longer than the message and
 * is almost never what you came to read.
 */

/** Where the message stops and the conversation it was replying to begins. */
const QUOTE_MARKERS: RegExp[] = [
  // "On Tue, 3 Sep 2024 at 09:12, Sarah Chen <s@x.com> wrote:"
  /^On .{0,200}\bwrote:\s*$/i,
  // Outlook and friends.
  /^-{2,}\s*Original Message\s*-{2,}\s*$/i,
  /^_{5,}\s*$/,
  /^From:\s.+$/i,
  // Some clients emit this verbatim above the quote.
  /^Sent from my \w+/i,
];

export interface SplitBody {
  /** The part actually written this time. */
  body: string;
  /** The quoted history, if any. Empty string when there is none. */
  quoted: string;
}

/** Collapses runs of blank lines and strips trailing whitespace per line. */
export function tidy(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits a body into the new part and the quoted history.
 *
 * The split happens at the first quote marker, or at the first line of a run of
 * `>` quoting that continues to the end. A `>` line in the middle of a message
 * that later returns to normal text is someone quoting a sentence inline, which
 * is part of what they wrote and stays.
 */
export function splitQuotedReply(raw: string): SplitBody {
  const text = tidy(raw);
  if (!text) return { body: "", quoted: "" };

  const lines = text.split("\n");

  let cut = -1;
  for (let i = 0; i < lines.length; i++) {
    if (QUOTE_MARKERS.some((re) => re.test(lines[i].trim()))) {
      cut = i;
      break;
    }
  }

  if (cut === -1) {
    // Find a trailing block of `>` lines: walk back while every non-empty line
    // is quoted, and cut at the top of that block.
    let i = lines.length - 1;
    let sawQuote = false;
    while (i >= 0) {
      const line = lines[i].trim();
      if (line === "") {
        i--;
        continue;
      }
      if (line.startsWith(">")) {
        sawQuote = true;
        i--;
        continue;
      }
      break;
    }
    if (sawQuote) cut = i + 1;
  }

  if (cut <= 0) {
    // Either no quote at all, or the whole message is quoted — in which case
    // there is nothing to hide behind a toggle.
    return { body: text, quoted: "" };
  }

  return {
    body: tidy(lines.slice(0, cut).join("\n")),
    quoted: tidy(lines.slice(cut).join("\n")),
  };
}

/**
 * Undoes hard wrapping so text reflows to the reader's width.
 *
 * Plain-text mail is wrapped at a fixed column, which looks ragged in a pane
 * that is not that width. A line is treated as a continuation only when it is
 * long and the next line does not look like a new block — lists, quotes and
 * short lines are left exactly as they are.
 */
export function unwrap(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    const startsBlock = (l?: string) =>
      l === undefined || l.trim() === "" || /^\s*([-*•>#]|\d+[.)])\s/.test(l) || /^\s{2,}/.test(l);

    if (line.length >= 60 && !startsBlock(next) && !startsBlock(line) && out.length >= 0) {
      // Join with the following line and keep going from the merged result.
      lines[i + 1] = `${line.replace(/\s+$/, "")} ${next.replace(/^\s+/, "")}`;
      continue;
    }
    out.push(line);
  }

  return out.join("\n");
}
