"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ArrowRight, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useStore } from "@/lib/store";
import { Wordmark } from "./logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { HealthResponse, ToneProfile } from "@/lib/types";

/**
 * Setup, as a page rather than as an empty state.
 *
 * What used to happen after signing up was that the inbox rendered with
 * nothing in it and a centred "Connect your Gmail" card in the middle of the
 * void. That hides the two other things a fresh deployment usually needs —
 * a model key, and some idea of how you write — until you trip over them, and
 * it never tells you whether the server is even configured to do the thing
 * it is asking you to do.
 *
 * So: every step is on one page, every step reports its own real state from
 * the server, and the ones that are optional say so instead of looking broken.
 */

type StepState = "done" | "todo" | "optional" | "blocked" | "pending";

interface AccountsResponse {
  accounts: { id: string; provider: string; email: string; createdAt: string }[];
  gmailConfigured: boolean;
}

interface ProbedHealth extends HealthResponse {
  keyAccepted?: boolean;
  detail?: string;
}

function useAccounts() {
  return useQuery<AccountsResponse>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Could not read connected accounts");
      return res.json();
    },
  });
}

/**
 * `ready` means a key is set. `keyAccepted` means the provider agrees it is a
 * real one — and a deployment holding a wrong key reports the first without
 * the second, which is the exact state worth catching here rather than at the
 * moment somebody asks for their first draft.
 */
function useProbedHealth() {
  return useQuery<ProbedHealth>({
    queryKey: ["ai-health", "probe"],
    queryFn: async () => {
      const res = await fetch("/api/ai/health?probe=1");
      return res.json();
    },
    retry: false,
    staleTime: 60_000,
  });
}

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

const STATE_LABEL: Record<StepState, string> = {
  done: "Done",
  todo: "Needed",
  optional: "Optional",
  blocked: "Needs the server",
  pending: "Checking",
};

function StepStatus({ state }: { state: StepState }) {
  return (
    <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === "done" && "bg-emerald-500",
          state === "todo" && "bg-amber-500",
          state === "blocked" && "bg-rose-500",
          (state === "optional" || state === "pending") && "bg-muted-foreground/40"
        )}
      />
      {STATE_LABEL[state]}
    </span>
  );
}

function Step({
  index,
  state,
  title,
  children,
}: {
  index: number;
  state: StepState;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rule-top py-7 md:py-8">
      <div className="flex gap-4 sm:gap-6">
        {/* The number is the ornament. A tinted icon tile per step would be
            four more coloured squares saying nothing the number doesn't. */}
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] tabular-nums",
            state === "done"
              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
              : "border text-muted-foreground"
          )}
        >
          {state === "done" ? <Check className="h-3.5 w-3.5" /> : index}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            <StepStatus state={state} />
          </div>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </li>
  );
}

/** Body copy inside a step. One measure, one size, everywhere. */
function StepText({ children }: { children: React.ReactNode }) {
  return <p className="measure text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

/** A verbatim message from Google or a model provider, quoted as such. */
function Detail({ children }: { children: React.ReactNode }) {
  return (
    <p className="measure mt-3 border-l-2 border-border py-1 pl-3 font-mono text-[11px] leading-relaxed break-words text-muted-foreground">
      {children}
    </p>
  );
}

function Env({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px] text-foreground">
      {children}
    </code>
  );
}

