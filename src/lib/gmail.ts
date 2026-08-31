import "server-only";
import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { db } from "@/lib/db";
import type { MessageChange, ThreadMessage } from "@/lib/types";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();

export const GMAIL_CONFIGURED = Boolean(CLIENT_ID && CLIENT_SECRET);

// Read, change, send. The send scope is only ever used by an explicit press of
// the Send button on a draft the user has read — nothing here sends on its own,
// and there is no narrower Gmail scope for "reply within an existing thread".
export const GMAIL_SCOPES = [
  // Read, plus the label changes behind star, read/unread and archive.
  // `gmail.modify` includes everything `gmail.readonly` allowed, so it
  // replaces it rather than joining it. An account connected before this
  // meets a 403 saying its scopes are insufficient, which `needsReconnect`
  // already turns into a prompt to connect again.
  "https://www.googleapis.com/auth/gmail.modify",
  // Needed to send a reply from inside the app. Gmail has no narrower scope
  // for "send only into a thread the user is already in".
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

  // Refresh only when the stored expiry says the token is actually done.
  //
  // A missing expiryDate means we were never told when it expires, not that it
  // expired — Google omits expires_in often enough that treating null as
  // expired reported perfectly good connections as missing.
  let accessToken = account.accessToken;
  const expired = account.expiryDate
    ? account.expiryDate.getTime() < Date.now() + 60_000
    : false;

  if (expired && account.refreshToken) {
    let refreshed = false;
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
        refreshed = true;
        await db.account.update({
          where: { id: account.id },
          data: {
            accessToken: tokens.access_token,
            expiryDate: tokens.expires_in
              ? new Date(Date.now() + tokens.expires_in * 1000)
              : undefined,
          },
        });
      } else {
        // A revoked or expired refresh token comes back as 400 invalid_grant.
        console.error("[gmail] refresh rejected:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[gmail] refresh failed:", err);
    }

    // A failed refresh is not proof of anything on its own — the network may
    // simply have been down. Hand back what we have and let Gmail be the judge;
    // its 401 is what the caller turns into "reconnect", with a reason.
    void refreshed;
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
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}

interface GmailMessageMeta {
  threadId?: string;
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
  labelIds?: string[];
}

/**
 * A failure from Gmail itself, carrying the status and Google's own words.
 *
 * Everything used to be flattened into a string and matched with
 * `msg.includes("403")`, so "the Gmail API is not enabled on this project"
 * and "you have never connected an account" produced the same screen.
 */
export class GmailApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string
  ) {
    super(`Gmail returned ${status}: ${detail.slice(0, 300)}`);
    this.name = "GmailApiError";
  }

  /**
   * The grant itself is the problem, and consenting again fixes it.
   *
   * 401 means the token is dead. A 403 saying "insufficient scopes" means the
   * account was connected before the app asked for this permission — which is
   * every account connected before sending existed, so it needs to be a
   * reconnect prompt rather than a dead end.
   */
  get needsReconnect(): boolean {
    if (this.status === 401) return true;
    return this.status === 403 && /insufficient (authentication )?scope/i.test(this.detail);
  }

  /** Google's human-readable reason, if it gave one. */
  get reason(): string {
    try {
      const parsed = JSON.parse(this.detail);
      return parsed?.error?.message ?? parsed?.error_description ?? this.detail;
    } catch {
      return this.detail;
    }
  }
}

async function gmailFetch(url: string, accessToken: string): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new GmailApiError(res.status, await res.text().catch(() => ""));
  }
  return res;
}

/**
 * The Gmail query for a search box that may be empty.
 *
 * An empty box means the inbox. Anything typed is handed to Gmail as its own
 * query language rather than being escaped into a literal: `from:`, `is:unread`,
 * `has:attachment` and `older_than:` are what people already know, and they
 * search all mail, not only the inbox — which is what Gmail's own box does.
 */
export function buildListQuery(search?: string): string {
  const trimmed = search?.trim();
  return trimmed ? trimmed : "in:inbox";
}

