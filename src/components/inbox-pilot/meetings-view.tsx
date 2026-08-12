"use client";

import * as React from "react";
import {
  Video,
  Clock,
  Users,
  Sparkles,
  Loader2,
  RefreshCw,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { SAMPLE_MEETINGS } from "@/lib/sample-data";
import type { Meeting } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TimeAgo } from "./time-ago";

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const [open, setOpen] = React.useState(false);
  const [summary, setSummary] = React.useState(meeting.summary);
  const [actions, setActions] = React.useState(meeting.actionItems);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const regenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: meeting.title,
          transcript: meeting.transcript,
        }),
      });
      if (!res.ok) throw new Error("summarize failed");
      const data = await res.json();
      setSummary(data.summary);
      setActions(data.actionItems);
      toast({ title: "Summary regenerated" });
    } catch (e) {
      toast({
        title: "Couldn't summarize",
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <Video className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm leading-tight">
                {meeting.title}
              </h3>
              {meeting.status === "upcoming" ? (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  upcoming
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  completed
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> <TimeAgo iso={meeting.date} />
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {meeting.durationMin} min
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> {meeting.attendees.length}
              </span>
              <span className="inline-flex items-center gap-1">
                <Video className="h-3 w-3" /> {meeting.platform}
              </span>
            </div>
          </div>
        </div>
      </button>

      {open && (
        <CardContent className="border-t pt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> AI Summary
              </h4>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={regenerate}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                Regenerate
              </Button>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{summary}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Action items</h4>
            <ul className="space-y-1.5">
              {actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Transcript</h4>
            <div className="rounded-lg border bg-muted/30 p-3 max-h-64 overflow-y-auto scroll-thin space-y-2">
              {meeting.transcript.map((t, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-primary">{t.speaker}</span>
                  <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                    {t.ts}
                  </span>
                  <p className="text-foreground/90">{t.text}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function MeetingsView() {
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Drop in any meeting transcript — no bot joins your call. InboxPilot
            writes the summary and action items.
          </div>
          {SAMPLE_MEETINGS.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
          <div className="text-center text-xs text-muted-foreground py-4">
            Bot-free meeting intelligence — a feature Fyxer can't offer.
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
