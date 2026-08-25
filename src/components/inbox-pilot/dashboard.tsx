"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Inbox,
  MessagesSquare,
  CalendarClock,
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  Github,
  CircleDot,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { useEmails } from "@/lib/use-emails";
import { Wordmark } from "./logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { HealthResponse, ToneProfile } from "@/lib/types";
import { InboxView } from "./inbox-view";
import { ChatView } from "./chat-view";
import { MeetingsView } from "./meetings-view";
import { SettingsView } from "./settings-view";

type ViewId = "inbox" | "chat" | "meetings" | "settings";

/**
 * Settings is deliberately not here. Three destinations do not need a rail down
 * the side of the screen, and the fourth is something you visit twice — it
 * lives in the account menu, where that kind of thing belongs.
 */
const NAV: { id: ViewId; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "chat", label: "Ask", icon: MessagesSquare },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;
  const isDark = theme === "dark";
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(isDark ? "light" : "dark")}>
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

/**
 * Who is actually serving the model.
 *
 * The badge showed the model id alone, so a Groq deployment running
 * openai/gpt-oss-120b read as "OpenAI" — the id names who trained the weights,
 * not who is answering the request. Naming the host and dropping the vendor
 * prefix says the true thing in less space.
 */
const PROVIDER_NAMES: Record<string, string> = {
  "api.groq.com": "Groq",
  "api.x.ai": "xAI",
  "api.openai.com": "OpenAI",
  "api.anthropic.com": "Anthropic",
  "api.together.xyz": "Together",
  "openrouter.ai": "OpenRouter",
};

function describeProvider(host: string, model: string): string {
  const known = PROVIDER_NAMES[host];
  const provider =
    known ?? (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ? "Local" : host);
  // "openai/gpt-oss-120b" -> "gpt-oss-120b": the prefix is the weights' origin
  // and is the exact thing that made this read as the wrong provider.
  const shortModel = model.includes("/") ? model.slice(model.indexOf("/") + 1) : model;
  return `${provider} · ${shortModel}`;
}

function ProviderBadge() {
  const { data } = useQuery<HealthResponse>({
    queryKey: ["ai-health"],
    queryFn: async () => {
      const res = await fetch("/api/ai/health");
      if (!res.ok) throw new Error("health check failed");
      return res.json();
    },
    staleTime: Infinity,
    retry: false,
  });

  if (!data) return null;

  return (
    <Badge
      variant="outline"
      className={cn("hidden lg:inline-flex gap-1.5 font-normal", !data.ready && "text-muted-foreground")}
      title={data.ready ? `${data.model}, served by ${data.host}` : "Set AI_API_KEY to enable AI features"}
    >
      <CircleDot className={cn("h-3 w-3", data.ready ? "text-emerald-500" : "text-muted-foreground")} />
      {data.ready ? describeProvider(data.host, data.model) : "AI not configured"}
    </Badge>
  );
}

function useToneSync() {
  const { data: session } = useSession();
  const replaceTone = useStore((s) => s.replaceTone);
  const toneHydrated = useStore((s) => s.toneHydrated);
  const setToneHydrated = useStore((s) => s.setToneHydrated);

  const { data } = useQuery({
    queryKey: ["tone", session?.user?.id],
    queryFn: async () => {
      const res = await fetch("/api/me/tone");
      if (!res.ok) return null;
      const d = await res.json();
      return d.tone as ToneProfile;
    },
    enabled: !!session?.user?.id,
  });

  React.useEffect(() => {
    if (data && !toneHydrated) {
      // Only override local defaults if the server has a real saved profile.
      if (data.name || data.role || data.samplePhrases.length) {
        replaceTone(data);
      } else {
        setToneHydrated(true);
      }
    }
  }, [data, toneHydrated, replaceTone, setToneHydrated]);
}

function NavTabs({ toRespond }: { toRespond: number }) {
  const activeView = useStore((s) => s.activeView);
  const setView = useStore((s) => s.setView);

  return (
    <nav className="flex items-center gap-1">
      {NAV.map((item) => {
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-2.5 sm:px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {/* The labels fold away on a narrow screen; the icons still read. */}
            <span className="hidden sm:inline">{item.label}</span>
            {item.id === "inbox" && toRespond > 0 && (
              <span className="text-[11px] rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 tabular-nums">
                {toRespond}
              </span>
            )}
          </button>
        );
      })}

      {/* Settings is reached from the account menu, so without this there is
          nothing on screen saying where you are or how to get back. */}
      {(activeView === "settings" || activeView === "meetings") && (
        <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 sm:px-3 py-1.5 text-sm font-medium text-primary">
          {activeView === "settings" ? (
            <SettingsIcon className="h-4 w-4 shrink-0" />
          ) : (
            <CalendarClock className="h-4 w-4 shrink-0" />
          )}
          <span className="hidden sm:inline">{activeView === "settings" ? "Settings" : "Meeting notes"}</span>
        </span>
      )}
    </nav>
  );
}

function AccountMenu() {
  const { data: session } = useSession();
  const setView = useStore((s) => s.setView);
  const email = session?.user?.email ?? "";
  const initials = email ? email.split("@")[0].slice(0, 2).toUpperCase() : "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full transition-opacity hover:opacity-80" aria-label="Account">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal">
          <div className="text-xs font-medium truncate">{session?.user?.name || email}</div>
          <div className="text-[11px] text-muted-foreground truncate">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setView("meetings")}>
          <CalendarClock className="h-4 w-4 mr-2" /> Meeting notes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setView("settings")}>
          <SettingsIcon className="h-4 w-4 mr-2" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="https://github.com/JeffreyHamilton6399/inboxpilot" target="_blank" rel="noreferrer">
            <Github className="h-4 w-4 mr-2" /> Source
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="text-rose-600 focus:text-rose-700">
          <LogOut className="h-4 w-4 mr-2" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Dashboard() {
  useToneSync();
  const activeView = useStore((s) => s.activeView);
  const setView = useStore((s) => s.setView);
  const { data: emails } = useEmails();

  const toRespond = emails?.filter((e) => e.category === "to-respond").length ?? 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="h-14 shrink-0 flex items-center gap-2 sm:gap-4 px-3 sm:px-4 border-b bg-background/80 backdrop-blur z-20">
        <button
          onClick={() => setView("inbox")}
          className="shrink-0 transition-opacity hover:opacity-80"
          aria-label="Go to inbox"
        >
          <Wordmark />
        </button>

        <div className="mx-auto sm:mx-0">
          <NavTabs toRespond={toRespond} />
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          <ProviderBadge />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeView === "inbox" && <InboxView />}
        {activeView === "chat" && <ChatView />}
        {activeView === "meetings" && <MeetingsView />}
        {activeView === "settings" && <SettingsView />}
      </main>
    </div>
  );
}
