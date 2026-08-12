import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getAuthUrl, GMAIL_CONFIGURED } from "@/lib/gmail";
import { getPublicOrigin } from "@/lib/vercel-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  if (!GMAIL_CONFIGURED) {
    return NextResponse.json(
      {
        error:
          "Gmail is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see README).",
      },
      { status: 503 }
    );
  }

  // Use the public origin so the redirect_uri matches what's in Google Console
  // AND what the callback route uses (both call getPublicOrigin).
  const origin = getPublicOrigin(req);
  const redirectUri = `${origin}/api/gmail/callback`;
  // state carries the userId so the callback can attribute the connection.
  const state = auth.userId;
  const url = getAuthUrl(redirectUri, state);

  return NextResponse.json({ url });
}
