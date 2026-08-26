"use client";

import * as React from "react";
import {
  Download,
  FileText,
  ImageIcon,
  File,
  X,
  Loader2,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/lib/types";

/** Bytes as something a person reads, e.g. `1.4 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

type Kind = "pdf" | "image" | "text" | "other";

/** How a part should be shown, decided by content type rather than filename. */
export function attachmentKind(mimeType: string): Kind {
  const type = mimeType.toLowerCase();
  if (type === "application/pdf") return "pdf";
  // SVG is an image that can carry script, so it is not previewed inline.
  if (type.startsWith("image/") && type !== "image/svg+xml") return "image";
  if (type.startsWith("text/") || type === "application/json") return "text";
  return "other";
}

/**
 * Keyed on the part path rather than Gmail's attachmentId: the id is opaque,
 * enormous, and not guaranteed to still be the one Gmail answers to by the
 * time someone clicks. The path is short and cannot change.
 */
function attachmentUrl(messageId: string, partId: string, download = false): string {
  const base = `/api/gmail/message/${encodeURIComponent(messageId)}/attachment/${encodeURIComponent(partId)}`;
  return download ? `${base}?download=1` : base;
}

const ICONS: Record<Kind, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  image: ImageIcon,
  text: FileText,
  other: File,
};

const ICON_TINT: Record<Kind, string> = {
  pdf: "text-red-500",
  image: "text-emerald-500",
  text: "text-amber-500",
  other: "text-muted-foreground",
};

/**
 * The files on a message: a row of chips, and whichever one is open shown
 * below. Bytes come from our own route rather than Gmail, so nothing here
 * needs an access token.
 */
export function AttachmentBar({
  messageId,
  attachments,
}: {
  messageId: string;
  attachments: Attachment[];
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  // Moving to another message closes whatever was open.
  React.useEffect(() => setOpenId(null), [messageId]);

  if (attachments.length === 0) return null;
  const open = attachments.find((a) => a.partId === openId) ?? null;

  return (
    <div className="mt-5 pt-4 border-t">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
      </div>

      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => {
          const kind = attachmentKind(attachment.mimeType);
          const Icon = ICONS[kind];
          const active = attachment.partId === openId;
          return (
            <div
              key={attachment.partId}
              className={cn(
                "flex items-stretch rounded-lg border overflow-hidden bg-card transition-colors",
                active ? "border-primary" : "hover:border-primary/60"
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(active ? null : attachment.partId)}
                className="flex items-center gap-2.5 px-3 py-2 max-w-[280px] text-left"
                title={`Preview ${attachment.filename}`}
              >
                <Icon className={cn("h-4 w-4 shrink-0", ICON_TINT[kind])} />
                <span className="min-w-0">
                  <span className="block text-sm truncate">{attachment.filename}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatBytes(attachment.size)}
                  </span>
                </span>
              </button>
              <a
                href={attachmentUrl(messageId, attachment.partId, true)}
                download={attachment.filename}
                className="flex items-center px-2.5 border-l text-muted-foreground hover:text-primary hover:bg-accent"
                title={`Download ${attachment.filename}`}
                aria-label={`Download ${attachment.filename}`}
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
          );
        })}
      </div>

      {open && (
        <AttachmentPreview
          messageId={messageId}
          attachment={open}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function AttachmentPreview({
  messageId,
  attachment,
  onClose,
}: {
  messageId: string;
  attachment: Attachment;
  onClose: () => void;
}) {
  const kind = attachmentKind(attachment.mimeType);
  const url = attachmentUrl(messageId, attachment.partId);

  return (
    <div className="mt-3 rounded-lg border overflow-hidden bg-card">
      <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/40">
        <span className="text-sm font-medium truncate">{attachment.filename}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
          {attachment.mimeType} · {formatBytes(attachment.size)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="outline" size="sm" className="h-7">
            <a href={attachmentUrl(messageId, attachment.partId, true)} download={attachment.filename}>
              Download
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AskAboutFile messageId={messageId} attachment={attachment} />

      {(kind === "pdf" || kind === "image") && (
        <BytesPreview kind={kind} filename={attachment.filename} url={url} />
      )}

      {kind === "text" && <TextPreview url={url} />}

      {kind === "other" && (
        <div className="py-12 px-5 text-center text-sm text-muted-foreground">
          <p>No preview for {attachment.mimeType || "this file type"}.</p>
          <p className="text-xs mt-1">Download it to open in another application.</p>
        </div>
      )}
    </div>
  );
}

/** The route's own words about a failure, rather than a bare status code. */
async function readErrorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `The server returned ${res.status}.`;
}

function PreviewSpinner() {
  return (
    <div className="py-16 flex items-center justify-center text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

/**
 * A preview that could not be shown, said in words.
 *
 * Retry rather than Download, because the failures worth offering an action
 * for — a session that lapsed while the message sat open, a stumble from
 * Gmail — are the ones that come good on a second ask. Downloading goes
 * through the same route and would fail the same way.
 */
function PreviewProblem({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-12 px-5 flex flex-col items-center gap-3 text-center">
      <AlertTriangle className="h-5 w-5 text-amber-500" />
      <div>
        <p className="text-sm">{message}</p>
        <p className="text-xs text-muted-foreground mt-1">
          The file itself is untouched — this is only the preview.
        </p>
      </div>
      <Button variant="outline" size="sm" className="h-7" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Try again
      </Button>
    </div>
  );
}

type BlobState =
  | { status: "loading" }
  | { status: "ready"; href: string }
  | { status: "error"; message: string };

/**
 * Fetches the bytes, then hands back a blob URL for them.
 *
 * Pointing an <iframe> or <img> straight at the route renders whatever the
 * route returned — which is how a failed lookup used to reach people: a raw
 * `{"error":…}` sitting in the middle of the page where the document should
 * be. Fetching first means a failure can be recognised as one.
 */
function useAttachmentBlob(url: string): { state: BlobState; reload: () => void } {
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<BlobState>({ status: "loading" });

  React.useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setState({ status: "loading" });

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readErrorMessage(res));
        return res.blob();
      })
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: "ready", href: objectUrl });
      })
      .catch((err: Error) => {
        if (alive) setState({ status: "error", message: err.message });
      });

    return () => {
      alive = false;
      // A blob URL pins the bytes in memory until it is given up explicitly.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, attempt]);

  return { state, reload: () => setAttempt((n) => n + 1) };
}

