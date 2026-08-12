"use client";

import * as React from "react";
import {
  Inbox,
  MessagesSquare,
  CalendarClock,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Menu,
  ArrowLeft,
  Sparkles,
  Github,
  CircleDot,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useStore, useEmails, type View } from "@/lib/store";
import { Wordmark, Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AIProvider } from "@/lib/types";
import { InboxView } from "./inbox-view";
import { ChatView } from "./chat-view";
import { MeetingsView } from "./meetings-view";
import { SettingsView } from "./settings-view";

const NAV: { id: View; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "chat", label: "AI Chat", icon: MessagesSquare },
  { id: "meetings", label: "Meetings", icon: CalendarClock },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function useStats() {
  const emails = useEmails();
  const drafts = useStore((s) => s.drafts);
  const toRespond = emails.filter((e) => e.category === "to-respond").length;
  const unread = emails.filter((e) => e.unread).length;
  const draftCount = Object.keys(drafts).length;
  // playful "hours saved" derived number
  const hoursSaved = (1.2 + draftCount * 0.4 + emails.length * 0.1).toFixed(1);
  return { toRespond, unread, draftCount, hoursSaved, total: emails.length };
}

function ProviderBadge() {
  const [info, setInfo] = React.useState<{
    provider: AIProvider;
    model: string;
  } | null>(null);
  React.useEffect(() => {
    fetch("/api/ai/health")
      .then((r) => r.json())
      .then((d) => setInfo({ provider: d.provider, model: d.model }))
      .catch(() => setInfo({ provider: "none", model: "unavailable" }));
  }, []);
  const label =
    info?.provider === "grok"
      ? `Grok · ${info.model}`
      : info?.provider === "zai"
        ? "Built-in AI"
        : "Connecting…";
  return (
    <Badge
      variant="outline"
      className="gap-1.5 font-normal border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
    >
      <CircleDot className="h-3 w-3 animate-pulse-dot" />
      {label}
    </Badge>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const activeView = useStore((s) => s.activeView);
  const setView = useStore((s) => s.setView);
  const reset = useStore((s) => s.reset);
  const stats = useStats();

  return (
    <div className="flex h-full flex-col">
      <div className="h-14 flex items-center px-4 border-b">
        <Wordmark />
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active = activeView === item.id;
          const count =
            item.id === "inbox" ? stats.toRespond : undefined;
          return (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                onNavigate?.();
              }}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {count ? (
                <span className="text-[11px] rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 tabular-nums">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="p-3 space-y-3 border-t">
        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Hours saved / wk</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {stats.hoursSaved}h
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Drafts written</span>
            <span className="font-semibold">{stats.draftCount}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Unread</span>
            <span className="font-semibold">{stats.unread}</span>
          </div>
        </div>
        <ProviderBadge />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={reset}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to site
        </Button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const activeView = useStore((s) => s.activeView);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const stats = useStats();

  const titles: Record<View, { title: string; sub: string }> = {
    inbox: {
      title: "Inbox",
      sub: `${stats.total} emails · ${stats.toRespond} need a reply`,
    },
    chat: { title: "AI Chat", sub: "Ask anything about your inbox" },
    meetings: { title: "Meetings", sub: "Transcripts & AI summaries" },
    settings: { title: "Settings", sub: "Tone profile & categories" },
  };
  const t = titles[activeView];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center gap-2 h-14 px-3 border-b bg-background sticky top-0 z-30">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <Wordmark />
      </div>

      <div className="flex-1 flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 shrink-0 border-r bg-sidebar/50 flex-col">
          <SidebarContent />
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="hidden md:flex h-14 items-center gap-4 px-6 border-b bg-background/80 backdrop-blur sticky top-0 z-20">
            <div className="min-w-0">
              <h1 className="font-semibold leading-tight truncate">{t.title}</h1>
              <p className="text-xs text-muted-foreground truncate">{t.sub}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="https://github.com" target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4 mr-1.5" /> Source
                </a>
              </Button>
              <Button
                size="sm"
                className="brand-gradient text-white"
                onClick={() => useStore.getState().setView("chat")}
              >
                <Sparkles className="h-4 w-4 mr-1.5" /> Ask AI
              </Button>
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 min-h-0 overflow-hidden">
            {activeView === "inbox" && <InboxView />}
            {activeView === "chat" && <ChatView />}
            {activeView === "meetings" && <MeetingsView />}
            {activeView === "settings" && <SettingsView />}
          </main>
        </div>
      </div>
    </div>
  );
}
