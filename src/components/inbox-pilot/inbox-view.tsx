"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Star,
  Search,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  MailOpen,
  Mail,
  Tag,
  Loader2,
  Send,
  Wand2,
  Paperclip,
  X,
  Inbox as InboxIcon,
  Plug,
  AlertCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useEmails, fetchEmailBody, NotConnectedError } from "@/lib/use-emails";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/sample-data";
import type { CategoryId, Email, ToneProfile } from "@/lib/types";
import { CategoryBadge } from "./category-badge";
import { TimeAgo } from "./time-ago";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** Truncates a "to" field with many recipients to "First, Second +N more". */
function truncateRecipients(to: string, max = 2): string {
  // Split by commas, trim each
  const parts = to.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= max) return to;
  const shown = parts.slice(0, max).join(", ");
  return `${shown} +${parts.length - max} more`;
}

function connectGmail() {
  fetch("/api/gmail/connect")
    .then((r) => (r.ok ? r.json() : Promise.reject(r)))
    .then((data) => {
      if (data.url) window.location.href = data.url;
    })
    .catch(() => {
      // fall through to settings where setup is documented
      window.location.hash = "settings";
    });
}

function NotConnectedState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Plug className="h-7 w-7 text-primary" />
      </div>
      <h3 className="font-semibold text-lg">Connect your Gmail</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        InboxPilot reads your real Gmail inbox so the AI can organize it, draft
        replies, and answer questions about your email. Nothing is sent without
        your say-so.
      </p>
      <Button className="mt-5 brand-gradient text-white" onClick={connectGmail}>
        <Plug className="h-4 w-4 mr-2" /> Connect Gmail
      </Button>
      <p className="text-[11px] text-muted-foreground mt-3 max-w-xs">
        Uses the official Google sign-in. You can disconnect any time from
        Settings.
      </p>
    </div>
  );
}

function EmptyInboxState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <InboxIcon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg">Inbox zero</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Your Gmail is connected but there&apos;s nothing new right now.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <Loader2 className="h-7 w-7 text-primary animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">Loading your inbox…</p>
    </div>
  );
}

function CategoryFilter({
  active,
  counts,
  onChange,
}: {
  active: CategoryId | "all";
  counts: Record<string, number>;
  onChange: (c: CategoryId | "all") => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scroll-thin pb-1">
      <FilterChip label="All" active={active === "all"} count={Object.values(counts).reduce((a, b) => a + b, 0)} onClick={() => onChange("all")} />
      {CATEGORIES.map((c) => (
        <FilterChip key={c.id} label={c.label} dot={c.dot} active={active === c.id} count={counts[c.id] ?? 0} onClick={() => onChange(c.id)} />
      ))}
    </div>
  );
}