function GmailStep({ index, data }: { index: number; data: AccountsResponse | undefined }) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/gmail/connect");
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? "The server would not start the Google sign-in.");
      }
      window.location.href = body.url;
    } catch (e) {
      setBusy(false);
      toast({
        title: "Couldn't open Google sign-in",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  if (!data) {
    return (
      <Step index={index} state="pending" title="Connect Gmail">
        <StepText>Checking whether an account is already connected…</StepText>
      </Step>
    );
  }

  const account = data.accounts[0];

  if (account) {
    return (
      <Step index={index} state="done" title="Connect Gmail">
        <StepText>
          Reading <span className="font-medium text-foreground">{account.email}</span>. Messages are
          fetched from Google when you open them and are not copied into the database.
        </StepText>
      </Step>
    );
  }

  // A missing OAuth client is the server's problem, and telling the person to
  // press a button that cannot work is worse than telling them nothing.
  if (!data.gmailConfigured) {
    return (
      <Step index={index} state="blocked" title="Connect Gmail">
        <StepText>
          This deployment has no Google OAuth client, so there is nothing to sign in to yet. Set{" "}
          <Env>GOOGLE_CLIENT_ID</Env> and <Env>GOOGLE_CLIENT_SECRET</Env> in the environment, add{" "}
          <Env>/api/gmail/callback</Env> as an authorised redirect URI in the Google Cloud console,
          and restart. The README walks through it.
        </StepText>
      </Step>
    );
  }

  return (
    <Step index={index} state="todo" title="Connect Gmail">
      <StepText>
        Google&apos;s own sign-in, with read and modify scopes and nothing wider. You can revoke it
        from your Google account at any time, or disconnect from Settings here.
      </StepText>
      <Button className="mt-4" onClick={connect} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Connect Gmail
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Step>
  );
}

function ModelStep({ index, health }: { index: number; health: ProbedHealth | undefined }) {
  if (!health) {
    return (
      <Step index={index} state="pending" title="Point it at a model">
        <StepText>Asking the provider whether it will take the key…</StepText>
      </Step>
    );
  }

  if (!health.ready) {
    return (
      <Step index={index} state="blocked" title="Point it at a model">
        <StepText>
          No model key is set, so sorting, drafting and questions are off — the inbox itself still
          works. Set <Env>AI_API_KEY</Env>, and <Env>AI_BASE_URL</Env> plus <Env>AI_MODEL</Env> if
          you want something other than the default. Anything speaking the OpenAI chat API will do,
          including one running on your own machine.
        </StepText>
      </Step>
    );
  }

  if (health.keyAccepted === false) {
    return (
      <Step index={index} state="blocked" title="Point it at a model">
        <StepText>
          A key is set, but <span className="font-medium text-foreground">{health.host}</span>{" "}
          refused it. Until that is fixed every AI feature will fail, while everything else keeps
          working.
        </StepText>
        {health.detail && <Detail>{health.detail}</Detail>}
      </Step>
    );
  }

  return (
    <Step index={index} state="done" title="Point it at a model">
      <StepText>
        <span className="font-medium text-foreground">{health.model}</span>, served by{" "}
        <span className="font-medium text-foreground">{health.host}</span>. Every message you sort
        or draft against goes to that endpoint and nowhere else.
      </StepText>
    </Step>
  );
}

function VoiceStep({ index }: { index: number }) {
  const tone = useStore((s) => s.tone);
  const replaceTone = useStore((s) => s.replaceTone);
  const qc = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = React.useState(tone.name);
  const [role, setRole] = React.useState(tone.role);
  const [signature, setSignature] = React.useState(tone.signature);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const dirty =
    name !== tone.name || role !== tone.role || signature !== tone.signature;
  const filled = Boolean(tone.name || tone.role || tone.signature);

  const save = async () => {
    const next: ToneProfile = { ...tone, name, role, signature };
    setSaving(true);
    replaceTone(next);
    try {
      const res = await fetch("/api/me/tone", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("The server would not store it");
      qc.invalidateQueries({ queryKey: ["tone"] });
      setSaved(true);
    } catch (e) {
      toast({
        title: "Saved in this browser only",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Step index={index} state={filled || saved ? "done" : "optional"} title="Say how you write">
      <StepText>
        Drafts come back in this register. Skip it and they arrive clear and short by default —
        the rest of the profile, including the phrases you never want to see, lives in Settings.
      </StepText>

      <div className="mt-4 grid max-w-lg gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="setup-name" className="text-xs font-normal text-muted-foreground">
            Name
          </Label>
          <Input
            id="setup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Rivera"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-role" className="text-xs font-normal text-muted-foreground">
            Role
          </Label>
          <Input
            id="setup-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Recruiter"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-sign" className="text-xs font-normal text-muted-foreground">
            Sign-off
          </Label>
          <Input
            id="setup-sign"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Alex"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={save} disabled={saving || !dirty}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
        {saved && !dirty && (
          <span className="text-xs text-muted-foreground">Saved to your account.</span>
        )}
      </div>
    </Step>
  );
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { data: session } = useSession();
  const accounts = useAccounts();
  const health = useProbedHealth();

  const connected = (accounts.data?.accounts.length ?? 0) > 0;
  const modelReady = Boolean(health.data?.ready && health.data.keyAccepted !== false);
  const tone = useStore((s) => s.tone);
  const voiceSet = Boolean(tone.name || tone.role || tone.signature);

  // Only the two that change what the app can do count towards the total.
  // Counting the optional step would leave a finished setup reading 3 of 4.
  const done = (connected ? 1 : 0) + (modelReady ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center gap-3 border-b px-4 sm:px-6">
        <Wordmark />
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-2 hidden truncate text-xs text-muted-foreground sm:inline">
            {session?.user?.email}
          </span>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Log out
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-10 sm:px-8 md:py-16 lg:grid-cols-[19rem_1fr] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">Setup</p>
          <h1 className="display mt-3 text-[2.1rem] sm:text-4xl lg:text-[2.25rem]">
            Two things it needs, <em>one</em> it would like.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Nothing here is stored anywhere but your own deployment. You can come back to all of it
            from Settings.
          </p>

          <div className="mt-7 flex items-center gap-3">
            <div
              className="h-[3px] w-24 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={done}
              aria-valuemin={0}
              aria-valuemax={2}
              aria-label="Setup progress"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(done / 2) * 100}%` }}
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {done} of 2
            </span>
          </div>

          <div className="mt-7 hidden lg:block">
            <Button
              onClick={onDone}
              variant={connected ? "default" : "outline"}
              className="w-full"
            >
              {connected ? "Open the inbox" : "Skip for now"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {!connected && (
              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                The inbox will be empty until Gmail is connected.
              </p>
            )}
          </div>
        </aside>

        <main>
          <ol className="[&>li:first-child]:border-t-0 [&>li:first-child]:pt-0">
            <Step index={1} state="done" title="Create an account">
              <StepText>
                {session?.user?.email ? (
                  <>
                    Signed in as{" "}
                    <span className="font-medium text-foreground">{session.user.email}</span>.{" "}
                  </>
                ) : null}
                This account exists only in the database this deployment points at, and nowhere
                else.
              </StepText>
            </Step>

            <GmailStep index={2} data={accounts.data} />
            <ModelStep index={3} health={health.data} />
            <VoiceStep index={4} />
          </ol>

          <div className="rule-top pt-7 lg:hidden">
            <Button onClick={onDone} variant={connected ? "default" : "outline"} className="w-full">
              {connected ? "Open the inbox" : "Skip for now"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-muted-foreground lg:mt-10">
            {voiceSet
              ? "That's everything. Drafts will come back in your voice from the first message."
              : "Sorting starts as soon as mail loads. Nothing is sent on your behalf without you pressing send twice."}
          </p>
        </main>
      </div>
    </div>
  );
}
