"use client";

import * as React from "react";
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
  MoreHorizontal,
  AlertCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { useEmails, fetchEmailBody, useThread, InboxError } from "@/lib/use-emails";
import { splitQuotedReply, unwrap } from "@/lib/message-format";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/defaults";
import type { CategoryId, Email, ThreadMessage, ToneProfile } from "@/lib/types";
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

/**
 * Three different situations that used to share one screen. Telling somebody
 * to connect an account they already connected is worse than saying nothing,
 * because it sends them round a loop that cannot fix the problem.
 */
function InboxProblemState({ problem }: { problem: InboxError }) {
  const reconnect = problem.problem === "needs-reconnect";
  const gmailError = problem.problem === "gmail-error";

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        {gmailError ? (
          <AlertCircle className="h-7 w-7 text-amber-500" />
        ) : (
          <Plug className="h-7 w-7 text-primary" />
        )}
      </div>

      <h3 className="font-semibold text-lg">
        {gmailError ? "Gmail refused the request" : reconnect ? "Reconnect your Gmail" : "Connect your Gmail"}
      </h3>

      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {gmailError
          ? "Your account is connected, but Google would not return your mail. The reason it gave is below — most often the Gmail API has not been enabled on the Google Cloud project this app uses."
          : reconnect
            ? "Your account is connected, but Google has stopped accepting the connection. This happens when access is revoked or the grant expires. Reconnecting takes a few seconds."
            : "InboxPilot reads your real Gmail inbox so the AI can organize it, draft replies, and answer questions about your email. Nothing is sent without your say-so."}
      </p>

      {problem.detail && (
        <p className="mt-3 max-w-md rounded-md bg-muted px-3 py-2 text-left text-[11px] font-mono text-muted-foreground break-words">
          {problem.detail}
        </p>
      )}

      {!gmailError && (
        <Button className="mt-5" onClick={connectGmail}>
          <Plug className="h-4 w-4 mr-2" /> {reconnect ? "Reconnect Gmail" : "Connect Gmail"}
        </Button>
      )}

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
    // min-w-0 is what stops the scrolling row from pushing itself out under
    // the refresh button next to it, which clipped the last chip.
    <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scroll-thin pb-1">
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

function ComposeArea({ email, bodyLoading }: { email: Email; bodyLoading: boolean }) {
  const tone = useStore((s) => s.tone);
  const setDraft = useStore((s) => s.setDraft);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [confirmSend, setConfirmSend] = React.useState(false);

  const existingDraft = useStore((s) => s.drafts[email.id]);

  /**
   * One button, two jobs, decided by whether the box has anything in it.
   *
   * There used to be a panel with its own text field for instructions, which
   * meant two boxes to look at and a decision to make before anything happened.
   * An empty box means "write one"; a box with words in it means "improve
   * these" — and the words in the box are what gets improved, rather than
   * being thrown away and regenerated from the original mail.
   */
  const assist = async () => {
    const current = existingDraft?.trim() ?? "";
    setLoading(true);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: { from: email.from.name, subject: email.subject, body: email.body, preview: email.preview },
          tone: tone as ToneProfile,
          draft: current || undefined,
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
      toast({ title: current ? "Draft improved" : "Draft ready" });
    } catch (e) {
      toast({ title: "Couldn't write the draft", description: String(e), variant: "destructive" });
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

  /**
   * Two presses to send, and the second one names the recipient.
   *
   * The reply goes out through the Gmail API from the user's own account and
   * cannot be recalled, and the text may have been written by a model. A
   * confirm step is the cheapest possible guard against the one mistake here
   * that cannot be undone.
   */
  const send = async () => {
    if (!existingDraft?.trim() || sending) return;

    if (!confirmSend) {
      setConfirmSend(true);
      // Falls back to the normal button if they look away and come back.
      setTimeout(() => setConfirmSend(false), 5000);
      return;
    }

    setConfirmSend(false);
    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: email.id, body: existingDraft }),
      });
      const data = await res.json().catch(() => ({}) as Record<string, string>);

      if (!res.ok) {
        toast({
          title: res.status === 409 ? "Reconnect Gmail to send" : "Could not send",
          description: data.detail ? `${data.error} (${data.detail})` : (data.error ?? "Gmail refused the request."),
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Reply sent", description: `Delivered to ${data.to}.` });
      setDraft(email.id, "");
      // Pull the thread again so what was just sent appears in it. Without
      // this the reply disappears at the moment of sending, which reads as
      // having lost it.
      qc.invalidateQueries({ queryKey: ["thread", email.threadId || email.id] });
    } catch (err) {
      toast({ title: "Could not send", description: String(err), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Kept as a way out: attachments, a different account, or anything else this
  // compose box deliberately does not do.
  const openInGmail = () => {
    if (!existingDraft) return;
    const subject = email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`;
    const url = new URL("https://mail.google.com/mail/");
    url.search = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: email.from.email,
      su: subject,
      body: existingDraft,
    }).toString();
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="border-t bg-card">
      {/* Compose textarea — normal, like Gmail */}
      <div className="p-3 md:p-4 space-y-2">
        <Textarea
          value={existingDraft ?? ""}
          onChange={(e) => setDraft(email.id, e.target.value)}
          placeholder="Type your reply… or use AI to draft one"
          className="min-h-[120px] resize-y border-0 bg-muted/30 focus-visible:ring-1"
        />

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={send}
            disabled={!existingDraft?.trim() || sending}
            variant={confirmSend ? "destructive" : "default"}
            title={`Reply to ${email.from.email}`}
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1.5" />
            )}
            {sending ? "Sending…" : confirmSend ? `Send to ${email.from.name}?` : "Send"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={assist}
            disabled={bodyLoading || loading}
            title={
              existingDraft?.trim()
                ? "Rewrite what is in the box, keeping what it says"
                : "Write a reply to this message"
            }
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            {loading ? "Writing…" : existingDraft?.trim() ? "Improve" : "Write with AI"}
          </Button>
          {existingDraft && (
            <>
              <Button size="sm" variant="ghost" onClick={copy} className="h-8">
                {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={openInGmail}>
                Open in Gmail
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => setDraft(email.id, "")}>
                Clear
              </Button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

/**
 * A mail body, rendered so it can be read.
 *
 * Three things were wrong with printing it raw: plain-text mail is hard-wrapped
 * at a fixed column and went ragged in a wide pane, long URLs pushed the pane
 * sideways, and the quoted history — usually longer than the message — sat
 * underneath every reply in full.
 */
function MessageBody({ raw }: { raw: string }) {
  const [showQuoted, setShowQuoted] = React.useState(false);
  const { body, quoted } = React.useMemo(() => splitQuotedReply(raw ?? ""), [raw]);
  const text = React.useMemo(() => unwrap(body), [body]);

  if (!raw?.trim()) {
    return <span className="text-sm text-muted-foreground italic">(empty message)</span>;
  }

  return (
    <div className="text-sm leading-relaxed text-foreground/90">
      <div className="max-w-[68ch] whitespace-pre-wrap break-words">{text}</div>

      {quoted && (
        <div className="mt-4">
          <button
            onClick={() => setShowQuoted((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded border bg-muted/50 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-expanded={showQuoted}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
            {showQuoted ? "Hide quoted text" : "Show quoted text"}
          </button>
          {showQuoted && (
            <div className="mt-3 max-w-[68ch] whitespace-pre-wrap break-words border-l-2 pl-3 text-muted-foreground">
              {quoted}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One message inside a conversation. Older ones start folded, as in Gmail. */
function ThreadEntry({
  message,
  defaultOpen,
}: {
  message: ThreadMessage;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const { body } = React.useMemo(() => splitQuotedReply(message.body ?? ""), [message.body]);
  const preview = React.useMemo(() => body.replace(/\s+/g, " ").slice(0, 120), [body]);

  return (
    <div
      className={cn(
        "rounded-lg border",
        // Your own replies are tinted, so scanning a thread tells you who said
        // what without reading a single name.
        message.fromMe ? "border-primary/30 bg-primary/[0.04]" : "bg-card"
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span
          className={cn(
            "h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold",
            message.fromMe ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          {initials(message.fromMe ? "You" : message.from.name)}
        </span>
        <span className="text-sm font-medium shrink-0">
          {message.fromMe ? "You" : message.from.name}
        </span>
        {!open && <span className="text-xs text-muted-foreground truncate">{preview}</span>}
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          <TimeAgo iso={message.receivedAt} />
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3">
          <MessageBody raw={message.body} />
        </div>
      )}
    </div>
  );
}

/**
 * The whole conversation, oldest first, with the newest message open.
 *
 * Reading one message in isolation is reading half of an exchange, and until
 * this existed a reply sent from the app vanished the instant it was sent —
 * sent mail is not in the inbox listing. Falls back to the single message when
 * the thread cannot be loaded, so a failure here never hides the mail.
 */
function Conversation({
  email,
  fallbackBody,
  fallbackLoading,
}: {
  email: Email;
  fallbackBody: string;
  fallbackLoading: boolean;
}) {
  const { data, isLoading, isError } = useThread(email.threadId || email.id);
  const messages = data?.messages ?? [];

  if (isLoading || (fallbackLoading && !messages.length)) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
      </span>
    );
  }

  if (isError || messages.length === 0) {
    return <MessageBody raw={fallbackBody || email.preview} />;
  }

  // A conversation of one is just a message; the folding chrome would be noise.
  if (messages.length === 1) {
    return <MessageBody raw={messages[0].body || fallbackBody || email.preview} />;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {messages.length} messages in this conversation
      </div>
      {messages.map((m, i) => (
        <ThreadEntry key={m.id} message={m} defaultOpen={i === messages.length - 1} />
      ))}
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
      {/* Toolbar */}
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
        <CategoryBadge id={email.category} className="ml-auto" />
      </div>

      {/* Email body — scrolls independently */}
      <div className="flex-1 overflow-y-auto scroll-thin min-h-0">
        <div className="p-4 md:p-6 max-w-3xl">
          <h2 className="text-xl font-semibold leading-tight">{email.subject}</h2>
          <div className="mt-3 flex items-start gap-3">
            <span className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0", email.from.avatarColor)}>
              {initials(email.from.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{email.from.name}</span>
                <span className="text-xs text-muted-foreground truncate">{email.from.email}</span>
              </div>
              {email.to && (
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  to {truncateRecipients(email.to)}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0"><TimeAgo iso={email.receivedAt} /></span>
          </div>

          <div className="mt-4 pt-4 border-t">
            <Conversation email={email} fallbackBody={body} fallbackLoading={loadingBody} />
          </div>
        </div>
      </div>

      {/* Compose area — fixed at bottom, AI on demand */}
      <ComposeArea email={emailWithBody} bodyLoading={loadingBody} />
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
  const problem = error instanceof InboxError ? error : null;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <div className={cn("w-full md:w-[380px] shrink-0 border-r flex flex-col min-h-0", selected && "hidden md:flex")}>
        <div className="p-3 space-y-2 border-b shrink-0">
          {/* Refresh sits with the search box, not beside the filters: the
              filter row scrolls sideways, and a button next to a scrolling row
              means the last chip is always half under it. */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search inbox…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-9" disabled={!gmailConnected} />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
          <CategoryFilter active={filter} counts={counts} onChange={setFilter} />
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
        ) : problem ? (
          <InboxProblemState problem={problem} />
        ) : inboxEmpty ? (
          <EmptyInboxState />
        ) : selected ? (
          <EmailDetail email={selected} onClose={() => selectEmail(null)} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
              <Mail className="h-7 w-7 text-primary-foreground" />
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
