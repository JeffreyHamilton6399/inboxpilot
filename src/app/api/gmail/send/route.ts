import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getGmailAuthForUser, getReplyContext, sendReply, GmailApiError } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends a reply to a message already in the user's mailbox.
 *
 * The recipient, subject and threading headers are read back from Gmail here,
 * not taken from the request. The client says which message it is replying to
 * and what the reply says; it does not get to name who receives it. That keeps
 * this endpoint from being a way to send mail from someone's account to an
 * address of the caller's choosing.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const { id, body } = (await req.json()) as { id?: string; body?: string };

    if (!id) return NextResponse.json({ error: "Missing message id" }, { status: 400 });
    if (!body?.trim()) {
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

    const sent = await sendReply(gmailAuth.accessToken, ctx, body.trim());
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
