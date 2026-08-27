/**
 * When a keystroke is a shortcut and when it is just typing.
 *
 * Kept as plain functions over a minimal shape rather than reaching into the
 * DOM, so the rule that decides whether pressing `e` archives your mail or
 * writes the letter "e" can be tested directly. Getting this wrong is the
 * classic way a shortcut feature becomes a bug report about a compose box
 * that eats letters.
 */

/** The part of an event target this needs. */
export interface KeyTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

/** The part of a keyboard event this needs. */
export interface KeyChord {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/** True when whatever is focused is somewhere a person types. */
export function isTypingTarget(target: KeyTarget | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Whether a keystroke should reach the shortcuts at all.
 *
 * Escape is the exception that still counts inside a field: it is how you get
 * back out of one, and a search box you cannot escape from is a trap.
 */
export function shouldHandleKey(event: KeyChord, target: KeyTarget | null | undefined): boolean {
  // Anything with a modifier belongs to the browser or the OS.
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (isTypingTarget(target)) return event.key === "Escape";
  return true;
}