/** A PDF or an image, once its bytes are in hand. */
function BytesPreview({
  kind,
  filename,
  url,
}: {
  kind: "pdf" | "image";
  filename: string;
  url: string;
}) {
  const { state, reload } = useAttachmentBlob(url);

  if (state.status === "loading") return <PreviewSpinner />;
  if (state.status === "error") {
    return <PreviewProblem message={state.message} onRetry={reload} />;
  }

  if (kind === "pdf") {
    // The browser's own PDF viewer — paging, zoom and print for free.
    return <iframe src={state.href} title={filename} className="w-full h-[600px] border-0" />;
  }
  return (
    <div className="p-4 text-center bg-muted/20">
      {/* Not next/image: the source is a blob URL of unknown dimensions. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={state.href}
        alt={filename}
        className="max-w-full max-h-[600px] inline-block rounded"
      />
    </div>
  );
}

/** Anything longer is truncated rather than dropped into the DOM whole. */
const MAX_PREVIEW_CHARS = 200_000;

function TextPreview({ url }: { url: string }) {
  const [attempt, setAttempt] = React.useState(0);
  const [text, setText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setText(null);
    setError(null);
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(await readErrorMessage(res));
        return res.text();
      })
      .then((body) => {
        if (!alive) return;
        setText(
          body.length > MAX_PREVIEW_CHARS
            ? `${body.slice(0, MAX_PREVIEW_CHARS)}\n\n— truncated —`
            : body
        );
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [url, attempt]);

  if (error) {
    return <PreviewProblem message={error} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  if (text === null) {
    return <PreviewSpinner />;
  }
  return (
    <pre className="p-4 max-h-[480px] overflow-auto text-xs leading-relaxed whitespace-pre-wrap break-words font-mono">
      {text}
    </pre>
  );
}

/**
 * Files staged on a reply that has not been sent. They are held in the
 * browser until Send, so closing the box costs nothing and nothing is
 * uploaded speculatively.
 */
export function PendingAttachments({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;
  const total = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="rounded-lg border bg-muted/20 p-2">
      <div className="text-xs text-muted-foreground mb-1.5">
        {files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(total)}
        {total > SEND_SIZE_LIMIT && (
          <span className="text-destructive"> — too large for Gmail, remove something</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {files.map((file, index) => {
          const kind = attachmentKind(file.type || "application/octet-stream");
          const Icon = ICONS[kind];
          return (
            <span
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-md border bg-card pl-2 pr-1 py-1 text-xs"
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", ICON_TINT[kind])} />
              <span className="max-w-[180px] truncate">{file.name}</span>
              <span className="text-muted-foreground">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${file.name}`}
                title={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Matches the server's cap, so the warning appears before the request does. */
export const SEND_SIZE_LIMIT = 25 * 1024 * 1024;

/**
 * Asks a question about the open file.
 *
 * The file itself never leaves the server: the request carries a message id,
 * an attachment id and the question, and the server fetches the bytes and
 * turns them into text. An answer is grounded in that text or the model is
 * told to say it does not know.
 */
function AskAboutFile({
  messageId,
  attachment,
}: {
  messageId: string;
  attachment: Attachment;
}) {
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [asking, setAsking] = React.useState(false);

  // A new file is a new subject; the previous answer is about something else.
  React.useEffect(() => {
    setQuestion("");
    setAnswer(null);
    setNote(null);
  }, [messageId, attachment.partId]);

  const ask = async () => {
    const asked = question.trim();
    if (!asked || asking) return;

    setAsking(true);
    setAnswer(null);
    setNote(null);
    try {
      const res = await fetch("/api/ai/attachment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId, attachmentId: attachment.partId, question: asked }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, string>;
      if (!res.ok) {
        setNote(data.error ?? "That could not be answered.");
        return;
      }
      setAnswer(data.answer ?? "");
      if (data.truncated) {
        setNote("The file was too long to send whole, so the end of it was not read.");
      }
    } catch (err) {
      setNote(String(err));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="px-3 py-2.5 border-b bg-muted/20">
      <div className="flex items-center gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ask();
          }}
          placeholder={`Ask about ${attachment.filename}…`}
          className="h-8 text-sm"
          disabled={asking}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={() => void ask()}
          disabled={asking || !question.trim()}
        >
          {asking ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          )}
          {asking ? "Reading…" : "Ask"}
        </Button>
      </div>

      {note && <div className="mt-2 text-xs text-muted-foreground">{note}</div>}

      {answer && (
        <div className="mt-2 rounded-md border bg-card p-2.5 text-sm whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  );
}