/** One page of the list, and the token that asks for the next one. */
export interface MessagePage {
  messages: GmailMessageMeta[];
  /** Absent when this is the last page. */
  nextPageToken?: string;
}

export async function listMessages(
  accessToken: string,
  maxResults = 40,
  search?: string,
  pageToken?: string
): Promise<MessagePage> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: buildListQuery(search),
  });
  if (pageToken) params.set("pageToken", pageToken);

  const listRes = await gmailFetch(`${GMAIL_API}/users/me/messages?${params}`, accessToken);
  const listData = (await listRes.json()) as {
    messages?: { id: string }[];
    nextPageToken?: string;
  };
  const nextPageToken = listData.nextPageToken;
  const ids = (listData.messages ?? []).map((m) => m.id).filter(Boolean);
  if (ids.length === 0) return { messages: [], nextPageToken };

  // Fetch metadata in parallel batches of 8.
  const out: GmailMessageMeta[] = [];
  for (let i = 0; i < ids.length; i += 8) {
    const batch = ids.slice(i, i + 8);
    const results = await Promise.all(
      batch.map((id) =>
        fetch(
          // List-Unsubscribe is requested because its presence is the clearest
          // signal that a message is bulk mail rather than a person writing.
          `${GMAIL_API}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date&metadataHeaders=List-Unsubscribe`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
          .then((r) => (r.ok ? (r.json() as Promise<GmailMessageMeta>) : null))
          .catch(() => null)
      )
    );
    for (const r of results) if (r) out.push(r);
  }
  return { messages: out, nextPageToken };
}

export async function getMessageBody(
  accessToken: string,
  id: string
): Promise<string> {
  const res = await gmailFetch(`${GMAIL_API}/users/me/messages/${id}?format=full`, accessToken);
  const msg = (await res.json()) as GmailMessageMeta;
  return extractText(msg.payload);
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * Reduces an HTML part to something readable.
 *
 * Marketing mail is often HTML-only, and handing a wall of tables and inline
 * CSS to a model wastes the context window and produces worse drafts. This is
 * not sanitisation — the result is rendered as text, never as markup.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractText(payload: GmailPart | undefined): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return htmlToText(decodeBase64Url(payload.body.data));
  }

  if (payload.parts) {
    // Prefer plain text wherever it exists in this level of the tree.
    const plain = payload.parts.find((p) => p.mimeType === "text/plain");
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);
    const html = payload.parts.find((p) => p.mimeType === "text/html");
    if (html?.body?.data) return htmlToText(decodeBase64Url(html.body.data));
    for (const p of payload.parts) {
      const t = extractText(p);
      if (t) return t;
    }
  }

  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

// --- Sending ---

/**
 * Everything needed to make a reply land in the right conversation.
 *
 * Gmail threads on `threadId`, but every other mail client in the chain
 * threads on `In-Reply-To` and `References`. Omitting those is how a reply
 * shows up in Gmail as part of the thread and in the recipient's client as a
 * brand new one, which is worse than either outcome on its own.
 */
export interface ReplyContext {
  threadId: string;
  /** The address to reply to, taken from Reply-To if present, else From. */
  to: string;
  subject: string;
  /** The original's RFC Message-ID header, angle brackets included. */
  inReplyTo: string;
  references: string;
}

