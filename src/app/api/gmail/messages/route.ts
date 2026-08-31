import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getGmailAuthForUser, listMessages, parseFrom, GmailApiError } from "@/lib/gmail";
import type { Email } from "@/lib/types";
import { categorize } from "@/lib/categorize";
import { TtlCache } from "@/lib/ttl-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailMessageMeta {
  id: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
  labelIds?: string[];
}

function header(headers: GmailHeader[] | undefined, name: string): string {
  return (
    headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

const AVATAR_COLORS = [
  "bg-emerald-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-fuchsia-500",
  "bg-orange-500",
  "bg-cyan-600",
];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}


// 15-second in-memory cache per user to avoid hammering Gmail on re-renders.
// Keyed by search and page as well as user: a search, the plain inbox and the
// second page are different questions, and one's answer is not another's.
//
// Bounded, because that keying means a new entry per distinct query: an
// instance serving several people through a day would otherwise hold every
// search any of them ever ran, each with a page of messages attached.
const CACHE_TTL = 15_000;
const CACHE_MAX_ENTRIES = 200;
const cache = new TtlCache<{ data: Email[]; nextPageToken?: string }>(
  CACHE_TTL,
  CACHE_MAX_ENTRIES
);

/** Gmail rejects a runaway query anyway; this just keeps it from being sent. */
const MAX_QUERY_CHARS = 500;

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const params = new URL(req.url).searchParams;
  const search = (params.get("q") ?? "").trim().slice(0, MAX_QUERY_CHARS);
  const pageToken = params.get("pageToken") ?? "";
  const cacheKey = `${auth.userId}::${search}::${pageToken}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json({
      emails: cached.data,
      nextPageToken: cached.nextPageToken,
      cached: true,
      search,
    });
  }

  const gmailAuth = await getGmailAuthForUser(auth.userId);
  if (!gmailAuth) {
    return NextResponse.json(
      { error: "Gmail not connected", code: "GMAIL_NOT_CONNECTED" },
      { status: 404 }
    );
  }

  try {
    const page = await listMessages(gmailAuth.accessToken, 40, search, pageToken || undefined);
    const { nextPageToken } = page;
    if (page.messages.length === 0) {
      cache.set(cacheKey, { data: [], nextPageToken });
      return NextResponse.json({ emails: [], nextPageToken, search });
    }

    const emails: Email[] = (page.messages as GmailMessageMeta[]).map((m) => {
      const headers = m.payload?.headers;
      const fromHeader = header(headers, "From");
      const from = parseFrom(fromHeader);
      const subject = header(headers, "Subject") || "(no subject)";
      const dateStr = header(headers, "Date");
      const date = dateStr
        ? new Date(dateStr).toISOString()
        : new Date(Number(m.internalDate) || Date.now()).toISOString();
      const unread = m.labelIds?.includes("UNREAD") ?? false;
      const starred = m.labelIds?.includes("STARRED") ?? false;
      const category = categorize({
        fromEmail: from.email,
        fromName: from.name,
        subject,
        snippet: m.snippet ?? "",
        labelIds: m.labelIds ?? [],
        listUnsubscribe: header(headers, "List-Unsubscribe") || undefined,
        to: header(headers, "To"),
        userEmail: gmailAuth.email,
      });
      return {
        id: m.id,
        threadId: m.threadId ?? m.id,
        from: { ...from, avatarColor: colorFor(from.email) },
        to: header(headers, "To"),
        subject,
        preview: m.snippet ?? "",
        body: "", // fetched on demand by /api/gmail/message/[id]
        receivedAt: date,
        category,
        unread,
        starred,
        hasAttachment: m.labelIds?.includes("ATTACHMENT") ?? false,
      };
    });

    cache.set(cacheKey, { data: emails, nextPageToken });
    return NextResponse.json({ emails, nextPageToken, search });
  } catch (err) {
    console.error("[gmail/messages] error:", err);

    if (err instanceof GmailApiError) {
      // Only a 401 means the grant is gone and consent has to be given again.
      // A 403 is usually the project, not the user — most often the Gmail API
      // never being enabled — and telling someone to reconnect their already
      // connected account does not fix that.
      if (err.needsReconnect) {
        return NextResponse.json(
          {
            error: "Google has stopped accepting this connection. Reconnect Gmail to continue.",
            code: "GMAIL_NEEDS_RECONNECT",
            detail: err.reason,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: "Gmail refused the request.",
          code: "GMAIL_API_ERROR",
          detail: err.reason,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch Gmail messages" },
      { status: 500 }
    );
  }
}
