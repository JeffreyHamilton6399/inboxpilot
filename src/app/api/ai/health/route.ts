import { NextResponse } from "next/server";
import { getProvider, probeKey } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What the server thinks its AI configuration is.
 *
 * `ready` says a key is present. `keyAccepted` says the provider agrees it is a
 * real one, and the difference between those two is not academic: a deployment
 * holding a wrong key reported itself ready here while every AI feature
 * returned 503, which sent the search for the fault everywhere except the one
 * variable that was wrong.
 *
 * The probe is a model listing, cached for a minute, carrying no user data. It
 * runs only for `?probe=1`, so the plain endpoint stays free.
 */
export async function GET(req: Request) {
  const { host, model, ready, reasoningEffort } = getProvider();
  const base = { host, model, ready, reasoningEffort };

  if (new URL(req.url).searchParams.get("probe") !== "1") {
    return NextResponse.json(base);
  }

  const { accepted, detail } = await probeKey();
  return NextResponse.json(
    { ...base, keyAccepted: accepted, detail },
    { status: accepted ? 200 : 503 }
  );
}