export async function getReplyContext(accessToken: string, id: string): Promise<ReplyContext> {
  const res = await gmailFetch(
    `${GMAIL_API}/users/me/messages/${id}?format=metadata` +
      "&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Subject" +
      "&metadataHeaders=Message-ID&metadataHeaders=References",
    accessToken
  );
  const msg = (await res.json()) as GmailMessageMeta & { threadId?: string };
  const headers = msg.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const messageId = get("Message-ID");
  const priorRefs = get("References");
  const subject = get("Subject");

  return {
    threadId: msg.threadId ?? id,
    to: get("Reply-To") || get("From"),
    subject: /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`,
    inReplyTo: messageId,
    // References is the whole chain, oldest first, with this message appended.
    references: [priorRefs, messageId].filter(Boolean).join(" "),
  };
}

/** RFC 2047 encoding, needed the moment a subject contains a non-ASCII character. */
function encodeHeader(value: string): string {
  if (!/[^\x00-\x7F]/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function toBase64Url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A file being sent out, already read into memory. */
export interface OutgoingAttachment {
  filename: string;
  mimeType: string;
  data: Buffer;
}

/**
 * Gmail rejects a raw message over 35 MB, and base64 inflates bytes by a
 * third, so the cap on what goes in is well under that.
 */
export const MAX_OUTGOING_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** base64 in a MIME part has to be wrapped; 76 characters is the limit. */
function wrapBase64(input: Buffer): string {
  return input.toString("base64").replace(/(.{76})/g, "$1\r\n");
}

/**
 * RFC 2231 for the filename, so a name with an accent or a space survives.
 * A plain ASCII `filename=` is written alongside it for anything too old to
 * read the encoded form.
 *
 * The parameters are folded onto their own continuation lines: RFC 5322
 * asks that lines stay under 78 characters, and two filenames plus the
 * header name passes that on its own for any ordinary name.
 */
function contentDisposition(filename: string): string {
  // Printable ASCII only in the plain parameter; quotes would end it early.
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "-");
  return [
    "Content-Disposition: attachment;",
    `\tfilename="${ascii}";`,
    `\tfilename*=UTF-8''${encodeURIComponent(filename)}`,
  ].join("\r\n");
}

/**
 * Builds the RFC 5322 message Gmail wants, base64url encoded.
 *
 * With no attachments this stays a single text/plain part — the shape it has
 * always had. Attachments turn it into multipart/mixed, with the reply text
 * as the first part so a client showing only the first one still shows the
 * message rather than a file.
 */
export function buildReplyMime(
  ctx: ReplyContext,
  body: string,
  attachments: OutgoingAttachment[] = []
): string {
  const base = [
    `To: ${ctx.to}`,
    `Subject: ${encodeHeader(ctx.subject)}`,
    ctx.inReplyTo ? `In-Reply-To: ${ctx.inReplyTo}` : "",
    ctx.references ? `References: ${ctx.references}` : "",
    "MIME-Version: 1.0",
  ].filter(Boolean);

  if (attachments.length === 0) {
    const headers = [
      ...base,
      'Content-Type: text/plain; charset="UTF-8"',
      // Base64 unconditionally: it sidesteps line-length limits and any
      // character the transport would otherwise mangle.
      "Content-Transfer-Encoding: base64",
    ];
    const encodedBody = wrapBase64(Buffer.from(body, "utf-8"));
    return toBase64Url(Buffer.from(`${headers.join("\r\n")}\r\n\r\n${encodedBody}`, "utf-8"));
  }

  // Random, so it cannot collide with anything inside a part. Twelve bytes is
  // 96 bits of randomness and keeps the Content-Type line under 78 characters.
  const boundary = `=_ip_${randomBytes(12).toString("hex")}`;
  const headers = [...base, `Content-Type: multipart/mixed; boundary="${boundary}"`];

  const parts = [
    [
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(Buffer.from(body, "utf-8")),
    ].join("\r\n"),
    ...attachments.map((file) =>
      [
        `Content-Type: ${file.mimeType}`,
        "Content-Transfer-Encoding: base64",
        contentDisposition(file.filename),
        "",
        wrapBase64(file.data),
      ].join("\r\n")
    ),
  ];

  const message =
    `${headers.join("\r\n")}\r\n\r\n` +
    parts.map((part) => `--${boundary}\r\n${part}`).join("\r\n") +
    `\r\n--${boundary}--\r\n`;

  return toBase64Url(Buffer.from(message, "utf-8"));
}

/** Sends a reply into an existing thread. Returns the new message's id. */
export async function sendReply(
  accessToken: string,
  ctx: ReplyContext,
  body: string,
  attachments: OutgoingAttachment[] = []
): Promise<{ id: string; threadId: string }> {
  const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: buildReplyMime(ctx, body, attachments), threadId: ctx.threadId }),
  });
  if (!res.ok) throw new GmailApiError(res.status, await res.text().catch(() => ""));
  const sent = (await res.json()) as { id: string; threadId: string };
  return { id: sent.id, threadId: sent.threadId };
}


// --- Changing messages ---

/** Gmail has no verbs, only labels — starring is adding STARRED and so on. */
export function labelsFor(change: MessageChange): {
  addLabelIds: string[];
  removeLabelIds: string[];
} {
  const addLabelIds: string[] = [];
  const removeLabelIds: string[] = [];

  const set = (label: string, on: boolean | undefined) => {
    if (on === undefined) return;
    (on ? addLabelIds : removeLabelIds).push(label);
  };

  set("STARRED", change.starred);
  set("UNREAD", change.unread);
  // Archiving is the absence of INBOX, so this one reads backwards.
  if (change.archived !== undefined) {
    (change.archived ? removeLabelIds : addLabelIds).push("INBOX");
  }

  return { addLabelIds, removeLabelIds };
}

/**
 * Applies a change to one or more messages.
 *
 * batchModify rather than a modify apiece: archiving a whole category is a
 * single button here, and doing that as ninety separate requests would be
 * ninety chances to half-finish. Gmail takes up to 1000 ids at a time and
 * answers with no body at all.
 */
export async function modifyMessages(
  accessToken: string,
  ids: string[],
  change: MessageChange
): Promise<void> {
  const { addLabelIds, removeLabelIds } = labelsFor(change);
  if (ids.length === 0 || (addLabelIds.length === 0 && removeLabelIds.length === 0)) {
    return;
  }

  for (let i = 0; i < ids.length; i += 1000) {
    const res = await fetch(`${GMAIL_API}/users/me/messages/batchModify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: ids.slice(i, i + 1000), addLabelIds, removeLabelIds }),
    });
    if (!res.ok) throw new GmailApiError(res.status, await res.text().catch(() => ""));
  }
}

