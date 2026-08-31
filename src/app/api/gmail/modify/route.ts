import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/session";
import { getGmailAuthForUser, modifyMessages, GmailApiError } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
  starred: z.boolean().optional(),
  unread: z.boolean().optional(),
  archived: z.boolean().optional(),
});

/**
 * Stars, reads and archives — all of them label changes, so all one route.
 *
 * These used to live only in the browser's local storage, which meant the
 * app showed a star that Gmail had never been told about: gone on another
 * device, gone on a different browser, gone when storage was cleared, and
 * wrong in the meantime.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nothing valid to change" }, { status: 400 });
  }
  const { ids, ...change } = parsed.data;

  const gmailAuth = await getGmailAuthForUser(auth.userId);
  if (!gmailAuth) {
    return NextResponse.json(
      { error: "Gmail not connected", code: "GMAIL_NOT_CONNECTED" },
      { status: 404 }
    );
  }

  try {
    await modifyMessages(gmailAuth.accessToken, ids, change);
    return NextResponse.json({ changed: ids.length });
  } catch (err) {
    if (err instanceof GmailApiError) {
      console.error("[gmail/modify] rejected:", err.status, err.reason);
      return NextResponse.json(
        {
          error: err.needsReconnect
            ? "Gmail needs to be connected again before this app can change your mail."
            : "Gmail would not apply that change.",
          code: err.needsReconnect ? "GMAIL_NEEDS_RECONNECT" : undefined,
          detail: err.reason,
        },
        { status: err.status }
      );
    }
    console.error("[gmail/modify] error:", err);
    return NextResponse.json({ error: "Failed to apply that change" }, { status: 500 });
  }
}