function FilterChip({
  label,
  active,
  count,
  dot,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
        count === 0 && !active && "opacity-40"
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {label}
      <span className={cn("tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{count}</span>
    </button>
  );
}

function EmailRow({
  email,
  active,
  hasDraft,
  onClick,
}: {
  email: Email;
  active: boolean;
  hasDraft: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex gap-3 px-3 py-3 border-b transition-colors",
        active ? "bg-primary/5" : "hover:bg-muted/50"
      )}
    >
      <div className="relative shrink-0">
        <span className={cn("h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white", email.from.avatarColor)}>
          {initials(email.from.name)}
        </span>
        {email.unread && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm truncate", email.unread ? "font-semibold" : "font-medium text-muted-foreground")}>{email.from.name}</span>
          {email.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
          <span className="ml-auto text-[11px] text-muted-foreground shrink-0"><TimeAgo iso={email.receivedAt} /></span>
        </div>
        <div className="text-sm truncate mt-0.5">{email.subject}</div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">{email.preview}</div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <CategoryBadge id={email.category} />
          {email.hasAttachment && <Paperclip className="h-3 w-3 text-muted-foreground" />}
          {hasDraft && <Badge className="bg-teal-500/15 text-teal-700 dark:text-teal-300 text-[10px] py-0 h-4">draft</Badge>}
        </div>
      </div>
    </button>
  );
}

function DraftPanel({ email, bodyLoading }: { email: Email; bodyLoading: boolean }) {
  const tone = useStore((s) => s.tone);
  const setDraft = useStore((s) => s.setDraft);
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [instruction, setInstruction] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const existingDraft = useStore((s) => s.drafts[email.id]);

  const generate = async (regenerate = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: { from: email.from.name, subject: email.subject, body: email.body, preview: email.preview },
          tone: tone as ToneProfile,
          instruction: instruction || undefined,
        }),
      });
      if (res.status === 401) {
        toast({ title: "Please log in again", variant: "destructive" });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "draft failed");
      }
      const data = await res.json();
      setDraft(email.id, data.draft);
      toast({ title: regenerate ? "Draft regenerated" : "Draft ready", description: "Review and send when you're happy with it." });
    } catch (e) {
      toast({ title: "Couldn't generate draft", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!existingDraft) return;
    await navigator.clipboard.writeText(existingDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">AI draft reply</span>
        {!tone.name ? (
          <span className="text-[11px] text-amber-600 inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Set your name in Settings for better drafts
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">in the voice of {tone.name}</span>
        )}
        {existingDraft && (
          <Button size="sm" variant="ghost" className="ml-auto h-7" disabled={loading} onClick={() => generate(true)}>
            {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Regenerate
          </Button>
        )}
      </div>

      {!existingDraft ? (
        <div className="space-y-2">
          {bodyLoading ? (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading email body…
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Generate one in your tone, or add an instruction first (e.g. &quot;say I&apos;m available Thursday at 2pm&quot;).
            </p>
          )}
          <Input placeholder="Optional: add an instruction…" value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !bodyLoading) generate(false); }} disabled={bodyLoading} />
          <Button className="w-full brand-gradient text-white" disabled={loading || bodyLoading} onClick={() => generate(false)}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {loading ? "Writing…" : bodyLoading ? "Loading email…" : "Generate draft"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea value={existingDraft} onChange={(e) => setDraft(email.id, e.target.value)} className="min-h-[140px] bg-background resize-y" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" className="brand-gradient text-white" onClick={() => toast({ title: "Ready to send", description: "Gmail send is wired up — paste into your compose window for now." })}>
              <Send className="h-3.5 w-3.5 mr-1.5" /> Send
            </Button>
            <Input placeholder="Refine: 'make it shorter'…" value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") generate(true); }} className="h-8 flex-1 min-w-[140px]" />
          </div>
        </div>
      )}
    </div>
  );
}

function EmailDetail({ email, onClose }: { email: Email; onClose: () => void }) {
  const markRead = useStore((s) => s.markRead);
  const toggleRead = useStore((s) => s.toggleRead);
  const toggleStar = useStore((s) => s.toggleStar);
  const setCategory = useStore((s) => s.setCategory);
  const { toast } = useToast();
  const [recategorizing, setRecategorizing] = React.useState(false);
  const [body, setBody] = React.useState(email.body);
  const [loadingBody, setLoadingBody] = React.useState(!email.body);

  React.useEffect(() => {
    if (email.unread) markRead(email.id);
  }, [email.id, email.unread, markRead]);

  React.useEffect(() => {
    let alive = true;
    if (!email.body) {
      setLoadingBody(true);
      fetchEmailBody(email.id)
        .then((b) => { if (alive) { setBody(b); setLoadingBody(false); } })
        .catch(() => { if (alive) setLoadingBody(false); });
    } else {
      setBody(email.body);
      setLoadingBody(false);
    }
    return () => { alive = false; };
  }, [email.id, email.body]);

  const recategorize = async () => {
    setRecategorizing(true);
    try {
      const res = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: email.from.name, subject: email.subject, preview: email.preview, body }),
      });
      if (!res.ok) throw new Error("categorize failed");
      const data = await res.json();
      setCategory(email.id, data.category as CategoryId);
      toast({ title: "Re-categorized by AI", description: `${CATEGORY_MAP[data.category as CategoryId].label} — ${data.reason}` });
    } catch (e) {
      toast({ title: "Couldn't re-categorize", description: String(e), variant: "destructive" });
    } finally {
      setRecategorizing(false);
    }
  };

  const emailWithBody = { ...email, body };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStar(email.id, email.starred)}>
                  <Star className={cn("h-4 w-4", email.starred && "fill-amber-400 text-amber-400")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Star</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleRead(email.id, email.unread)}>
            {email.unread ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8" disabled={recategorizing}>
                {recategorizing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Tag className="h-3.5 w-3.5 mr-1.5" />}
                Category
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Set category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CATEGORIES.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => setCategory(email.id, c.id)} className="gap-2">
                  <span className={cn("h-2 w-2 rounded-full", c.dot)} />
                  {c.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={recategorize} className="gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Re-run AI categorization
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin min-h-0">
        <div className="p-4 md:p-6 space-y-4 max-w-3xl">
          <div>
            <h2 className="text-xl font-semibold leading-tight">{email.subject}</h2>
            <div className="mt-2 flex items-start gap-3">
              <span className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0", email.from.avatarColor)}>
                {initials(email.from.name)}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{email.from.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {email.from.email}
                  {email.to ? ` · to ${truncateRecipients(email.to)}` : ""}
                </div>
              </div>
              <span className="ml-auto text-xs text-muted-foreground shrink-0"><TimeAgo iso={email.receivedAt} /></span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge id={email.category} />
          </div>

          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 border-t pt-4">
            {loadingBody ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading message…
              </span>
            ) : body || email.preview ? (
              body || email.preview
            ) : (
              <span className="text-muted-foreground italic">(empty message)</span>
            )}
          </div>

          <DraftPanel email={emailWithBody} bodyLoading={loadingBody} />
        </div>
      </div>
    </div>
  );
}

