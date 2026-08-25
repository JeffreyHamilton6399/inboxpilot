import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getGmailAuthForUser, listMessages } from "@/lib/gmail";
import type { Email } from "@/lib/types";
import { categorize } from "@/lib/categorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailMessageMeta {
  id: string;
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

function parseFrom(fromHeader: string): { name: string; email: string } {
  const m = fromHeader.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) {
    return { name: m[1].replace(/"/g, "").trim() || m[2], email: m[2] };
  }
  const email = fromHeader.trim();
  return { name: email.split("@")[0] || email, email };
}

// 15-second in-memory cache per user to avoid hammering Gmail on re-renders.
const cache = new Map<string, { at: number; data: Email[] }>();
const CACHE_TTL = 15_000;

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const cached = cache.get(auth.userId);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json({ emails: cached.data, cached: true });
  }

  const gmailAuth = await getGmailAuthForUser(auth.userId);
  if (!gmailAuth) {
    return NextResponse.json(
      { error: "Gmail not connected", code: "GMAIL_NOT_CONNECTED" },
      { status: 404 }
    );
  }

  try {
    const metas = await listMessages(gmailAuth.accessToken, 40);
    if (metas.length === 0) {
      cache.set(auth.userId, { at: Date.now(), data: [] });
      return NextResponse.json({ emails: [] });
    }

    const emails: Email[] = (metas as GmailMessageMeta[]).map((m) => {
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

    cache.set(auth.userId, { at: Date.now(), data: emails });
    return NextResponse.json({ emails });
  } catch (err) {
    console.error("[gmail/messages] error:", err);
    // If the token is bad, surface a 404 so the client shows "connect gmail".
    const msg = String(err);
    if (msg.includes("401") || msg.includes("403")) {
      return NextResponse.json(
        { error: "Gmail not connected", code: "GMAIL_NOT_CONNECTED" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch Gmail messages" },
      { status: 500 }
    );
  }
}
