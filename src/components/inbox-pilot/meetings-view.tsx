"use client";

import * as React from "react";
import { Sparkles, Loader2, ClipboardPaste, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface SummaryResult {
  title: string;
  summary: string;
  actionItems: string[];
  at: string;
}

export function MeetingsView() {
  const [title, setTitle] = React.useState("");
  const [transcript, setTranscript] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SummaryResult[]>([]);
  const { toast } = useToast();

  const summarize = async () => {
    if (!transcript.trim()) {
      toast({ title: "Paste a transcript first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Parse loose transcript lines into speaker/text pairs if possible.
      const lines = transcript.split("\n").filter((l) => l.trim());
      const parsed = lines.map((line) => {
        const m = line.match(/^\s*([^:]+):\s*(.*)$/);
        if (m) return { speaker: m[1].trim(), text: m[2].trim() };
        return { speaker: "Speaker", text: line.trim() };
      });
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title || "Untitled meeting", transcript: parsed }),
      });
      if (res.status === 401) {
        toast({ title: "Please log in again", variant: "destructive" });
        return;
      }
      if (!res.ok) throw new Error("summarize failed");
      const data = await res.json();
      setResults((r) => [
        {
          title: title || "Untitled meeting",
          summary: data.summary,
          actionItems: data.actionItems,
          at: new Date().toISOString(),
        },
        ...r,
      ]);
      setTranscript("");
      setTitle("");
      toast({ title: "Summary ready" });
    } catch (e) {
      toast({ title: "Couldn't summarize", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setTranscript((t) => (t ? t + "\n" + text : text));
    } catch {
      toast({ title: "Couldn't read clipboard", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-6 md:py-12">
        <p className="eyebrow">Meeting notes</p>
        <h1 className="display mt-3 text-3xl sm:text-4xl">
          Paste what was said. Get back what to do.
        </h1>
        <p className="measure mt-3 text-sm leading-relaxed text-muted-foreground">
          Nothing joins your call and nothing is recorded — the transcript goes to the model you
          configured, and the result stays in this browser until you reload.
        </p>

        <div className="mt-8 space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="mtg-title" className="text-xs font-normal text-muted-foreground">
              Title <span className="text-muted-foreground/70">— optional</span>
            </Label>
            <Input
              id="mtg-title"
              placeholder="Q3 planning sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="mtg-transcript"
                className="text-xs font-normal text-muted-foreground"
              >
                Transcript
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-muted-foreground"
                onClick={pasteFromClipboard}
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> Paste
              </Button>
            </div>
            <Textarea
              id="mtg-transcript"
              placeholder={
                "Alex: So, thoughts on the roadmap?\nSam: I think we should prioritise the migration."
              }
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="min-h-[180px] font-mono text-xs leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground">
              One line per turn, <span className="font-mono">Speaker: what they said</span>. Loose
              text works too.
            </p>
          </div>

          <Button disabled={loading || !transcript.trim()} onClick={summarize}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "Reading it…" : "Summarise"}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="mt-12">
            <p className="eyebrow">This session</p>
            <div className="mt-4">
              {results.map((r, i) => (
                <article key={r.at} className="rule-top py-6 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-[15px] font-semibold tracking-tight">{r.title}</h2>
                    <div className="flex shrink-0 items-center gap-2">
                      <time className="text-[11px] text-muted-foreground">
                        {new Date(r.at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                      <button
                        onClick={() => setResults((rs) => rs.filter((_, idx) => idx !== i))}
                        aria-label={`Discard ${r.title}`}
                        className="text-muted-foreground transition-colors hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {r.summary}
                  </p>

                  {r.actionItems.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {r.actionItems.map((a, j) => (
                        <li key={j} className="flex gap-3 text-sm leading-relaxed">
                          <span className="mt-px shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                            {String(j + 1).padStart(2, "0")}
                          </span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
