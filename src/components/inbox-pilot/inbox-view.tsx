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
  ArrowUpDown,
  Archive,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import {
  useEmails,
  fetchEmailDetail,
  useThread,
  useMessageActions,
  InboxError,
} from "@/lib/use-emails";
import { AttachmentBar, PendingAttachments } from "@/components/inbox-pilot/attachments";
import { splitQuotedReply, unwrap } from "@/lib/message-format";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/defaults";
import type { Attachment, CategoryId, Email, ThreadMessage, ToneProfile } from "@/lib/types";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHotkeys } from "@/lib/use-hotkeys";
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
    <EmptyState
      label={gmailError ? "Gmail said no" : "Not connected"}
      title={
        gmailError
          ? "Gmail refused the request"
          : reconnect
            ? "Reconnect your Gmail"
            : "Connect your Gmail"
      }
    >
      <p>
        {gmailError
          ? "Your account is connected, but Google would not return your mail. The reason it gave is below — most often the Gmail API has not been enabled on the Google Cloud project this app uses."
          : reconnect
            ? "Your account is connected, but Google has stopped accepting the connection. This happens when access is revoked or the grant expires. Reconnecting takes a few seconds."
            : "InboxPilot reads your real Gmail inbox so it can sort it, draft replies, and answer questions about it. Nothing is sent without your say-so."}
      </p>

      {problem.detail && (
        <p className="mt-3 border-l-2 border-border py-1 pl-3 font-mono text-[11px] leading-relaxed break-words">
          {problem.detail}
        </p>
      )}

      {!gmailError && (
        <div className="mt-5">
          <Button onClick={connectGmail}>
            <Plug className="h-4 w-4" /> {reconnect ? "Reconnect Gmail" : "Connect Gmail"}
          </Button>
          <p className="mt-2.5 text-xs">
            Google&apos;s own sign-in. Disconnect any time from Settings.
          </p>
        </div>
      )}
    </EmptyState>
  );
}

/**
 * The house style for a screen with nothing on it: a mono label, a plain
 * heading, and a paragraph inside a readable measure. No tinted icon tile —
 * a large decorative glyph over three words of explanation is filler standing
 * where the explanation should be.
 */
