import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

/** Returns the current session on the server, or null. */
export async function getSession() {
  return getServerSession(authOptions);
}

/** Returns the current user id, or null if not authenticated. */
export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * Requires an authenticated session. Returns the user id, or a 401 Response
 * the caller can return directly.
 */
export async function requireAuth(): Promise<
  { ok: true; userId: string } | { ok: false; response: Response }
> {
  const userId = await getUserId();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }
  return { ok: true, userId };
}

// NextResponse import for requireAuth
import { NextResponse } from "next/server";
