"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Save,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Trash2,
  KeyRound,
  Plug,
  Plug2,
  Loader2,
  Check,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
  Palette,
} from "lucide-react";
import { useTheme } from "next-themes";
import { setAccent } from "@/components/theme-provider";
import { useStore } from "@/lib/store";
import { CATEGORIES, DEFAULT_TONE } from "@/lib/sample-data";
import type { ToneProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CategoryBadge } from "./category-badge";

function phrasesToText(arr: string[]) {
  return arr.join("\n");
}
function textToPhrases(text: string) {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

function ToneForm() {
  const tone = useStore((s) => s.tone);
  const setTone = useStore((s) => s.setTone);
  const replaceTone = useStore((s) => s.replaceTone);
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
      toast({ title: "Tone profile saved", description: "New drafts will be written in this voice. Synced to your account." });
    } catch (e) {
      toast({ title: "Saved locally only", description: String(e), variant: "destructive" });
    }
  };

  const reset = () => {
    resetTone();
    setDraft(DEFAULT_TONE);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" /> Tone profile
        </CardTitle>
        <CardDescription>
          InboxPilot learns your voice. These settings shape every draft — refine any draft by hand before sending.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Alex Rivera" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role / title</Label>
            <Input id="role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="e.g. Senior Recruiter" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tone">Describe your tone</Label>
          <Input id="tone" value={draft.tone} onChange={(e) => setDraft({ ...draft, tone: e.target.value })} placeholder="e.g. warm, direct, concise" />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Length</Label>
            <Select value={draft.length} onValueChange={(v) => setDraft({ ...draft, length: v as ToneProfile["length"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="long">Long</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Formality</Label>
            <Select value={draft.formality} onValueChange={(v) => setDraft({ ...draft, formality: v as ToneProfile["formality"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sig">Sign-off</Label>
            <Input id="sig" value={draft.signature} onChange={(e) => setDraft({ ...draft, signature: e.target.value })} placeholder="Your name" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phrases">Phrases you often use (one per line)</Label>
            <Textarea id="phrases" value={phrasesToText(draft.samplePhrases)} onChange={(e) => setDraft({ ...draft, samplePhrases: textToPhrases(e.target.value) })} className="min-h-[100px]" placeholder={"Happy to jump on a quick call\nLet me know what works"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avoid">Phrases to avoid (one per line)</Label>
            <Textarea id="avoid" value={phrasesToText(draft.avoid)} onChange={(e) => setDraft({ ...draft, avoid: textToPhrases(e.target.value) })} className="min-h-[100px]" placeholder={"Hope this email finds you well"} />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button className="brand-gradient text-white" onClick={save} disabled={!dirty}>
            <Save className="h-4 w-4 mr-2" /> Save profile
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountsCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as { accounts: { id: string; provider: string; email: string; createdAt: string }[]; gmailConfigured: boolean };
    },
  });

  const connect = async () => {
    try {
      const res = await fetch("/api/gmail/connect");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Gmail not configured", description: d.error ?? "Set GOOGLE_CLIENT_ID/SECRET (see README).", variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      toast({ title: "Couldn't start Gmail connect", description: String(e), variant: "destructive" });
    }
  };

  const disconnect = async (id: string) => {
    await fetch("/api/accounts", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["emails"] });
    toast({ title: "Gmail disconnected" });
  };

  const accounts = data?.accounts ?? [];
  const gmailConfigured = data?.gmailConfigured ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="h-4 w-4 text-primary" /> Email accounts
        </CardTitle>
        <CardDescription>
          Connect your Gmail to let InboxPilot read and draft your email. Outlook and IMAP are on the roadmap.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <Plug2 className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">No email accounts connected yet.</p>
            <Button className="brand-gradient text-white" onClick={connect}>
              <Plug className="h-4 w-4 mr-2" /> Connect Gmail
            </Button>
            {!gmailConfigured && (
              <p className="text-[11px] text-amber-600 mt-2 inline-flex items-center gap-1 justify-center">
                <AlertCircle className="h-3 w-3" /> Gmail OAuth not configured on the server. See README.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <div className="h-8 w-8 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{a.email}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">{a.provider} · connected {new Date(a.createdAt).toLocaleDateString()}</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-rose-600 hover:text-rose-700" onClick={() => disconnect(a.id)}>
                  Disconnect
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={connect}>
              <Plug className="h-3.5 w-3.5 mr-1.5" /> Connect another
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoriesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Inbox categories
        </CardTitle>
        <CardDescription>
          Every email is auto-sorted into one of these buckets. Override any email&apos;s category from the inbox — the AI respects your choice.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-2">
        {CATEGORIES.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <CategoryBadge id={c.id} />
            <span className="text-xs text-muted-foreground">{c.description}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PrivacyCard() {
  const clearLocalData = useStore((s) => s.clearLocalData);
  const { toast } = useToast();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-emerald-500" /> Privacy & data
        </CardTitle>
        <CardDescription>
          Your email is fetched directly from Gmail via your own deployment. InboxPilot stores only your account, tone profile, and Gmail OAuth tokens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
          <div className="flex items-center gap-2 font-medium">
            <KeyRound className="h-4 w-4 text-primary" /> AI provider
          </div>
          <p className="text-xs text-muted-foreground">
            AI runs through a shared Grok key (if configured) or the built-in fallback. All AI endpoints require you to be logged in.
          </p>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Clear local data</div>
            <p className="text-xs text-muted-foreground">Removes drafts, overrides, and chat history from this browser.</p>
          </div>
          <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => { clearLocalData(); toast({ title: "Local data cleared" }); }}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Clear
          </Button>
        </div>
      </CardContent>
    </Card>
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

function AppearanceCard() {
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

  const themes = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4 text-primary" /> Appearance
        </CardTitle>
        <CardDescription>
          Choose your theme and accent color. Changes apply instantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors",
                  mounted && theme === t.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <t.icon className="h-4 w-4" />
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Accent color</Label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => changeAccent(a.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-colors",
                  mounted && accent === a.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <span
                  className="h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-background"
                  style={{ backgroundColor: a.color, boxShadow: mounted && accent === a.id ? `0 0 0 2px ${a.color}` : "none" }}
                />
                <span className="text-[11px] font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-4">
        <AppearanceCard />
        <AccountsCard />
        <ToneForm />
        <CategoriesCard />
        <PrivacyCard />
      </div>
    </div>
  );
}
