"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import {
  MessagesSquare,
  CalendarClock,
  Settings as SettingsIcon,
  ChevronLeft,
  Sun,
  Moon,
  LogOut,
  Github,
  CircleDot,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
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
import { Onboarding } from "./onboarding";
import { InboxView } from "./inbox-view";
import { ChatView } from "./chat-view";
import { MeetingsView } from "./meetings-view";
import { SettingsView } from "./settings-view";


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
        <DropdownMenuItem onClick={() => setView("chat")}>
          <MessagesSquare className="h-4 w-4 mr-2" /> Ask about your mail
        </DropdownMenuItem>
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

/**
 * Whether to show setup instead of the app.
 *
 * The decision is made once, when the account list first arrives, and then
 * held: connecting Gmail during setup would otherwise satisfy the condition
 * mid-flow and yank the page out from under the person still reading step
 * three. Leaving is something they do, not something that happens to them.
 */
function useFirstRun() {
  const dismissed = useStore((s) => s.setupDismissed);
  const dismissSetup = useStore((s) => s.dismissSetup);
  const [showing, setShowing] = React.useState<boolean | null>(null);

  const { data, isSuccess } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as { accounts: unknown[] };
    },
  });

  React.useEffect(() => {
    if (showing !== null || !isSuccess) return;
    setShowing(!dismissed && (data?.accounts.length ?? 0) === 0);
  }, [showing, isSuccess, data, dismissed]);

  return {
    // Undecided reads as "not yet" — a flash of the setup page for anyone who
    // finished it months ago is worse than a beat of the inbox loading.
    showing: showing === true,
    leave: () => {
      dismissSetup();
      setShowing(false);
    },
  };
}

export function Dashboard() {
  useToneSync();
  const firstRun = useFirstRun();
  const activeView = useStore((s) => s.activeView);
  const setView = useStore((s) => s.setView);

  if (firstRun.showing) return <Onboarding onDone={firstRun.leave} />;

  // The app is the inbox. Everything else is somewhere you go and come back
  // from, so the only navigation on screen is a way back — and it appears
  // only when there is somewhere to come back from.
  const elsewhere = activeView !== "inbox";
  const whereLabel =
    activeView === "chat" ? "Ask" : activeView === "meetings" ? "Meeting notes" : "Settings";

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="h-14 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 border-b bg-background/80 backdrop-blur z-20">
        <button
          onClick={() => setView("inbox")}
          className="shrink-0 transition-opacity hover:opacity-80"
          aria-label="Back to inbox"
        >
          <Wordmark />
        </button>

        {elsewhere && (
          <button
            onClick={() => setView("inbox")}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="font-medium text-foreground">{whereLabel}</span>
            <span className="hidden sm:inline text-xs">· back to inbox</span>
          </button>
        )}

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
