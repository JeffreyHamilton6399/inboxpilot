"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Inbox,
  PenLine,
  MessagesSquare,
  CalendarClock,
  ShieldCheck,
  Check,
  Sun,
  Moon,
  Zap,
  Mail,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Wordmark } from "./logo";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "./category-badge";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9 rounded-md border border-border" />;
  const isDark = theme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

const FEATURES = [
  {
    icon: Inbox,
    title: "Sorted on arrival",
    desc: "Mail lands in one of eight categories — To Respond, Awaiting Reply, FYI, and the rest. Every call is visible and every call is yours to overrule.",
  },
  {
    icon: PenLine,
    title: "Drafts, not sends",
    desc: "Describe how you write once, and replies come back in that register. Nothing leaves your account until you have read it and pressed send yourself.",
  },
  {
    icon: MessagesSquare,
    title: "Questions about your mail",
    desc: "Ask who is still waiting on you, or what a thread concluded. Answers are grounded in the messages actually in your inbox, and cite which ones.",
  },
  {
    icon: CalendarClock,
    title: "Meeting notes from a transcript",
    desc: "Paste what was said and get the summary and the action items. Nothing joins your call, because nothing needs to.",
  },
  {
    icon: ShieldCheck,
    title: "Your deployment",
    desc: "Your Vercel account, your database, your Google OAuth client. Mail moves between Google and your own deployment and stops there.",
  },
  {
    icon: Zap,
    title: "Whichever model you like",
    desc: "Anything that speaks the OpenAI chat API — Groq, xAI, OpenAI, or a model on your own machine. One base URL, one key, swap freely.",
  },
];

function MockInbox() {
  return (
    <div className="relative">
      <Card className="relative overflow-hidden shadow-lg border-border/60">
        <CardHeader className="flex flex-row items-center gap-2 border-b bg-muted/40 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-muted-foreground/25" />
            <span className="h-3 w-3 rounded-full bg-muted-foreground/25" />
            <span className="h-3 w-3 rounded-full bg-muted-foreground/25" />
          </div>
          <div className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> Inbox
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {[
            { from: "Sarah Chen", subject: "Re: Q3 roadmap — looks great", cat: "to-respond" as const, time: "8m", unread: true, color: "bg-violet-500" },
            { from: "Linear", subject: "3 issues assigned to you", cat: "notification" as const, time: "32m", unread: false, color: "bg-stone-500" },
            { from: "David Park", subject: "Following up on our chat", cat: "awaiting-reply" as const, time: "1h", unread: false, color: "bg-rose-500" },
            { from: "GitHub", subject: "PR #128 approved", cat: "notification" as const, time: "2h", unread: false, color: "bg-stone-500" },
            { from: "Maya Singh", subject: "Re: debrief notes", cat: "comment" as const, time: "3h", unread: false, color: "bg-emerald-500" },
          ].map((e, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/40 transition-colors"
            >
              <span className={`h-8 w-8 rounded-full ${e.color} shrink-0`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm truncate ${e.unread ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                    {e.from}
                  </span>
                  {e.unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  <CategoryBadge id={e.cat} showDot={false} />
                </div>
                <div className="text-xs text-muted-foreground truncate">{e.subject}</div>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">{e.time}</span>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function Landing({ onGetStarted }: { onGetStarted: (tab?: "login" | "signup") => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">What it does</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it runs</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => onGetStarted("login")}>
              Log in
            </Button>
            <Button size="sm" onClick={() => onGetStarted("signup")}>
              Get started <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-50" />
          <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 md:pt-24 md:pb-20 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
                An assistant for the inbox you already have.
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }} className="mt-5 text-lg text-muted-foreground max-w-xl">
                InboxPilot connects to your Gmail, sorts what arrives, drafts replies
                in the way you write, and answers questions about your mail. It runs on
                your own deployment, against a model key you supply.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.16 }} className="mt-7 flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={() => onGetStarted("signup")} className="h-12 px-6 text-base">
                  Get started <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 text-base" onClick={() => onGetStarted("login")}>
                  I have an account
                </Button>
              </motion.div>
              <p className="mt-6 text-xs text-muted-foreground">
                MIT licensed. Read the source, or run your own copy.
              </p>
            </div>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.15 }}>
              <MockInbox />
            </motion.div>
          </div>
        </section>

        {/* What it does */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              What it does
            </h2>
            <p className="mt-4 text-muted-foreground">
              Six things, each of which you can turn off or overrule.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.35 }}>
                <Card className="h-full border-border/60">
                  <CardContent className="p-6">
                    <f.icon className="h-5 w-5 text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How it runs */}
        <section id="how" className="bg-muted/30 border-y py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              How it runs
            </h2>
            <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
              <p>
                InboxPilot is not a service anyone operates. It is a Next.js app you
                deploy to your own Vercel account, pointed at your own Postgres
                database and your own Google OAuth client. There is no InboxPilot
                server between you and Google, because there is no InboxPilot server.
              </p>
              <p>
                Gmail is read with the scopes you grant and nothing wider, and you can
                revoke them from your Google account at any time. Message bodies are
                fetched when you open a message rather than mirrored into the database.
              </p>
              <p>
                The model is whichever one you configure. Drafting a reply sends that
                message to the endpoint you chose — so pick a provider you are willing
                to show your mail to, or run a model locally and show it to no one.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 shrink-0" /> Drafts are never sent for you
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 shrink-0" /> Revoke Gmail access from Google
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 shrink-0" /> MIT licensed, fork it
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Wordmark /></div>
          <p>MIT licensed</p>
          <div className="flex items-center gap-4">
            <a href="#features" className="hover:text-foreground transition-colors">What it does</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it runs</a>
            <a href="https://github.com/JeffreyHamilton6399/inboxpilot" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">Source</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
