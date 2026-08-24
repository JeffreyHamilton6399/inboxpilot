import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { getGmailAuthForUser, listMessages } from "@/lib/gmail";
import type { CategoryId, Email } from "@/lib/types";

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

/**
 * Fast heuristic categorizer — runs instantly with no AI calls.
 * Uses sender patterns, subject keywords, and Gmail labels.
 * Users can re-run AI categorization on any individual email for refinement.
 */
function heuristicCategory(
  fromEmail: string,
  fromName: string,
  subject: string,
  preview: string,
  labelIds: string[]
): CategoryId {
  const email = fromEmail.toLowerCase();
  const name = fromName.toLowerCase();
  const subj = subject.toLowerCase();
  const text = `${subj} ${preview.toLowerCase()}`;

  // Gmail's own category labels take priority
  if (labelIds.includes("CATEGORY_PROMOTIONS")) return "marketing";
  if (labelIds.includes("CATEGORY_SOCIAL")) return "notification";
  if (labelIds.includes("CATEGORY_UPDATES") || labelIds.includes("CATEGORY_FORUMS")) {
    return "notification";
  }

  // Marketing / newsletters — common patterns
  const marketingDomains = [
    "newsletter", "noreply", "no-reply", "donotreply", "updates",
    "mail", "email", "notifications", "digest", "campaign",
  ];
  const marketingSenders = [
    "substack", "medium", "linkedin", "twitter", "facebook",
    "instagram", "youtube", "tiktok", "pinterest", "reddit",
    "amazon", "ebay", "shopify", "etsy", "steam", "epic",
    "eventbrite", "meetup", "medium",
  ];
  const marketingKeywords = [
    "unsubscribe", "newsletter", "digest", "weekly", "monthly",
    "deal", "sale", "off", "discount", "promo", "offer",
    "new post", "you might like", "recommended",
  ];

  if (marketingDomains.some((d) => email.includes(d) || name.includes(d))) return "marketing";
  if (marketingSenders.some((d) => email.includes(d))) return "marketing";
  if (marketingKeywords.some((k) => text.includes(k))) return "marketing";

  // Meeting / calendar — invites, updates, cancellations
  const meetingKeywords = [
    "invitation", "invite", "calendar", "scheduled", "rescheduled",
    "meeting", "event reminder", "updated invitation", "canceled",
  ];
  const meetingSenders = ["calendar", "meet.google", "zoom.us", "teams"];
  if (meetingKeywords.some((k) => subj.includes(k))) return "meeting-update";
  if (meetingSenders.some((d) => email.includes(d))) return "meeting-update";

  // Notifications — automated system updates
  const notifyDomains = [
    "noreply", "no-reply", "notifications", "alerts", "automated",
    "github", "gitlab", "bitbucket", "jira", "trello", "asana",
    "vercel", "netlify", "heroku", "aws", "stripe", "paypal",
    "square", "bank", "security", "verify", "verification",
  ];
  const notifyKeywords = [
    "verification code", "verify your", "security alert", "login",
    "signed in", "new device", "receipt", "invoice", "order",
    "shipped", "delivery", "tracking", "confirm", "confirmation",
    "automated", "do not reply",
  ];
  if (notifyDomains.some((d) => email.includes(d))) return "notification";
  if (notifyKeywords.some((k) => text.includes(k))) return "notification";

  // Awaiting reply — sent by us or looks like a follow-up
  if (labelIds.includes("SENT")) return "actioned";

  // Default: FYI (most personal emails that aren't actionable)
  return "fyi";
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
      const category = heuristicCategory(from.email, from.name, subject, m.snippet ?? "", m.labelIds ?? []);
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