// --- Attachments ---

/**
 * One file hanging off a message. Gmail hands back an id rather than bytes,
 * so the body is fetched separately, only when something asks for it.
 */
export interface GmailAttachment {
  /** Gmail's attachmentId — opaque, and only valid for this message. */
  id: string;
  /**
   * Where the part sits in the MIME tree, e.g. `1.0`.
   *
   * This is what a client should hold on to. Unlike the attachmentId, which
   * Gmail may hand back differently on a later `messages.get`, a part's
   * position in the message cannot change — the message is immutable.
   */
  partId: string;
  filename: string;
  mimeType: string;
  /** Size in bytes. */
  size: number;
  /**
   * True when the part is referenced from the HTML body by `cid:` — a
   * signature logo rather than something the sender meant to send. Listed
   * separately so the UI can leave them out.
   */
  inline: boolean;
}

function headerValue(part: GmailPart, name: string): string | undefined {
  return part.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

/**
 * Walks the MIME tree and returns every part that is a file.
 *
 * A part counts as an attachment when it has both a filename and an
 * attachmentId. That pairing is what separates a real file from the
 * text/plain and text/html alternatives, which have neither.
 */
export function extractAttachments(payload: GmailPart | undefined): GmailAttachment[] {
  if (!payload) return [];
  const found: GmailAttachment[] = [];

  const walk = (part: GmailPart, path: string): void => {
    if (part.parts?.length) {
      part.parts.forEach((child, index) => walk(child, path ? `${path}.${index}` : String(index)));
      return;
    }
    if (!part.filename || !part.body?.attachmentId) return;

    const disposition = headerValue(part, "content-disposition") ?? "";
    const contentId = headerValue(part, "content-id");
    found.push({
      id: part.body.attachmentId,
      partId: path || "0",
      filename: part.filename,
      mimeType: part.mimeType || "application/octet-stream",
      size: part.body.size ?? 0,
      inline: /inline/i.test(disposition) && Boolean(contentId),
    });
  };

  walk(payload, "");
  return found;
}

/**
 * Picks one part out of a message, given whatever the client was holding.
 *
 * The part path is tried before the attachmentId on purpose. Gmail's
 * attachmentId is opaque and tied to a particular `messages.get` — it is not
 * promised to come back the same on the next one, and when it does not, an id
 * the page has been holding since it loaded matches nothing and a file that is
 * plainly listed right there reports itself missing. The path is derived from
 * the MIME tree, which cannot change, so it is the durable half.
 */
export function findAttachment(
  list: GmailAttachment[],
  selector: string
): GmailAttachment | undefined {
  return list.find((a) => a.partId === selector) ?? list.find((a) => a.id === selector);
}

/** Why a lookup came back with nothing, so the caller can say which it was. */
export type AttachmentMiss =
  | { ok: false; reason: "no-such-part"; available: string[] }
  | { ok: false; reason: "no-bytes"; meta: GmailAttachment };

/**
 * Fetches one attachment's bytes.
 *
 * `selector` is a part path (preferred) or a Gmail attachmentId. The metadata
 * is re-read from the message rather than trusted from the caller: the
 * filename and content type decide how the browser renders the response, and
 * neither should come from a query string.
 */
export async function getAttachment(
  accessToken: string,
  messageId: string,
  selector: string
): Promise<{ ok: true; meta: GmailAttachment; data: Buffer } | AttachmentMiss> {
  const msgRes = await gmailFetch(
    `${GMAIL_API}/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    accessToken
  );
  const msg = (await msgRes.json()) as GmailMessageMeta;
  const parts = extractAttachments(msg.payload);
  const meta = findAttachment(parts, selector);
  if (!meta) {
    return { ok: false, reason: "no-such-part", available: parts.map((a) => a.partId) };
  }

  // Always the id from the message just fetched, never the caller's — that is
  // the whole point of re-reading it.
  const res = await gmailFetch(
    `${GMAIL_API}/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(meta.id)}`,
    accessToken
  );
  const body = (await res.json()) as { data?: string };
  if (!body.data) return { ok: false, reason: "no-bytes", meta };

  const data = Buffer.from(body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return { ok: true, meta: { ...meta, size: data.byteLength }, data };
}

/** Reads a message's body and its attachment list in one round trip. */
export async function getMessageDetail(
  accessToken: string,
  id: string
): Promise<{ body: string; attachments: GmailAttachment[] }> {
  const res = await gmailFetch(
    `${GMAIL_API}/users/me/messages/${encodeURIComponent(id)}?format=full`,
    accessToken
  );
  const msg = (await res.json()) as GmailMessageMeta;
  return {
    body: extractText(msg.payload),
    attachments: extractAttachments(msg.payload).filter((a) => !a.inline),
  };
}

// --- Threads ---

/** Splits `Sarah Chen <s@example.com>` into its parts. */
export function parseFrom(header: string): { name: string; email: string } {
  const m = header.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].replace(/"/g, "").trim() || m[2], email: m[2] };
  const email = header.trim();
  return { name: email.split("@")[0] || email, email };
}


/**
 * The whole conversation, oldest first, including the user's own replies.
 *
 * Reading one message without the thread around it means reading half a
 * conversation — and it meant a reply sent from this app vanished the moment it
 * was sent, because sent mail is not in the inbox listing.
 */
export async function getThread(
  accessToken: string,
  threadId: string,
  selfEmail: string
): Promise<ThreadMessage[]> {
  const res = await gmailFetch(`${GMAIL_API}/users/me/threads/${threadId}?format=full`, accessToken);
  const thread = (await res.json()) as { messages?: (GmailMessageMeta & { labelIds?: string[] })[] };

  const self = selfEmail.toLowerCase();

  return (thread.messages ?? []).map((m) => {
    const headers = m.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    const from = parseFrom(get("From"));
    const dateStr = get("Date");

    return {
      id: m.id,
      from,
      to: get("To"),
      receivedAt: dateStr
        ? new Date(dateStr).toISOString()
        : new Date(Number(m.internalDate) || Date.now()).toISOString(),
      body: extractText(m.payload),
      // The SENT label is the reliable signal; the address comparison catches
      // mail sent from an alias that Gmail still files in the thread.
      fromMe: (m.labelIds ?? []).includes("SENT") || from.email.toLowerCase() === self,
    };
  });
}
