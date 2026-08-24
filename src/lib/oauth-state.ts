import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * The OAuth `state` parameter.
 *
 * Its job is to prove that the callback Google just sent us is the tail end of
 * a flow this browser actually started. An earlier version put the user's id
 * in `state` and had the callback write to whatever id came back, which meant
 * anyone who could name a user id could attach a mailbox to that account.
 *
 * So: a random nonce, signed with NEXTAUTH_SECRET and bound to the user id it
 * was issued for. The callback re-derives the signature and, separately,
 * checks the nonce against an httpOnly cookie set when the flow began. The
 * user id used for the database write comes from the session, never from here.
 */

export const OAUTH_STATE_COOKIE = "inboxpilot_oauth_state";

/** Ten minutes is longer than a consent screen takes and short enough to be useless later. */
const MAX_AGE_MS = 10 * 60 * 1000;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Returns the value to send to Google and the nonce to store in the cookie. */
export function createState(userId: string): { state: string; nonce: string } {
  const nonce = randomBytes(32).toString("base64url");
  const payload = `${nonce}.${userId}.${Date.now()}`;
  return { state: `${payload}.${sign(payload)}`, nonce };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verifies a returned state against the cookie nonce and the expected user.
 * Returns false for anything it cannot fully account for.
 */
export function verifyState(
  state: string | null,
  cookieNonce: string | undefined,
  sessionUserId: string
): boolean {
  if (!state || !cookieNonce) return false;

  const parts = state.split(".");
  if (parts.length !== 4) return false;
  const [nonce, userId, issuedAt, signature] = parts;

  if (!safeEqual(signature, sign(`${nonce}.${userId}.${issuedAt}`))) return false;
  if (!safeEqual(nonce, cookieNonce)) return false;
  if (userId !== sessionUserId) return false;

  const age = Date.now() - Number(issuedAt);
  return Number.isFinite(age) && age >= 0 && age < MAX_AGE_MS;
}
