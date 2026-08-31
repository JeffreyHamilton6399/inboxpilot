"use client";

import * as React from "react";
import { shouldHandleKey, type KeyTarget } from "@/lib/hotkeys";

export type HotkeyMap = Record<string, () => void>;

/**
 * Binds single-key shortcuts to the document.
 *
 * The map is held in a ref so that handlers closing over current state do not
 * have to be stable — rebinding the listener on every render would drop
 * keystrokes in between.
 */
export function useHotkeys(handlers: HotkeyMap, enabled = true): void {
  const latest = React.useRef(handlers);
  // Updated after each render rather than during one, so the listener always
  // calls the newest closures without being torn down and rebuilt.
  React.useEffect(() => {
    latest.current = handlers;
  });

  React.useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // While a modal is open the keyboard belongs to it. Without this, the
      // confirm dialog for "archive this whole category" would happily take an
      // `e` behind its own back and archive something else.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (!shouldHandleKey(event, event.target as KeyTarget | null)) return;
      const handler = latest.current[event.key];
      if (!handler) return;
      event.preventDefault();
      handler();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
