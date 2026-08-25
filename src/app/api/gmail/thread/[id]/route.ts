import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getGmailAuthForUser, getThread, GmailApiError } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The whole conversation for a thread, oldest first, replies included. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing thread id" }, { status: 400 });

  const gmailAuth = await getGmailAuthForUser(auth.userId);
  if (!gmailAuth) {
    return NextResponse.json(
      { error: "Gmail not connected", code: "GMAIL_NOT_CONNECTED" },
      { status: 404 }
    );
  }

  try {
    const messages = await getThread(gmailAuth.accessToken, id, gmailAuth.email);
    return NextResponse.json({ messages, self: gmailAuth.email });
  } catch (err) {
    console.error("[gmail/thread] error:", err);

    if (err instanceof GmailApiError) {
      if (err.needsReconnect) {
        return NextResponse.json(
          {
            error: "Google has stopped accepting this connection. Reconnect Gmail to continue.",
            code: "GMAIL_NEEDS_RECONNECT",
            detail: err.reason,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Gmail refused the request.", code: "GMAIL_API_ERROR", detail: err.reason },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: "Failed to load the conversation" }, { status: 500 });
  }
}
