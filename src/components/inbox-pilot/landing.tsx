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
  Mail,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Wordmark, Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    title: "Smart inbox organizer",
    desc: "Every incoming email auto-sorted into clear categories — To Respond, FYI, Awaiting Reply, and more. Customize them to fit how you work.",
    color: "text-amber-500",
  },
  {
    icon: PenLine,
    title: "Drafts in your voice",
    desc: "Reply drafts written the way you actually write. Train your tone profile once and refine every draft before you hit send — the AI never sends for you.",
    color: "text-teal-500",
  },
  {
    icon: MessagesSquare,
    title: "Chat with your inbox",
    desc: "Ask 'who haven't I replied to?' or 'summarize this thread' in plain English. Streaming answers grounded in your real emails.",
    color: "text-violet-500",
  },
  {
    icon: CalendarClock,
    title: "Meeting summaries",
    desc: "Paste any transcript and get a tight summary plus concrete action items. No bot joins your call.",
    color: "text-fuchsia-500",
  },
  {
    icon: ShieldCheck,
    title: "Your account, your data",
    desc: "Log in, connect Gmail with read + send scope, and your email flows through your own deployment. Not a third-party inbox SaaS.",
    color: "text-emerald-500",
  },
  {
    icon: Zap,
    title: "Bring your own AI",
    desc: "Plug in Grok out of the box, or run on the built-in fallback with zero configuration. Open architecture — swap models any time.",
    color: "text-orange-500",
  },
];

const COMPARISON = [
  { feature: "Price", others: "$20–50 / user / month", ip: "Free, forever" },
  { feature: "Open source", others: false, ip: true },
  { feature: "Self-hostable", others: false, ip: true },
  { feature: "You own the AI key", others: false, ip: true },
  { feature: "Customizable categories", others: "Fixed set", ip: "Fully editable" },
  { feature: "AI draft replies", others: true, ip: true },
  { feature: "Inbox chat", others: true, ip: true },
  { feature: "Bot-free meeting notes", others: "Bot joins call", ip: true },
  { feature: "Real email client", others: "Overlay only", ip: true },
  { feature: "Free tier", others: "Trial only", ip: "Always free" },
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
            <Mail className="h-3.5 w-3.5" /> your inbox · organized by AI
          </div>
          <div className="ml-auto">
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3 w-3 mr-1" /> AI on
            </Badge>
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
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#compare" className="hover:text-foreground transition-colors">Why free</a>
            <a href="#self-host" className="hover:text-foreground transition-colors">Self-host</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => onGetStarted("login")}>
              Log in
            </Button>
            <Button size="sm" onClick={() => onGetStarted("signup")} className="brand-gradient text-white">
              Get started <ArrowRight className="h-4 w-4 ml-1.5" />
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
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <Badge variant="outline" className="mb-5 gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                  Open source · free · your own email
                </Badge>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }} className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
                Your email,{" "}
                <span className="text-brand-gradient">finally organized.</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.12 }} className="mt-5 text-lg text-muted-foreground max-w-xl">
                InboxPilot is the AI email client. Log in, connect Gmail, and let AI
                organize your inbox, draft replies in your voice, and answer
                questions about your email — all in one place, all free.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 }} className="mt-7 flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={() => onGetStarted("signup")} className="brand-gradient text-white h-12 px-6 text-base">
                  Get started free <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                  <a href="#self-host">
                    <Github className="h-4 w-4 mr-2" /> Self-host on Vercel
                  </a>
                </Button>
              </motion.div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> No credit card</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> Connects to your Gmail</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" /> You own your data</span>
              </div>
            </div>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.15 }}>
              <MockInbox />
            </motion.div>
          </div>
        </section>

        {/* Trust bar */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { k: "$0", v: "forever, no paid tiers" },
              { k: "100%", v: "open source, MIT licensed" },
              { k: "1 min", v: "to connect Gmail" },
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
              Everything an inbox assistant should be.{" "}
              <span className="text-brand-gradient">Nothing it shouldn&apos;t.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              A complete AI email client — built to be owned, forked, and self-hosted.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.35 }}>
                <Card className="h-full hover:shadow-md transition-shadow border-border/60">
                  <CardContent className="p-6">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-4">
                      <f.icon className={`h-5 w-5 ${f.color}`} />
                    </div>
                    <h3 className="font-semibold text-lg">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section id="compare" className="bg-muted/30 border-y py-16 md:py-24">
          <div className="mx-auto max-w-4xl px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Why pay for an inbox assistant?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Most AI email tools charge $20–50/user/month and lock you into their
                cloud. InboxPilot is free, open source, and runs on your account.
              </p>
            </div>
            <Card className="overflow-hidden">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] text-sm">
                <div className="p-4 font-medium border-b bg-muted/40">Feature</div>
                <div className="p-4 font-medium border-b border-l bg-muted/40 text-center">Paid AI inbox tools</div>
                <div className="p-4 font-medium border-b border-l bg-emerald-500/10 text-center">
                  <span className="inline-flex items-center gap-1.5"><Logo size={18} /> InboxPilot</span>
                </div>
                {COMPARISON.map((row, i) => (
                  <React.Fragment key={row.feature}>
                    <div className={`p-4 ${i === COMPARISON.length - 1 ? "" : "border-b"} text-foreground/90`}>{row.feature}</div>
                    <div className={`p-4 ${i === COMPARISON.length - 1 ? "" : "border-b"} border-l text-center text-muted-foreground`}>
                      {typeof row.others === "boolean" ? (row.others ? <Check className="h-4 w-4 mx-auto text-muted-foreground" /> : <X className="h-4 w-4 mx-auto text-rose-400" />) : row.others}
                    </div>
                    <div className={`p-4 ${i === COMPARISON.length - 1 ? "" : "border-b"} border-l text-center bg-emerald-500/5 font-medium`}>
                      {typeof row.ip === "boolean" ? (row.ip ? <Check className="h-4 w-4 mx-auto text-emerald-600" /> : <X className="h-4 w-4 mx-auto text-rose-400" />) : row.ip}
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
                <Badge variant="outline" className="mb-4 gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                  <Lock className="h-3 w-3" /> Private by default
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight">Run it on your own Vercel account</h2>
                <p className="mt-3 text-muted-foreground">
                  Clone the repo, add your AI key as an environment variable, and
                  deploy. Your email flows through your model key on your own
                  infrastructure — never a third-party SaaS.
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
                <div className="px-4 py-2 border-b bg-muted/40 text-xs text-muted-foreground font-mono">deploy in 3 steps</div>
                <pre className="p-4 text-xs leading-relaxed overflow-x-auto scroll-thin font-mono">
{`# 1. clone
git clone https://github.com/you/inboxpilot
cd inboxpilot

# 2. add your AI key + Google OAuth
cp .env.example .env.local
#   fill in GROK_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

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
          <div className="flex items-center gap-2"><Wordmark /></div>
          <p className="flex items-center gap-1.5">
            Built with <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" /> as free, open-source software · MIT License
          </p>
          <div className="flex items-center gap-4">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#compare" className="hover:text-foreground transition-colors">Why free</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
