"use client";

import * as React from "react";
import {
  Video,
  Sparkles,
  Loader2,
  CheckCircle2,
  ClipboardPaste,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    <div className="h-full overflow-y-auto scroll-thin">
        <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Paste any meeting transcript — no bot joins your call. InboxPilot writes the summary and action items.
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mtg-title">Meeting title (optional)</Label>
                <Input id="mtg-title" placeholder="e.g. Q3 planning sync" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mtg-transcript">Transcript</Label>
                  <Button variant="ghost" size="sm" className="h-7" onClick={pasteFromClipboard}>
                    <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" /> Paste
                  </Button>
                </div>
                <Textarea
                  id="mtg-transcript"
                  placeholder={"Paste your transcript here. Format like:\nAlex: So, thoughts on the roadmap?\nSam: I think we should prioritize..."}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="min-h-[160px] font-mono text-xs"
                />
              </div>
              <Button className="w-full brand-gradient text-white" disabled={loading || !transcript.trim()} onClick={summarize}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {loading ? "Summarizing…" : "Summarize meeting"}
              </Button>
            </CardContent>
          </Card>

          {results.length > 0 && (
            <div className="space-y-4">
              <Separator />
              <h3 className="text-sm font-medium text-muted-foreground">Recent summaries</h3>
              {results.map((r, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                        <Video className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm">{r.title}</h4>
                        <p className="text-xs text-muted-foreground">{new Date(r.at).toLocaleString()}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setResults((rs) => rs.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{r.summary}</p>
                    {r.actionItems.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium mb-1.5">Action items</h5>
                        <ul className="space-y-1.5">
                          {r.actionItems.map((a, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
