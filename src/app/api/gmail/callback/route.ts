import { NextResponse } from "next/server";
import { exchangeCode, getGmailProfile } from "@/lib/gmail";
import { getPublicOrigin } from "@/lib/vercel-url";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // userId
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?gmail_error=${encodeURIComponent(error)}`, url.origin)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?gmail_error=missing_code_or_state", url.origin)
    );
  }

  try {
    // CRITICAL: use the public origin, not the internal Vercel URL.
    // Otherwise the redirect_uri in the token exchange won't match the one
    // used in the auth URL step, and Google rejects it with a 400.
    const origin = getPublicOrigin(req);
    const redirectUri = `${origin}/api/gmail/callback`;
    const tokens = await exchangeCode(code, redirectUri);
    const email = await getGmailProfile(tokens);

    // Upsert the account for this user.
    await db.account.upsert({
      where: {
        userId_provider_email: { userId: state, provider: "gmail", email },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiryDate: tokens.expiry_date ?? undefined,
        scope: tokens.scope ?? undefined,
      },
      create: {
        userId: state,
        provider: "gmail",
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiryDate: tokens.expiry_date ?? undefined,
        scope: tokens.scope ?? undefined,
      },
    });

    return NextResponse.redirect(
      new URL("/?gmail_connected=1", url.origin)
    );
  } catch (err) {
    // Surface the actual error so the frontend can show it.
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gmail/callback] error:", msg);
    return NextResponse.redirect(
      new URL(
        `/?gmail_error=${encodeURIComponent(msg.slice(0, 200))}`,
        url.origin
      )
    );
  }
}
