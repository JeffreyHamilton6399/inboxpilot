"use client";

import * as React from "react";
import { Download, FileText, ImageIcon, File, X, Loader2 } from "lucide-react";
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

function attachmentUrl(messageId: string, attachmentId: string, download = false): string {
  const base = `/api/gmail/message/${encodeURIComponent(messageId)}/attachment/${encodeURIComponent(attachmentId)}`;
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
  const open = attachments.find((a) => a.id === openId) ?? null;

  return (
    <div className="mt-5 pt-4 border-t">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
      </div>

      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => {
          const kind = attachmentKind(attachment.mimeType);
          const Icon = ICONS[kind];
          const active = attachment.id === openId;
          return (
            <div
              key={attachment.id}
              className={cn(
                "flex items-stretch rounded-lg border overflow-hidden bg-card transition-colors",
                active ? "border-primary" : "hover:border-primary/60"
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(active ? null : attachment.id)}
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
                href={attachmentUrl(messageId, attachment.id, true)}
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
  const url = attachmentUrl(messageId, attachment.id);

  return (
    <div className="mt-3 rounded-lg border overflow-hidden bg-card">
      <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/40">
        <span className="text-sm font-medium truncate">{attachment.filename}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
          {attachment.mimeType} · {formatBytes(attachment.size)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="outline" size="sm" className="h-7">
            <a href={attachmentUrl(messageId, attachment.id, true)} download={attachment.filename}>
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

      {kind === "pdf" && (
        // The browser's own PDF viewer — paging, zoom and print for free.
        <iframe src={url} title={attachment.filename} className="w-full h-[600px] border-0" />
      )}

      {kind === "image" && (
        <div className="p-4 text-center bg-muted/20">
          {/* Not next/image: the bytes come from an API route, and the
              dimensions are unknown until the response arrives. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={attachment.filename}
            className="max-w-full max-h-[600px] inline-block rounded"
          />
        </div>
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

/** Anything longer is truncated rather than dropped into the DOM whole. */
const MAX_PREVIEW_CHARS = 200_000;

function TextPreview({ url }: { url: string }) {
  const [text, setText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setText(null);
    setError(null);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
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
  }, [url]);

  if (error) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{error}</div>;
  }
  if (text === null) {
    return (
      <div className="py-10 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
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