function EmptyState({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md">
        <p className="eyebrow">{label}</p>
        <h3 className="mt-3 text-[15px] font-semibold tracking-tight">{title}</h3>
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function EmptyInboxState() {
  return (
    <EmptyState label="Nothing waiting" title="Inbox zero">
      <p>
        Gmail is connected and there is nothing new right now. Anything that arrives will be sorted
        as it lands.
      </p>
    </EmptyState>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <span className="inline-flex items-center gap-2.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your inbox…
      </span>
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
    <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scroll-thin pb-1 [mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)]">
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

/**
 * Clears a whole category in one go — the thing the AI sorting is actually
 * for. Gmail can archive in bulk too, but only after you have selected the
 * messages yourself; here the category has already done that.
 *
 * Only offered with a filter applied. An "archive everything" button sitting
 * over the unfiltered inbox is a mis-click with no undo.
 */
function ArchiveFiltered({
  filter,
  emails,
  onDone,
}: {
  filter: CategoryId | "all";
  emails: Email[];
  onDone: () => void;
}) {
  const actions = useMessageActions();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (filter === "all" || emails.length === 0) return null;
  const label = CATEGORY_MAP[filter].label;

  const run = async () => {
    setBusy(true);
    const ids = emails.map((e) => e.id);
    // The toast, and the undo with it, come from useMessageActions so that
    // every route to archiving offers the same way back.
    await actions.archive(ids);
    setBusy(false);
    setConfirming(false);
    onDone();
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 shrink-0"
        onClick={() => setConfirming(true)}
      >
        <Archive className="h-3.5 w-3.5 mr-1.5" />
        Archive {emails.length}
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Archive {emails.length} {emails.length === 1 ? "message" : "messages"}?
            </DialogTitle>
            <DialogDescription>
              Everything currently shown under {label} leaves the inbox. Nothing
              is deleted — it stays in All Mail and in search, exactly as
              archiving in Gmail works.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void run()} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Archive {emails.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Waits for typing to settle before letting a value through. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: "j / k", does: "Next / previous message — it opens as you go" },
  { keys: "u", does: "Back to the list" },
  { keys: "e", does: "Archive, and move on" },
  { keys: "s", does: "Star" },
  { keys: "/", does: "Search" },
  { keys: "Esc", does: "Leave the search box, or close the message" },
  { keys: "?", does: "This list" },
];

function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            They do nothing while you are typing, so a compose box never eats
            them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-baseline gap-3 text-sm">
              <kbd className="shrink-0 min-w-[4.5rem] rounded border bg-muted px-1.5 py-0.5 text-center font-mono text-xs">
                {s.keys}
              </kbd>
              <span className="text-muted-foreground">{s.does}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type SortKey = "newest" | "oldest" | "unread" | "sender" | "needs-reply";

const SORTS: { key: SortKey; label: string; short: string }[] = [
  { key: "newest", label: "Newest first", short: "Newest" },
  { key: "oldest", label: "Oldest first", short: "Oldest" },
  { key: "unread", label: "Unread first", short: "Unread" },
  { key: "needs-reply", label: "Needs a reply first", short: "Needs reply" },
  { key: "sender", label: "By sender", short: "Sender" },
];

/**
 * Runs the real classifier over the whole inbox.
 *
 * The instant pass labels everything on arrival from headers and sender
 * domains, which is free and usually right. This is the button for when it is
 * not: it sends the inbox to the model in batches of twenty-five, because one
 * request per message would be forty round trips to sort one inbox.
 */
function SortWithAI({ emails }: { emails: Email[] }) {
  const setCategory = useStore((s) => s.setCategory);
  const { toast } = useToast();
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(0);

  const run = async () => {
    if (running || emails.length === 0) return;
    setRunning(true);
    setDone(0);

    const batches: Email[][] = [];
    for (let i = 0; i < emails.length; i += 25) batches.push(emails.slice(i, i + 25));

    let changed = 0;
    try {
      for (const batch of batches) {
        const res = await fetch("/api/ai/categorize/batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            emails: batch.map((e) => ({
              id: e.id,
              from: `${e.from.name} <${e.from.email}>`,
              subject: e.subject,
              preview: e.preview,
            })),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}) as Record<string, string>);
          throw new Error(body.error ?? "The model could not sort these.");
        }

        const { results } = (await res.json()) as {
          results: { id: string; category: CategoryId }[];
        };
        for (const r of results) {
          const before = batch.find((e) => e.id === r.id)?.category;
          setCategory(r.id, r.category);
          if (before !== r.category) changed++;
        }
        setDone((d) => d + batch.length);
      }

      toast({
        title: "Inbox sorted",
        description: changed
          ? `${changed} of ${emails.length} moved to a different tag.`
          : `The model agreed with all ${emails.length}.`,
      });
    } catch (e) {
      toast({ title: "Couldn't sort the inbox", description: String(e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 shrink-0"
      onClick={run}
      disabled={running || emails.length === 0}
      title="Re-read every message and assign tags with the model"
    >
      {running ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <Wand2 className="h-3.5 w-3.5 mr-1.5" />
      )}
      {running ? `Sorting ${done}/${emails.length}…` : "Sort with AI"}
    </Button>
  );
}

function SortMenu({ sort, onChange }: { sort: SortKey; onChange: (s: SortKey) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 shrink-0 text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          {SORTS.find((s) => s.key === sort)?.short ?? "Sort"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SORTS.map((s) => (
          <DropdownMenuItem key={s.key} onClick={() => onChange(s.key)} className="gap-2">
            {s.key === sort ? <Check className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
      data-email-id={email.id}
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
  // Files live only until the reply is sent; nothing is uploaded ahead of time.
  const [files, setFiles] = React.useState<File[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
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
      // Files force multipart; a plain reply stays the JSON request it
      // has always been.
      let res: Response;
      if (files.length > 0) {
        const form = new FormData();
        form.set("id", email.id);
        form.set("body", existingDraft ?? "");
        for (const file of files) form.append("files", file);
        res = await fetch("/api/gmail/send", { method: "POST", body: form });
      } else {
        res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: email.id, body: existingDraft }),
        });
      }
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
      setFiles([]);
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
      <div
        className={cn("p-3 md:p-4 space-y-2", dragging && "bg-primary/5 ring-1 ring-inset ring-primary")}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = Array.from(e.dataTransfer.files);
          if (dropped.length) setFiles((current) => [...current, ...dropped]);
        }}
      >
        <Textarea
          value={existingDraft ?? ""}
          onChange={(e) => setDraft(email.id, e.target.value)}
          placeholder="Type your reply… or use AI to draft one"
          className="min-h-[120px] resize-y border-0 bg-muted/30 focus-visible:ring-1"
        />

        <PendingAttachments
          files={files}
          onRemove={(index) => setFiles((current) => current.filter((_, i) => i !== index))}
        />

        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) setFiles((current) => [...current, ...picked]);
            // Reset so picking the same file twice still fires a change.
            e.target.value = "";
          }}
        />

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={send}
            disabled={(!existingDraft?.trim() && files.length === 0) || sending}
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
            onClick={() => fileInput.current?.click()}
            disabled={sending}
            title="Attach files, or drop them on this box"
          >
            <Paperclip className="h-3.5 w-3.5 mr-1.5" />
            Attach
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
  const setCategory = useStore((s) => s.setCategory);
  const actions = useMessageActions();
  const { toast } = useToast();
  const [recategorizing, setRecategorizing] = React.useState(false);
  const [body, setBody] = React.useState(email.body);
  const [loadingBody, setLoadingBody] = React.useState(!email.body);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);

  // Opening a message marks it read at Gmail too, the way every other client
  // does — so it is not still bold on your phone.
  const markRead = actions.read;
  React.useEffect(() => {
    if (email.unread) void markRead(email.id, true);
    // `markRead` is rebuilt each render; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email.id, email.unread]);

  React.useEffect(() => {
    let alive = true;
    setAttachments([]);
    // The listing has no attachment data, so the detail is fetched even
    // when the body is already known.
    setLoadingBody(!email.body);
    fetchEmailDetail(email.id)
      .then(({ body: b, attachments: files }) => {
        if (!alive) return;
        if (!email.body) setBody(b);
        setAttachments(files);
        setLoadingBody(false);
      })
      .catch(() => { if (alive) setLoadingBody(false); });
    if (email.body) setBody(email.body);
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void actions.star(email.id, !email.starred)}>
                  <Star className={cn("h-4 w-4", email.starred && "fill-amber-400 text-amber-400")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Star</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void actions.read(email.id, email.unread)}>
            {email.unread ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    void actions.archive([email.id]);
                    onClose();
                  }}
                  aria-label="Archive"
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Archive</TooltipContent>
            </Tooltip>
          </TooltipProvider>
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

          <AttachmentBar messageId={email.id} attachments={attachments} />
        </div>
      </div>

      {/* Compose area — fixed at bottom, AI on demand */}
      <ComposeArea email={emailWithBody} bodyLoading={loadingBody} />
    </div>
  );
}

