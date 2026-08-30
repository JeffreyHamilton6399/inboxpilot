"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  RotateCcw,
  Trash2,
  Plug,
  Loader2,
  Check,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";
import { setAccent } from "@/components/theme-provider";
import { useStore } from "@/lib/store";
import { CATEGORIES, DEFAULT_TONE } from "@/lib/defaults";
import type { HealthResponse, ToneProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CategoryBadge } from "./category-badge";

/**
 * Settings as one ruled page rather than five stacked cards.
 *
 * Every section used to be a bordered card whose title wore its own tinted
 * icon, which meant five boxes, five icons and five colours competing to be
 * looked at first on a page where the only thing that varies is the controls.
 * A label column and a hairline do the same separating for none of the noise.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rule-top py-8 first:border-t-0 first:pt-0 md:grid md:grid-cols-[12.5rem_1fr] md:gap-10">
      <div className="md:pt-0.5">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4 min-w-0 md:mt-0">{children}</div>
    </section>
  );
}

/** The one-line form label used throughout this page. */
function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-xs font-normal text-muted-foreground">
      {children}
    </Label>
  );
}

function phrasesToText(arr: string[]) {
  return arr.join("\n");
}
function textToPhrases(text: string) {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

function ToneForm() {
  const tone = useStore((s) => s.tone);
  const setTone = useStore((s) => s.setTone);
  const resetTone = useStore((s) => s.resetTone);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [draft, setDraft] = React.useState<ToneProfile>(tone);
  React.useEffect(() => setDraft(tone), [tone]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(tone);

  const save = async () => {
    setTone(draft);
    try {
      const res = await fetch("/api/me/tone", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("save failed");
      qc.invalidateQueries({ queryKey: ["tone"] });
      toast({
        title: "Tone profile saved",
        description: "New drafts will be written in this voice. Synced to your account.",
      });
    } catch (e) {
      toast({ title: "Saved locally only", description: String(e), variant: "destructive" });
    }
  };

  const reset = () => {
    resetTone();
    setDraft(DEFAULT_TONE);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="name">Your name</FieldLabel>
          <Input
            id="name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Alex Rivera"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="role">Role or title</FieldLabel>
          <Input
            id="role"
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            placeholder="Senior Recruiter"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="tone">How you sound</FieldLabel>
        <Input
          id="tone"
          value={draft.tone}
          onChange={(e) => setDraft({ ...draft, tone: e.target.value })}
          placeholder="warm, direct, concise"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <FieldLabel>Length</FieldLabel>
          <Select
            value={draft.length}
            onValueChange={(v) => setDraft({ ...draft, length: v as ToneProfile["length"] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="long">Long</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Formality</FieldLabel>
          <Select
            value={draft.formality}
            onValueChange={(v) => setDraft({ ...draft, formality: v as ToneProfile["formality"] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="sig">Sign-off</FieldLabel>
          <Input
            id="sig"
            value={draft.signature}
            onChange={(e) => setDraft({ ...draft, signature: e.target.value })}
            placeholder="Alex"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="phrases">Phrases you use — one per line</FieldLabel>
          <Textarea
            id="phrases"
            value={phrasesToText(draft.samplePhrases)}
            onChange={(e) => setDraft({ ...draft, samplePhrases: textToPhrases(e.target.value) })}
            className="min-h-[104px]"
            placeholder={"Happy to jump on a quick call\nLet me know what works"}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="avoid">Phrases to avoid — one per line</FieldLabel>
          <Textarea
            id="avoid"
            value={phrasesToText(draft.avoid)}
            onChange={(e) => setDraft({ ...draft, avoid: textToPhrases(e.target.value) })}
            className="min-h-[104px]"
            placeholder={"Hope this email finds you well"}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={save} disabled={!dirty}>
          <Save className="h-4 w-4" /> Save profile
        </Button>
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      </div>
    </div>
  );
}

function Accounts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as {
        accounts: { id: string; provider: string; email: string; createdAt: string }[];
        gmailConfigured: boolean;
      };
    },
  });

  const connect = async () => {
    try {
      const res = await fetch("/api/gmail/connect");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({
          title: "Gmail not configured",
          description: d.error ?? "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET — see the README.",
          variant: "destructive",
        });
        return;
      }
      const body = await res.json();
      if (body.url) window.location.href = body.url;
    } catch (e) {
      toast({
        title: "Couldn't start Gmail connect",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const disconnect = async (id: string) => {
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["emails"] });
    toast({ title: "Gmail disconnected" });
  };

  const accounts = data?.accounts ?? [];
  const gmailConfigured = data?.gmailConfigured ?? false;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Nothing connected yet.</p>
        <Button className="mt-3" onClick={connect} disabled={!gmailConfigured}>
          <Plug className="h-4 w-4" /> Connect Gmail
        </Button>
        {!gmailConfigured && (
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            This deployment has no Google OAuth client, so there is nothing to sign in to. Set{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px] text-foreground">
              GOOGLE_CLIENT_ID
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px] text-foreground">
              GOOGLE_CLIENT_SECRET
            </code>
            , then restart.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {accounts.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{a.email}</div>
            <div className="text-[11px] capitalize text-muted-foreground">
              {a.provider} · connected {new Date(a.createdAt).toLocaleDateString()}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground hover:text-rose-600"
            onClick={() => disconnect(a.id)}
          >
            Disconnect
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={connect}>
        <Plug className="h-3.5 w-3.5" /> Connect another
      </Button>
    </div>
  );
}

/**
 * What the server is actually configured to talk to. Stated rather than
 * described: this page used to claim AI ran "through a shared Grok key (if
 * configured) or the built-in fallback", and there is no shared key and no
 * fallback — there is one endpoint, and it is whichever one this deployment
 * was given.
 */
function ModelSummary() {
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

  if (!data) {
    return <p className="text-sm text-muted-foreground">Checking…</p>;
  }

  if (!data.ready) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        No key is set, so sorting, drafting and questions are off. The inbox itself still works. Set{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px] text-foreground">
          AI_API_KEY
        </code>{" "}
        on the server to turn them on.
      </p>
    );
  }

  return (
    <dl className="text-sm">
      <div className="flex gap-4 py-1.5">
        <dt className="w-20 shrink-0 text-muted-foreground">Endpoint</dt>
        <dd className="font-mono text-[12.5px]">{data.host}</dd>
      </div>
      <div className="flex gap-4 py-1.5">
        <dt className="w-20 shrink-0 text-muted-foreground">Model</dt>
        <dd className="font-mono text-[12.5px]">{data.model}</dd>
      </div>
      {data.reasoningEffort && (
        <div className="flex gap-4 py-1.5">
          <dt className="w-20 shrink-0 text-muted-foreground">Effort</dt>
          <dd className="font-mono text-[12.5px]">{data.reasoningEffort}</dd>
        </div>
      )}
    </dl>
  );
}

function Categories() {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {CATEGORIES.map((c) => (
        <div key={c.id} className="flex items-center gap-2.5 py-1">
          <CategoryBadge id={c.id} />
          <span className="truncate text-xs text-muted-foreground">{c.description}</span>
        </div>
      ))}
    </div>
  );
}

function LocalData() {
  const clearLocalData = useStore((s) => s.clearLocalData);
  const { toast } = useToast();
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Drafts you have not sent, category overrides and chat history live in this browser only.
        Clearing them does not touch Gmail.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 text-muted-foreground hover:text-rose-600"
        onClick={() => {
          clearLocalData();
          toast({ title: "Local data cleared" });
        }}
      >
        <Trash2 className="h-3.5 w-3.5" /> Clear
      </Button>
    </div>
  );
}

const ACCENTS = [
  { id: "emerald", label: "Emerald", color: "oklch(0.62 0.15 162)" },
  { id: "blue", label: "Blue", color: "oklch(0.55 0.18 255)" },
  { id: "violet", label: "Violet", color: "oklch(0.55 0.2 300)" },
  { id: "rose", label: "Rose", color: "oklch(0.6 0.2 15)" },
  { id: "orange", label: "Orange", color: "oklch(0.65 0.18 45)" },
  { id: "slate", label: "Slate", color: "oklch(0.45 0.02 260)" },
] as const;

const THEMES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const;

function Appearance() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [accent, setLocalAccent] = React.useState("emerald");

  React.useEffect(() => {
    setMounted(true);
    setLocalAccent(localStorage.getItem("inboxpilot-accent") || "emerald");
  }, []);

  const changeAccent = (id: string) => {
    setLocalAccent(id);
    setAccent(id);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <FieldLabel>Theme</FieldLabel>
        <div className="inline-flex rounded-lg border p-0.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[0.3rem] px-3 py-1.5 text-xs font-medium transition-colors",
                mounted && theme === t.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel>Accent</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => changeAccent(a.id)}
              aria-label={a.label}
              aria-pressed={mounted && accent === a.id}
              title={a.label}
              className={cn(
                "h-7 w-7 rounded-full transition-transform hover:scale-105",
                mounted &&
                  accent === a.id &&
                  "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background"
              )}
              style={{ backgroundColor: a.color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsView() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 md:py-12">
        <p className="eyebrow">Settings</p>
        <h1 className="display mt-3 text-4xl">How it behaves, and who it talks to.</h1>

        <div className="mt-10 md:mt-12">
          <Section
            title="Email accounts"
            description="Google's own sign-in. Revocable from your Google account at any time."
          >
            <Accounts />
          </Section>

          <Section
            title="Model"
            description="Set on the server, not here — so it is the same for every session on this deployment."
          >
            <ModelSummary />
          </Section>

          <Section
            title="Your voice"
            description="Shapes every draft. Nothing is sent without you reading it first."
          >
            <ToneForm />
          </Section>

          <Section
            title="Categories"
            description="Every message lands in one of these. Override any of them from the inbox."
          >
            <Categories />
          </Section>

          <Section title="Appearance" description="Applies immediately, and only in this browser.">
            <Appearance />
          </Section>

          <Section
            title="Local data"
            description="What this browser is holding on to."
          >
            <LocalData />
          </Section>
        </div>
      </div>
    </div>
  );
}
