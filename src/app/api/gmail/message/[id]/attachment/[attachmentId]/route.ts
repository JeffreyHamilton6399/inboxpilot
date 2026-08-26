import { requireAuth } from "@/lib/session";
import { NextResponse } from "next/server";
import { getAttachment, getGmailAuthForUser, GmailApiError } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams one attachment's bytes.
 *
 * Served from the app rather than linked to Gmail directly because Gmail's
 * own attachment URLs need the access token, which has no business being in
 * an <img> or <iframe> src.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id, attachmentId } = await params;
  if (!id || !attachmentId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const gmailAuth = await getGmailAuthForUser(auth.userId);
  if (!gmailAuth) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 404 });
  }

  try {
    const found = await getAttachment(gmailAuth.accessToken, id, attachmentId);
    if (!found) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // `download` switches the disposition so the same URL serves both the
    // inline preview and the Save button.
    const download = new URL(req.url).searchParams.get("download") === "1";
    const disposition = download ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(found.data), {
      headers: {
        "Content-Type": found.meta.mimeType,
        "Content-Length": String(found.data.byteLength),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(found.meta.filename)}`,
        // Mail attachments are immutable, but they are also private: cache in
        // the browser only, never in a shared proxy.
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const status = err instanceof GmailApiError ? err.status : 500;
    console.error("[gmail/attachment] error:", err);
    return NextResponse.json({ error: "Failed to fetch attachment" }, { status });
  }
}
