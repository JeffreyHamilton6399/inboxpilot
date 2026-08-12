import "server-only";
import { OAuth2Client } from "google-auth-library";
import { db } from "@/lib/db";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();

export const GMAIL_CONFIGURED = Boolean(CLIENT_ID && CLIENT_SECRET);

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Builds an OAuth2 client with the app's credentials. */
export function getOAuth2Client(redirectUri: string) {
  return new OAuth2Client(CLIENT_ID, CLIENT_SECRET, redirectUri);
}

/** Generates the Google consent URL. */
export function getAuthUrl(redirectUri: string, state: string): string {
  const oauth2 = getOAuth2Client(redirectUri);
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh token on first connect
    scope: GMAIL_SCOPES,
    state,
  });
}

/** Exchanges an auth code for tokens. */
export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : undefined,
    scope: tokens.scope,
  };
}

/** Fetches the connected user's Gmail address. */
export async function getGmailProfile(tokens: {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}): Promise<string> {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch Gmail profile");
  const profile = (await res.json()) as { emailAddress?: string };
  return profile.emailAddress ?? "unknown@gmail.com";
}

/**
 * Loads a user's stored Gmail tokens, refreshing if expired.
 * Returns a ready-to-use token + helper, or null if no account connected.
 */
export async function getGmailAuthForUser(userId: string): Promise<{
  accessToken: string;
  email: string;
} | null> {
  const account = await db.account.findFirst({
    where: { userId, provider: "gmail" },
  });
  if (!account) return null;

  // Refresh if expired (or about to expire).
  let accessToken = account.accessToken;
  const expired =
    !account.expiryDate || account.expiryDate.getTime() < Date.now() + 60_000;

  if (expired && account.refreshToken) {
    try {
      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: account.refreshToken,
          client_id: CLIENT_ID!,
          client_secret: CLIENT_SECRET!,
          grant_type: "refresh_token",
        }),
      });
      if (res.ok) {
        const tokens = (await res.json()) as {
          access_token: string;
          expires_in?: number;
        };
        accessToken = tokens.access_token;
        await db.account.update({
          where: { id: account.id },
          data: {
            accessToken: tokens.access_token,
            expiryDate: tokens.expires_in
              ? new Date(Date.now() + tokens.expires_in * 1000)
              : undefined,
          },
        });
      }
    } catch (err) {
      console.error("[gmail] refresh failed:", err);
    }
  }

  return { accessToken, email: account.email };
}

// --- Gmail REST helpers ---

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailMessageMeta {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
  labelIds?: string[];
}

export async function listMessages(
  accessToken: string,
  maxResults = 40
): Promise<GmailMessageMeta[]> {
  const listRes = await fetch(
    `${GMAIL_API}/users/me/messages?maxResults=${maxResults}&q=in:inbox`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${listRes.status}`);
  const listData = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = (listData.messages ?? []).map((m) => m.id).filter(Boolean);
  if (ids.length === 0) return [];

  // Fetch metadata in parallel batches of 8.
  const out: GmailMessageMeta[] = [];
  for (let i = 0; i < ids.length; i += 8) {
    const batch = ids.slice(i, i + 8);
    const results = await Promise.all(
      batch.map((id) =>
        fetch(
          `${GMAIL_API}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
          .then((r) => (r.ok ? (r.json() as Promise<GmailMessageMeta>) : null))
          .catch(() => null)
      )
    );
    for (const r of results) if (r) out.push(r);
  }
  return out;
}

export async function getMessageBody(
  accessToken: string,
  id: string
): Promise<string> {
  const res = await fetch(`${GMAIL_API}/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail get failed: ${res.status}`);
  const msg = (await res.json()) as GmailMessageMeta;
  return extractText(msg.payload);
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function extractText(payload: GmailPart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    const plain = payload.parts.find((p) => p.mimeType === "text/plain");
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);
    const html = payload.parts.find((p) => p.mimeType === "text/html");
    if (html?.body?.data) return decodeBase64Url(html.body.data);
    for (const p of payload.parts) {
      const t = extractText(p);
      if (t) return t;
    }
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}
