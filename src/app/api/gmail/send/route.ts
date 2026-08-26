import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import {
  getGmailAuthForUser,
  getReplyContext,
  sendReply,
  GmailApiError,
  MAX_OUTGOING_ATTACHMENT_BYTES,
  type OutgoingAttachment,
} from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends a reply to a message already in the user's mailbox.
 *
 * The recipient, subject and threading headers are read back from Gmail here,
 * not taken from the request. The client says which message it is replying to
 * and what the reply says; it does not get to name who receives it. That keeps
 * this endpoint from being a way to send mail from someone's account to an
 * address of the caller's choosing. Attaching files does not change that —
 * they ride along with a reply whose destination is still Gmail's answer.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const { id, body, attachments, tooLarge } = await readRequest(req);

    if (!id) return NextResponse.json({ error: "Missing message id" }, { status: 400 });
    if (tooLarge) {
      return NextResponse.json(
        {
          error: `Attachments are too large. Gmail accepts about ${Math.round(
            MAX_OUTGOING_ATTACHMENT_BYTES / (1024 * 1024)
          )} MB in one message.`,
          code: "ATTACHMENTS_TOO_LARGE",
        },
        { status: 413 }
      );
    }
    // A file on its own is a real message; only a reply with neither text nor
    // attachment is empty.
    if (!body?.trim() && attachments.length === 0) {
      return NextResponse.json({ error: "Cannot send an empty reply" }, { status: 400 });
    }

    const gmailAuth = await getGmailAuthForUser(auth.userId);
    if (!gmailAuth) {
      return NextResponse.json(
        { error: "Gmail not connected", code: "GMAIL_NOT_CONNECTED" },
        { status: 404 }
      );
    }

    const ctx = await getReplyContext(gmailAuth.accessToken, id);
    if (!ctx.to) {
      return NextResponse.json(
        { error: "Could not work out who to reply to." },
        { status: 422 }
      );
    }

    const sent = await sendReply(gmailAuth.accessToken, ctx, (body ?? "").trim(), attachments);
    return NextResponse.json({ ok: true, id: sent.id, threadId: sent.threadId, to: ctx.to });
  } catch (err) {
    console.error("[gmail/send] error:", err);

    if (err instanceof GmailApiError) {
      if (err.needsReconnect) {
        // Both cases are fixed by reconnecting, but they are not the same
        // problem, and saying "can only read your mail" about a dead token
        // sends the reader looking for a permission that is already granted.
        const scopeProblem = err.status === 403;
        return NextResponse.json(
          {
            error: scopeProblem
              ? "Reconnect Gmail to allow sending. This account was connected before InboxPilot could send, so its permission only covers reading."
              : "Google has stopped accepting this connection. Reconnect Gmail to send.",
            code: "GMAIL_NEEDS_RECONNECT",
            detail: err.reason,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Gmail refused to send the message.", code: "GMAIL_API_ERROR", detail: err.reason },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: "Failed to send the reply" }, { status: 500 });
  }
}

/**
 * Accepts either shape: JSON for a plain reply, multipart/form-data when
 * files are attached. JSON stays supported so a text-only send is the same
 * request it has always been.
 */
async function readRequest(req: Request): Promise<{
  id?: string;
  body?: string;
  attachments: OutgoingAttachment[];
  tooLarge: boolean;
}> {
  const contentType = req.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    const json = (await req.json()) as { id?: string; body?: string };
    return { id: json.id, body: json.body, attachments: [], tooLarge: false };
  }

  const form = await req.formData();
  const id = typeof form.get("id") === "string" ? (form.get("id") as string) : undefined;
  const body = typeof form.get("body") === "string" ? (form.get("body") as string) : "";

  const attachments: OutgoingAttachment[] = [];
  let total = 0;
  for (const entry of form.getAll("files")) {
    if (!(entry instanceof File)) continue;
    total += entry.size;
    if (total > MAX_OUTGOING_ATTACHMENT_BYTES) {
      return { id, body, attachments: [], tooLarge: true };
    }
    attachments.push({
      filename: entry.name,
      mimeType: entry.type || "application/octet-stream",
      data: Buffer.from(await entry.arrayBuffer()),
    });
  }

  return { id, body, attachments, tooLarge: false };
}
