"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <AccentSync />
      {children}
    </NextThemesProvider>
  );
}

/**
 * Syncs the data-accent attribute on <html> with localStorage.
 * Lets users pick an accent color independent of light/dark mode.
 */
function AccentSync() {
  React.useEffect(() => {
    const stored = localStorage.getItem("inboxpilot-accent") || "emerald";
    document.documentElement.setAttribute("data-accent", stored);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail) {
        document.documentElement.setAttribute("data-accent", detail);
        localStorage.setItem("inboxpilot-accent", detail);
      }
    };
    window.addEventListener("inboxpilot:set-accent", handler);
    return () => window.removeEventListener("inboxpilot:set-accent", handler);
  }, []);
  return null;
}

/** Call from anywhere to change the accent color. */
export function setAccent(accent: string) {
  window.dispatchEvent(new CustomEvent("inboxpilot:set-accent", { detail: accent }));
}
