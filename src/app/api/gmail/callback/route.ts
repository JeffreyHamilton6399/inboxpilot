import { NextResponse } from "next/server";
import { exchangeCode, getGmailProfile } from "@/lib/gmail";
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
    const redirectUri = `${url.origin}/api/gmail/callback`;
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
    console.error("[gmail/callback] error:", err);
    return NextResponse.redirect(
      new URL(
        `/?gmail_error=${encodeURIComponent("Gmail connection failed")}`,
        url.origin
      )
    );
  }
}
