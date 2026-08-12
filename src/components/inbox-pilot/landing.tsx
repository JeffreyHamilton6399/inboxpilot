"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Github,
  Inbox,
  PenLine,
  MessagesSquare,
  CalendarClock,
  ShieldCheck,
  Sparkles,
  Check,
  X,
  Sun,
  Moon,
  Zap,
  Lock,
  Heart,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useStore } from "@/lib/store";
import { Wordmark, Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "./category-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted)
    return <div className="h-9 w-9 rounded-md border border-border" />;
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
    title: "AI Inbox Organizer",
    desc: "Every incoming email auto-sorted into smart categories — To Respond, FYI, Awaiting Reply, and more. Customizable, unlike the fixed 8 you're stuck with elsewhere.",
    color: "text-amber-500",
  },
  {
    icon: PenLine,
    title: "Tone-matched drafts",
    desc: "Reply drafts written in your voice, trained on the phrases you actually use. You review, you hit send — the AI never sends for you.",
    color: "text-teal-500",
  },
  {
    icon: MessagesSquare,
    title: "Chat with your inbox",
    desc: "Ask 'who haven't I replied to?' or 'summarize Priya's candidacy' in plain English. Streaming answers grounded in your real emails.",
    color: "text-violet-500",
  },
  {
    icon: CalendarClock,
    title: "Meeting summaries",
    desc: "Drop in a transcript and get a tight summary plus concrete action items in seconds. No bot required, no meeting hijacked.",
    color: "text-fuchsia-500",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    desc: "Self-host on your own Vercel account with your own API key. Your inbox never touches a third-party SaaS. Your data stays yours.",
    color: "text-emerald-500",
  },
  {
    icon: Zap,
    title: "Bring your own model",
    desc: "Plug in Grok out of the box, or run on the built-in fallback with zero configuration. Open architecture — swap models any time.",
    color: "text-orange-500",
  },
];

const COMPARISON = [
  { feature: "Price", fyxer: "$22–50 / user / month", ip: "Free, forever" },
  { feature: "Open source", fyxer: false, ip: true },
  { feature: "Self-hostable", fyxer: false, ip: true },
  { feature: "Your own API key", fyxer: false, ip: true },
  { feature: "Customizable categories", fyxer: "Fixed 8", ip: "Fully editable" },
  { feature: "AI draft replies", fyxer: true, ip: true },
  { feature: "Inbox chat / RAG", fyxer: true, ip: true },
  { feature: "Meeting summaries", fyxer: "Bot joins call", ip: "Bot-free" },
  { feature: "Free trial", fyxer: "7 days, card required", ip: "No trial needed" },
  { feature: "Privacy", fyxer: "Third-party SaaS", ip: "Runs on your account" },
];

