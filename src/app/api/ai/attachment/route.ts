import { NextResponse } from "next/server";
import { chat, aiFailure, type ChatMsg } from "@/lib/ai";
import { requireAuth } from "@/lib/session";
import { getAttachment, getGmailAuthForUser, GmailApiError } from "@/lib/gmail";
import { extractAttachmentText } from "@/lib/attachment-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Answers a question about one attachment.
 *
 * The file is fetched here and turned into text here; the client sends a
 * message id, an attachment id and a question, and never the contents. That
 * keeps the same property the send route has — the client names what to act
 * on, not what the server should believe.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const { messageId, attachmentId, question } = (await req.json()) as {
      messageId?: string;
      attachmentId?: string;
      question?: string;
    };

    if (!messageId || !attachmentId) {
      return NextResponse.json({ error: "Missing attachment" }, { status: 400 });
    }
    if (!question?.trim()) {
      return NextResponse.json({ error: "Ask a question first" }, { status: 400 });
    }

    const gmailAuth = await getGmailAuthForUser(auth.userId);
    if (!gmailAuth) {
      return NextResponse.json(
        { error: "Gmail not connected", code: "GMAIL_NOT_CONNECTED" },
        { status: 404 }
      );
    }

    const found = await getAttachment(gmailAuth.accessToken, messageId, attachmentId);
    if (!found) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const extracted = await extractAttachmentText(found.meta.mimeType, found.data);
    if (extracted.status !== "ok") {
      // Not an error in the server sense — the file simply cannot be read as
      // text, and the reason is the useful part of the answer.
      return NextResponse.json(
        { error: extracted.reason, code: "ATTACHMENT_NOT_READABLE" },
        { status: 422 }
      );
    }

    const system: ChatMsg = {
      role: "system",
      content: `You answer questions about one file attached to an email.

Answer only from the file's contents, which follow. If the file does not contain
the answer, say that plainly instead of guessing — an invented figure from a
document is worse than no answer. Quote exact numbers, dates and names where they
matter. Be brief: a sentence or two unless the question needs more.${
        extracted.truncated
          ? "\n\nThe file was too long to include whole, so it is cut off. If the answer might be past the cut, say so."
          : ""
      }`,
    };

    const user: ChatMsg = {
      role: "user",
      content: `File: ${found.meta.filename}${
        extracted.pages ? ` (${extracted.pages} page${extracted.pages === 1 ? "" : "s"})` : ""
      }

--- file contents ---
${extracted.text}
--- end of file ---

Question: ${question.trim()}`,
    };

    const answer = await chat([system, user], { temperature: 0.2 });
    return NextResponse.json({ answer, filename: found.meta.filename, truncated: extracted.truncated });
  } catch (err) {
    if (err instanceof GmailApiError) {
      return NextResponse.json(
        { error: "Gmail would not hand over that file.", detail: err.reason },
        { status: 502 }
      );
    }
    const failure = aiFailure(err);
    console.error("[ai/attachment] error:", err);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
