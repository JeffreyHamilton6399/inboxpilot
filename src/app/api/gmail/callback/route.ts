import { NextResponse } from "next/server";
import { exchangeCode, getGmailProfile } from "@/lib/gmail";
import { getPublicOrigin } from "@/lib/vercel-url";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { verifyState, OAUTH_STATE_COOKIE } from "@/lib/oauth-state";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(origin: string, reason: string) {
  return NextResponse.redirect(
    new URL(`/?gmail_error=${encodeURIComponent(reason)}`, origin)
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return fail(url.origin, error);
  if (!code) return fail(url.origin, "missing_code");

  // The account is attached to whoever is logged in *here*, and only if the
  // state proves this browser started the flow. Nothing in the query string is
  // trusted to say who the user is.
  const userId = await getUserId();
  if (!userId) return fail(url.origin, "Log in before connecting Gmail.");

  const cookieNonce = (await cookies()).get(OAUTH_STATE_COOKIE)?.value;
  if (!verifyState(state, cookieNonce, userId)) {
    return fail(url.origin, "This Gmail connection request could not be verified. Please try again.");
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
        userId_provider_email: { userId, provider: "gmail", email },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        scope: tokens.scope ?? undefined,
      },
      create: {
        userId,
        provider: "gmail",
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        scope: tokens.scope ?? undefined,
      },
    });

    const done = NextResponse.redirect(new URL("/?gmail_connected=1", url.origin));
    // The nonce is single-use; leaving it set would let a replayed callback
    // pass verification a second time.
    done.cookies.delete(OAUTH_STATE_COOKIE);
    return done;
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