function MockInbox() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 brand-gradient opacity-20 blur-2xl rounded-3xl" />
      <Card className="relative overflow-hidden shadow-2xl border-border/60">
        <CardHeader className="flex flex-row items-center gap-2 border-b bg-muted/40 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Inbox className="h-3.5 w-3.5" /> inbox · organized by AI
          </div>
          <div className="ml-auto">
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3 w-3 mr-1" /> 3.4h saved this week
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {[
            {
              from: "Priya Nair",
              subject: "Re: Senior Backend Engineer — interested!",
              cat: "to-respond" as const,
              time: "22m",
              unread: true,
              color: "bg-violet-500",
            },
            {
              from: "Marcus Lee",
              subject: "Intro: Jordan (ex-Stripe) → portfolio",
              cat: "to-respond" as const,
              time: "48m",
              unread: true,
              color: "bg-teal-500",
            },
            {
              from: "Sana Ahmed",
              subject: "Following up — take-home feedback?",
              cat: "awaiting-reply" as const,
              time: "2h",
              unread: false,
              color: "bg-rose-500",
            },
            {
              from: "Tom B.",
              subject: "Re: debrief for Priya — go/no go?",
              cat: "comment" as const,
              time: "3h",
              unread: false,
              color: "bg-emerald-500",
            },
            {
              from: "Calendly",
              subject: "New event: Intro call with Devon",
              cat: "meeting-update" as const,
              time: "1h",
              unread: false,
              color: "bg-stone-500",
            },
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
                  <span
                    className={`text-sm truncate ${e.unread ? "font-semibold" : "font-medium text-muted-foreground"}`}
                  >
                    {e.from}
                  </span>
                  {e.unread && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                  <CategoryBadge id={e.cat} showDot={false} />
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {e.subject}
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {e.time}
              </span>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function Landing() {
  const launch = useStore((s) => s.launch);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#compare" className="hover:text-foreground transition-colors">
              vs Fyxer
            </a>
            <a href="#self-host" className="hover:text-foreground transition-colors">
              Self-host
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              asChild
              className="hidden sm:inline-flex"
            >
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
              >
                <Github className="h-4 w-4 mr-1.5" /> Star
              </a>
            </Button>
            <Button size="sm" onClick={launch} className="brand-gradient text-white">
              Launch app <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-60" />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-[40rem] brand-gradient opacity-20 blur-3xl rounded-full" />
          <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 md:pt-24 md:pb-20 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Badge
                  variant="outline"
                  className="mb-5 gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                  Open source · MIT · free forever
                </Badge>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05 }}
                className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]"
              >
                The AI inbox assistant,{" "}
                <span className="text-brand-gradient">without the bill.</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.12 }}
                className="mt-5 text-lg text-muted-foreground max-w-xl"
              >
                InboxPilot auto-organizes your inbox, drafts replies in your voice,
                and lets you chat with your email — just like Fyxer. Except it's
                free, open source, and runs on your own account.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.2 }}
                className="mt-7 flex flex-col sm:flex-row gap-3"
              >
                <Button
                  size="lg"
                  onClick={launch}
                  className="brand-gradient text-white h-12 px-6 text-base"
                >
                  Launch the demo <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-6 text-base"
                  asChild
                >
                  <a href="#self-host">
                    <Github className="h-4 w-4 mr-2" /> Self-host on Vercel
                  </a>
                </Button>
              </motion.div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> No credit card
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> No data leaves your account
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Deploys in 60 seconds
                </span>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <MockInbox />
            </motion.div>
          </div>
        </section>

        {/* Trust bar */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { k: "$0", v: "vs Fyxer's $22–50/user/mo" },
              { k: "100%", v: "open source, MIT licensed" },
              { k: "60s", v: "to deploy on Vercel" },
              { k: "8", v: "smart inbox categories" },
            ].map((s) => (
              <div key={s.v}>
                <div className="text-3xl font-bold text-brand-gradient">{s.k}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything Fyxer does.{" "}
              <span className="text-brand-gradient">None of the lock-in.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              A complete AI executive assistant for your inbox — built to be owned,
              forked, and self-hosted.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35 }}
              >
                <Card className="h-full hover:shadow-md transition-shadow border-border/60">
                  <CardContent className="p-6">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-4">
                      <f.icon className={`h-5 w-5 ${f.color}`} />
                    </div>
                    <h3 className="font-semibold text-lg">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {f.desc}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section
          id="compare"
          className="bg-muted/30 border-y py-16 md:py-24"
        >
          <div className="mx-auto max-w-4xl px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                InboxPilot vs Fyxer
              </h2>
              <p className="mt-4 text-muted-foreground">
                Same superpowers. Your data, your account, your price: free.
              </p>
            </div>
            <Card className="overflow-hidden">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] text-sm">
                <div className="p-4 font-medium border-b bg-muted/40">Feature</div>
                <div className="p-4 font-medium border-b border-l bg-muted/40 text-center">
                  Fyxer
                </div>
                <div className="p-4 font-medium border-b border-l bg-emerald-500/10 text-center">
                  <span className="inline-flex items-center gap-1.5">
                    <Logo size={18} /> InboxPilot
                  </span>
                </div>
                {COMPARISON.map((row, i) => (
                  <React.Fragment key={row.feature}>
                    <div
                      className={`p-4 ${i === COMPARISON.length - 1 ? "" : "border-b"} text-foreground/90`}
                    >
                      {row.feature}
                    </div>
                    <div
                      className={`p-4 ${i === COMPARISON.length - 1 ? "" : "border-b"} border-l text-center text-muted-foreground`}
                    >
                      {typeof row.fyxer === "boolean" ? (
                        row.fyxer ? (
                          <Check className="h-4 w-4 mx-auto text-muted-foreground" />
                        ) : (
                          <X className="h-4 w-4 mx-auto text-rose-400" />
                        )
                      ) : (
                        row.fyxer
                      )}
                    </div>
                    <div
                      className={`p-4 ${i === COMPARISON.length - 1 ? "" : "border-b"} border-l text-center bg-emerald-500/5 font-medium`}
                    >
                      {typeof row.ip === "boolean" ? (
                        row.ip ? (
                          <Check className="h-4 w-4 mx-auto text-emerald-600" />
                        ) : (
                          <X className="h-4 w-4 mx-auto text-rose-400" />
                        )
                      ) : (
                        row.ip
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* Self-host CTA */}
        <section id="self-host" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <Card className="relative overflow-hidden border-border/60">
            <div className="absolute inset-0 brand-gradient opacity-10" />
            <CardContent className="relative p-8 md:p-12 grid md:grid-cols-2 gap-8 items-center">
              <div>
                <Badge
                  variant="outline"
                  className="mb-4 gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                >
                  <Lock className="h-3 w-3" /> Private by default
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight">
                  Run it on your own Vercel account
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Clone the repo, add your Grok API key as an environment variable,
                  and deploy. Your inbox context flows through your model key on your
                  own infrastructure — never a third-party SaaS.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button className="brand-gradient text-white" asChild>
                    <a href="https://vercel.com/new" target="_blank" rel="noreferrer">
                      Deploy to Vercel <ArrowRight className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="https://github.com" target="_blank" rel="noreferrer">
                      <Github className="h-4 w-4 mr-2" /> View source
                    </a>
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border bg-background/60 overflow-hidden">
                <div className="px-4 py-2 border-b bg-muted/40 text-xs text-muted-foreground font-mono">
                  deploy in 3 steps
                </div>
                <pre className="p-4 text-xs leading-relaxed overflow-x-auto scroll-thin font-mono">
{`# 1. clone
git clone https://github.com/you/inboxpilot
cd inboxpilot

# 2. add your Grok key
echo "GROK_API_KEY=xai-..." > .env

# 3. deploy
vercel --prod`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Wordmark />
          </div>
          <p className="flex items-center gap-1.5">
            Built with <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" /> as
            an open-source alternative to Fyxer · MIT License
          </p>
          <div className="flex items-center gap-4">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#compare" className="hover:text-foreground transition-colors">
              Compare
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
