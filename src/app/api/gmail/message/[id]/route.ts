import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getGmailAuthForUser, getMessageDetail } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const gmailAuth = await getGmailAuthForUser(auth.userId);
  if (!gmailAuth) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 404 });
  }

  try {
    const { body, attachments } = await getMessageDetail(gmailAuth.accessToken, id);
    return NextResponse.json({ id, body, attachments });
  } catch (err) {
    console.error("[gmail/message] error:", err);
    return NextResponse.json({ error: "Failed to fetch message" }, { status: 500 });
  }
}
