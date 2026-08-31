"use client";

import * as React from "react";
import { ArrowRight, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Wordmark } from "./logo";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "./category-badge";
import type { CategoryId } from "@/lib/types";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-8" />;
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

/**
 * The six things it does, as a ruled list rather than six cards each wearing
 * an icon. An icon per feature is decoration standing where a distinction
 * should be: none of these six are told apart by a picture, and the grid of
 * them says less than the sentences do.
 */
const CAPABILITIES: { title: string; body: string }[] = [
  {
    title: "Sorted on arrival",
    body: "Mail lands in one of eight categories — To Respond, Awaiting Reply, FYI, and the rest. Every call is visible, and every call is yours to overrule.",
  },
  {
    title: "Drafts you approve",
    body: "Describe how you write once and replies come back in that register. Sending goes out in the right thread from your own account, and takes two presses — the second one names the recipient.",
  },
  {
    title: "Questions about your mail",
    body: "Ask who is still waiting on you, or what a thread concluded. Answers are grounded in the messages actually in your inbox, and cite which ones.",
  },
  {
    title: "The keyboard, if you want it",
    body: "j and k move, e archives, s stars, / searches. They stand down while you are typing, so a compose box never eats them.",
  },
  {
    title: "Meeting notes from a transcript",
    body: "Paste what was said and get the summary and the action items back. Nothing joins your call, because nothing needs to.",
  },
  {
    title: "Whichever model you like",
    body: "Anything that speaks the OpenAI chat API — Groq, xAI, OpenAI, or a model running on your own machine. One base URL, one key, swap freely.",
  },
];

const FACTS: { term: string; def: string }[] = [
  { term: "Runs on", def: "Your Vercel account, your Postgres, your Google OAuth client" },
  { term: "Reads", def: "Gmail, at the scopes you grant, revocable from Google at any time" },
  { term: "Stores", def: "Your login, your tone profile, and the OAuth tokens. Not your mail" },
  { term: "Sends to the model", def: "Only the message you are acting on, only when you act on it" },
  { term: "Licence", def: "MIT" },
];

