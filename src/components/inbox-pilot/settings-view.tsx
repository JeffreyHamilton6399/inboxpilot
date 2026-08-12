"use client";

import * as React from "react";
import {
  User,
  Save,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Trash2,
  KeyRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/sample-data";
import type { ToneProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ToneForm() {
  const tone = useStore((s) => s.tone);
  const setTone = useStore((s) => s.setTone);
  const resetTone = useStore((s) => s.resetTone);
  const { toast } = useToast();

  const [draft, setDraft] = React.useState<ToneProfile>(tone);
  React.useEffect(() => setDraft(tone), [tone]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(tone);

  const save = () => {
    setTone(draft);
    toast({
      title: "Tone profile saved",
      description: "New drafts will be written in this voice.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" /> Tone profile
        </CardTitle>
        <CardDescription>
          InboxPilot learns your voice. These settings shape every draft — and
          you can refine any draft by hand before sending.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role / title</Label>
            <Input
              id="role"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tone">Describe your tone</Label>
          <Input
            id="tone"
            value={draft.tone}
            onChange={(e) => setDraft({ ...draft, tone: e.target.value })}
            placeholder="e.g. warm, direct, concise"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Length</Label>
            <Select
              value={draft.length}
              onValueChange={(v) =>
                setDraft({ ...draft, length: v as ToneProfile["length"] })
              }
            >
              <SelectTrigger>
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
            <Label>Formality</Label>
            <Select
              value={draft.formality}
              onValueChange={(v) =>
                setDraft({ ...draft, formality: v as ToneProfile["formality"] })
              }
            >
              <SelectTrigger>
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
            <Label htmlFor="sig">Sign-off</Label>
            <Input
              id="sig"
              value={draft.signature}
              onChange={(e) =>
                setDraft({ ...draft, signature: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phrases">Phrases you often use (one per line)</Label>
            <Textarea
              id="phrases"
              value={phrasesToText(draft.samplePhrases)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  samplePhrases: textToPhrases(e.target.value),
                })
              }
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="avoid">Phrases to avoid (one per line)</Label>
            <Textarea
              id="avoid"
              value={phrasesToText(draft.avoid)}
              onChange={(e) =>
                setDraft({ ...draft, avoid: textToPhrases(e.target.value) })
              }
              className="min-h-[100px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            className="brand-gradient text-white"
            onClick={save}
            disabled={!dirty}
          >
            <Save className="h-4 w-4 mr-2" /> Save profile
          </Button>
          <Button variant="outline" onClick={resetTone}>
            <RotateCcw className="h-4 w-4 mr-2" /> Reset to defaults
          </Button>
        </div>
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
          Every email is auto-sorted into one of these buckets. You can override
          any email's category from the inbox — the AI learns your preferences.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-2">
        {CATEGORIES.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 rounded-lg border px-3 py-2"
          >
            <CategoryBadge id={c.id} />
            <span className="text-xs text-muted-foreground">{c.description}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PrivacyCard() {
  const reset = useStore((s) => s.reset);
  const { toast } = useToast();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-emerald-500" /> Privacy & data
        </CardTitle>
        <CardDescription>
          Your inbox context is processed through your own AI key on your own
          deployment. Nothing is stored on our servers — there are no our servers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
          <div className="flex items-center gap-2 font-medium">
            <KeyRound className="h-4 w-4 text-primary" /> AI provider
          </div>
          <p className="text-xs text-muted-foreground">
            Set <code className="font-mono">GROK_API_KEY</code> in your environment
            to use Grok. If unset, InboxPilot falls back to the built-in model —
            no key required.
          </p>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Clear local data</div>
            <p className="text-xs text-muted-foreground">
              Removes drafts, chat history & overrides from this browser.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-rose-600 hover:text-rose-700"
            onClick={() => {
              reset();
              toast({ title: "Local data cleared" });
            }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-4">
        <ToneForm />
        <CategoriesCard />
        <PrivacyCard />
      </div>
    </div>
  );
}