export function InboxView() {
  const { data: emails, isLoading, error, refetch, isFetching } = useEmails();
  const drafts = useStore((s) => s.drafts);
  const categoryOverrides = useStore((s) => s.categoryOverrides);
  const readOverrides = useStore((s) => s.readOverrides);
  const starredOverrides = useStore((s) => s.starredOverrides);
  const selectedId = useStore((s) => s.selectedEmailId);
  const selectEmail = useStore((s) => s.selectEmail);
  const [filter, setFilter] = React.useState<CategoryId | "all">("all");
  const [query, setQuery] = React.useState("");

  // Apply persisted overrides to the fetched emails.
  const merged = React.useMemo(() => {
    if (!emails) return [];
    return emails.map((e) => ({
      ...e,
      category: categoryOverrides[e.id] ?? e.category,
      unread: readOverrides[e.id] !== undefined ? !readOverrides[e.id] : e.unread,
      starred: starredOverrides[e.id] ?? e.starred,
      draft: drafts[e.id] ?? e.draft,
    }));
  }, [emails, categoryOverrides, readOverrides, starredOverrides, drafts]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of merged) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, [merged]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return merged.filter((e) => {
      if (filter !== "all" && e.category !== filter) return false;
      if (!q) return true;
      return e.subject.toLowerCase().includes(q) || e.from.name.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q);
    });
  }, [merged, filter, query]);

  const selected = merged.find((e) => e.id === selectedId) ?? null;

  const gmailConnected = !isLoading && !error && emails !== undefined;
  const inboxEmpty = gmailConnected && merged.length === 0;
  const notConnected = error instanceof NotConnectedError;

  return (
    <div className="h-full flex min-h-0">
      <div className={cn("w-full md:w-[380px] shrink-0 border-r flex flex-col min-h-0", selected && "hidden md:flex")}>
        <div className="p-3 space-y-2 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search inbox…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-9" disabled={!gmailConnected} />
          </div>
          <div className="flex items-center justify-between">
            <CategoryFilter active={filter} counts={counts} onChange={setFilter} />
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin min-h-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {inboxEmpty ? "No emails yet." : "No emails match."}
            </div>
          ) : (
            filtered.map((e) => (
              <EmailRow key={e.id} email={e} active={selected?.id === e.id} hasDraft={Boolean(drafts[e.id])} onClick={() => selectEmail(e.id)} />
            ))
          )}
        </div>
      </div>

      <div className={cn("flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col", !selected && "hidden md:flex")}>
        {isLoading ? (
          <LoadingState />
        ) : notConnected ? (
          <NotConnectedState />
        ) : inboxEmpty ? (
          <EmptyInboxState />
        ) : selected ? (
          <EmailDetail email={selected} onClose={() => selectEmail(null)} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="h-14 w-14 rounded-2xl brand-gradient flex items-center justify-center mb-4">
              <Mail className="h-7 w-7 text-white" />
            </div>
            <h3 className="font-semibold text-lg">Select an email</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Pick a message to read it, see how the AI categorizes it, and generate a tone-matched reply.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