/** Sample rows. Recognisably mail, without pretending to be anyone's. */
const SAMPLE: {
  from: string;
  subject: string;
  preview: string;
  category: CategoryId;
  time: string;
  unread?: boolean;
}[] = [
  {
    from: "Sarah Chen",
    subject: "Re: Q3 roadmap",
    preview: "This looks right to me — one question about the second milestone.",
    category: "to-respond",
    time: "8m",
    unread: true,
  },
  {
    from: "David Park",
    subject: "Following up on Thursday",
    preview: "No rush. Keeping it near the top of your pile.",
    category: "awaiting-reply",
    time: "1h",
  },
  {
    from: "Linear",
    subject: "3 issues assigned to you",
    preview: "ENG-441, ENG-448 and ENG-450 moved into your queue.",
    category: "notification",
    time: "2h",
  },
  {
    from: "Maya Singh",
    subject: "Re: debrief notes",
    preview: "Added a comment under the third section about timing.",
    category: "comment",
    time: "3h",
  },
  {
    from: "Ravi Menon",
    subject: "Moved: design review",
    preview: "Now Friday at 14:00, same room, same agenda.",
    category: "meeting-update",
    time: "5h",
  },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * A still of the inbox. Built out of the same badges and type the real one
 * uses, so it is a screenshot rather than an illustration of one.
 */
function InboxStill() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
        <span className="text-[13px] font-medium">Inbox</span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">38</span>
        <div className="ml-auto flex gap-1.5">
          <span className="rounded-full border px-2 py-0.5 text-[10.5px] text-muted-foreground">
            To Respond 4
          </span>
          <span className="hidden rounded-full border px-2 py-0.5 text-[10.5px] text-muted-foreground sm:inline">
            Marketing 12
          </span>
        </div>
      </div>

      <ul>
        {SAMPLE.map((row) => (
          <li
            key={row.subject}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
              {initials(row.from)}
            </span>
            <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
              <div className="flex items-center gap-2 sm:w-40 sm:shrink-0">
                <span
                  className={
                    row.unread
                      ? "truncate text-[13px] font-semibold"
                      : "truncate text-[13px] text-muted-foreground"
                  }
                >
                  {row.from}
                </span>
                <CategoryBadge id={row.category} showDot={false} className="sm:hidden" />
              </div>
              <div className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                <span className={row.unread ? "font-medium text-foreground" : "text-foreground"}>
                  {row.subject}
                </span>{" "}
                — {row.preview}
              </div>
            </div>
            <CategoryBadge
              id={row.category}
              showDot={false}
              className="hidden shrink-0 sm:inline-flex"
            />
            <span className="w-6 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
              {row.time}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Landing({ onGetStarted }: { onGetStarted: (tab?: "login" | "signup") => void }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5 sm:px-8">
          <Wordmark />
          <div className="flex items-center gap-1">
            <a
              href="https://github.com/JeffreyHamilton6399/inboxpilot"
              target="_blank"
              rel="noreferrer"
              className="mr-2 hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Source
            </a>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => onGetStarted("login")}>
              Log in
            </Button>
            <Button size="sm" onClick={() => onGetStarted("signup")}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-5 pt-14 pb-4 sm:px-8 md:pt-24">
          <div className="animate-fade-in">
            <p className="eyebrow">Self-hosted · MIT</p>
            <h1 className="display measure-wide mt-5 text-[2.75rem] sm:text-6xl md:text-7xl">
              An assistant for the inbox you <em>already</em> have.
            </h1>
            <p className="measure mt-6 text-[17px] leading-relaxed text-muted-foreground">
              InboxPilot connects to your Gmail, sorts what arrives, drafts replies in the way you
              write, and answers questions about your mail. It runs on your own deployment, against
              a model key you supply.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="h-11" onClick={() => onGetStarted("signup")}>
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-11"
                onClick={() => onGetStarted("login")}
              >
                I have an account
              </Button>
            </div>
          </div>

          <div
            className="animate-fade-in mt-14 md:mt-20"
            style={{ animationDelay: "120ms" }}
          >
            <InboxStill />
          </div>
        </section>

        {/* What it does */}
        <section className="mx-auto max-w-4xl px-5 pt-20 sm:px-8 md:pt-28">
          <h2 className="display measure text-3xl sm:text-4xl">
            Six things, each of which you can overrule.
          </h2>

          <dl className="mt-10 md:mt-14">
            {CAPABILITIES.map((c, i) => (
              <div
                key={c.title}
                className="rule-top flex flex-col gap-1.5 py-6 first:border-t-0 first:pt-0 md:flex-row md:gap-10 md:py-7"
              >
                <dt className="flex items-baseline gap-3 md:w-64 md:shrink-0">
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[15px] font-semibold tracking-tight">{c.title}</span>
                </dt>
                <dd className="measure text-sm leading-relaxed text-muted-foreground md:pt-px">
                  {c.body}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it runs */}
        <section className="mx-auto max-w-4xl px-5 pt-20 sm:px-8 md:pt-28">
          <h2 className="display measure text-3xl sm:text-4xl">
            Nobody operates this. <em>You</em> do.
          </h2>

          <div className="mt-10 grid gap-12 md:mt-14 md:grid-cols-[1fr_20rem] md:gap-16">
            <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
              <p>
                InboxPilot is a Next.js app you deploy to your own Vercel account, pointed at your
                own Postgres database and your own Google OAuth client. There is no InboxPilot
                server between you and Google, because there is no InboxPilot server.
              </p>
              <p>
                Gmail is read with the scopes you grant and nothing wider, and you can revoke them
                from your Google account at any time. Message bodies are fetched when you open a
                message rather than mirrored into the database.
              </p>
              <p>
                The model is whichever one you configure. Drafting a reply sends that message to the
                endpoint you chose — so pick a provider you are willing to show your mail to, or run
                a model locally and show it to no one.
              </p>
            </div>

            <dl className="self-start text-sm">
              {FACTS.map((f) => (
                <div key={f.term} className="rule-top py-3 first:border-t-0 first:pt-0">
                  <dt className="eyebrow">{f.term}</dt>
                  <dd className="mt-1.5 leading-relaxed">{f.def}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Close */}
        <section className="mx-auto max-w-4xl px-5 pt-20 pb-24 sm:px-8 md:pt-28 md:pb-32">
          <div className="rule-top pt-10 md:pt-14">
            <h2 className="display measure text-3xl sm:text-4xl">
              Read the source first, if you like.
            </h2>
            <p className="measure mt-4 text-sm leading-relaxed text-muted-foreground">
              It is about four thousand lines and it does what this page says it does. Or make an
              account and connect a mailbox — setup asks for three things and tells you which of
              them your deployment is still missing.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="h-11" onClick={() => onGetStarted("signup")}>
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="h-11" asChild>
                <a
                  href="https://github.com/JeffreyHamilton6399/inboxpilot"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the source
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Wordmark />
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/JeffreyHamilton6399/inboxpilot"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Source
            </a>
            <a
              href="https://github.com/JeffreyHamilton6399/inboxpilot/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              MIT licence
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
