import "server-only";

/**
 * Returns the public-facing origin for the current request.
 *
 * On Vercel, `new URL(req.url).origin` can return an internal URL
 * (e.g. `http://localhost:3000` inside the serverless function), which breaks
 * OAuth: the redirect_uri sent to Google during the token exchange won't match
 * the one used during the auth URL step.
 *
 * Fix: prefer the `x-forwarded-host` + `x-forwarded-proto` headers that
 * Vercel sets on every incoming request.
 */
export function getPublicOrigin(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }
  // Fallback for local dev (no forwarding headers)
  return new URL(req.url).origin;
}