export function InboxView() {
  const [query, setQuery] = React.useState("");
  // Gmail is asked once typing settles, not once per keystroke.
  const search = useDebounced(query.trim(), 400);
  const searching = search.length > 0;
  const {
    emails,
    isLoading,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEmails(search);
  const drafts = useStore((s) => s.drafts);
  const categoryOverrides = useStore((s) => s.categoryOverrides);
  const readOverrides = useStore((s) => s.readOverrides);
  const starredOverrides = useStore((s) => s.starredOverrides);
  const selectedId = useStore((s) => s.selectedEmailId);
  const selectEmail = useStore((s) => s.selectEmail);
  const [filter, setFilter] = React.useState<CategoryId | "all">("all");
  const [sort, setSort] = React.useState<SortKey>("newest");

  const archivedIds = useStore((s) => s.archivedIds);

  // Apply persisted overrides to the fetched emails.
  const merged = React.useMemo(() => {
    if (!emails) return [];
    // Hidden from the inbox, but a search across all mail is entitled to find
    // them — that is what archiving means.
    const archived = new Set(searching ? [] : archivedIds);
    return emails.filter((e) => !archived.has(e.id)).map((e) => ({
      ...e,
      category: categoryOverrides[e.id] ?? e.category,
      unread: readOverrides[e.id] !== undefined ? !readOverrides[e.id] : e.unread,
      starred: starredOverrides[e.id] ?? e.starred,
      draft: drafts[e.id] ?? e.draft,
    }));
  }, [emails, archivedIds, searching, categoryOverrides, readOverrides, starredOverrides, drafts]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of merged) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, [merged]);

  const filtered = React.useMemo(() => {
    // Only while the inbox is what is loaded. Once Gmail has run the search,
    // re-filtering here would throw away its matches: it searches full message
    // bodies, and the list only carries subject, sender and snippet.
    const q = searching ? "" : query.trim().toLowerCase();
    const list = merged.filter((e) => {
      if (filter !== "all" && e.category !== filter) return false;
      if (!q) return true;
      return e.subject.toLowerCase().includes(q) || e.from.name.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q);
    });

    const byDate = (a: Email, b: Email) =>
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();

    switch (sort) {
      case "oldest":
        return [...list].sort((a, b) => -byDate(a, b));
      case "unread":
        // Unread first, each group still newest first.
        return [...list].sort((a, b) => Number(b.unread) - Number(a.unread) || byDate(a, b));
      case "sender":
        return [...list].sort(
          (a, b) => a.from.name.localeCompare(b.from.name) || byDate(a, b)
        );
      case "needs-reply":
        return [...list].sort(
          (a, b) =>
            Number(b.category === "to-respond") - Number(a.category === "to-respond") ||
            byDate(a, b)
        );
      default:
        return [...list].sort(byDate);
    }
  }, [merged, filter, query, searching, sort]);

  const selected = merged.find((e) => e.id === selectedId) ?? null;

  const actions = useMessageActions();
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [showShortcuts, setShowShortcuts] = React.useState(false);

  /** Steps the selection through the list as it is currently shown. */
  const step = React.useCallback(
    (delta: number) => {
      if (filtered.length === 0) return;
      const at = filtered.findIndex((e) => e.id === selectedId);
      const next =
        at === -1
          ? delta > 0
            ? 0
            : filtered.length - 1
          : Math.min(filtered.length - 1, Math.max(0, at + delta));
      selectEmail(filtered[next].id);
    },
    [filtered, selectedId, selectEmail]
  );

  useHotkeys({
    j: () => step(1),
    k: () => step(-1),
    u: () => selectEmail(null),
    "/": () => searchRef.current?.focus(),
    "?": () => setShowShortcuts(true),
    s: () => {
      if (selected) void actions.star(selected.id, !selected.starred);
    },
    e: () => {
      if (!selected) return;
      // Land on the next message rather than nothing, the way Gmail does —
      // archiving a run of mail should not need a click between each one.
      const at = filtered.findIndex((x) => x.id === selected.id);
      const after = filtered[at + 1] ?? filtered[at - 1] ?? null;
      void actions.archive([selected.id]);
      selectEmail(after ? after.id : null);
    },
    Escape: () => {
      if (document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
        return;
      }
      selectEmail(null);
    },
  });

  // Keep the keyboard selection on screen. `nearest` means clicking a row that
  // is already visible does not jerk the list around.
  React.useEffect(() => {
    if (!selectedId) return;
    document
      .querySelector(`[data-email-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const gmailConnected = !isLoading && !error && emails !== undefined;
  const inboxEmpty = gmailConnected && !searching && merged.length === 0;
  const problem = error instanceof InboxError ? error : null;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <ShortcutHelp open={showShortcuts} onOpenChange={setShowShortcuts} />
      <div className={cn("w-full md:w-[380px] shrink-0 border-r flex flex-col min-h-0", selected && "hidden md:flex")}>
        <div className="p-3 space-y-2 border-b shrink-0">
          {/* Refresh sits with the search box, not beside the filters: the
              filter row scrolls sideways, and a button next to a scrolling row
              means the last chip is always half under it. */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Search all mail — from:, has:attachment…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={cn("pl-8 h-9", query && "pr-8")}
                disabled={!gmailConnected}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
          {searching && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isFetching ? (
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              ) : (
                <Search className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">
                {isFetching
                  ? "Searching all mail…"
                  : `${merged.length} in all mail — not just the inbox`}
              </span>
            </div>
          )}
          <CategoryFilter active={filter} counts={counts} onChange={setFilter} />

          <div className="flex items-center gap-1">
            {/* "See all" is a button of its own rather than only the first chip
                in a row that scrolls sideways — with a filter applied and the
                chips scrolled along, the way back was off-screen. */}
            <Button
              size="sm"
              variant={filter === "all" ? "secondary" : "ghost"}
              className="h-8 shrink-0"
              onClick={() => { setFilter("all"); setQuery(""); }}
            >
              <InboxIcon className="h-3.5 w-3.5 mr-1.5" />
              {searching ? "Back to inbox" : "See all"}
              <span className="ml-1.5 tabular-nums text-muted-foreground">{merged.length}</span>
            </Button>
            <SortMenu sort={sort} onChange={setSort} />
            {!searching && (
              <ArchiveFiltered filter={filter} emails={filtered} onDone={() => setFilter("all")} />
            )}
            <div className="ml-auto">
              <SortWithAI emails={merged} />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin min-h-0">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {searching
                ? `Nothing in all mail matches “${search}”.`
                : inboxEmpty
                  ? "No emails yet."
                  : "No emails match."}
              {hasNextPage && !searching && (
                <span className="block mt-1 text-xs">
                  Only the first {merged.length} are loaded.
                </span>
              )}
            </div>
          )}

          {filtered.map((e) => (
            <EmailRow key={e.id} email={e} active={selected?.id === e.id} hasDraft={Boolean(drafts[e.id])} onClick={() => selectEmail(e.id)} />
          ))}

          {/* Outside the empty branch on purpose: a category filter can match
              nothing on the first page while later pages are full of it, and
              hiding the way forward there is a dead end. */}
          {hasNextPage && (
            <div className="p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
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
          <EmptyState label="Nothing open" title="Pick a message">
            <p>
              Opening one shows the thread, why it was sorted where it was, and a draft reply if
              you ask for one.
            </p>
            <p className="mt-3">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">j</kbd>{" "}
              and{" "}
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">k</kbd>{" "}
              move through the list without the mouse.{" "}
              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                className="underline underline-offset-4 hover:text-foreground"
              >
                The rest
              </button>
              .
            </p>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
