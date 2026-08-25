import { NextResponse } from "next/server";
import { chatJSON, aiFailure, type ChatMsg } from "@/lib/ai";
import { requireAuth } from "@/lib/session";
import { CATEGORIES } from "@/lib/defaults";
import type { CategoryId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID: CategoryId[] = CATEGORIES.map((c) => c.id);

/** One request per message would be forty round trips to sort one inbox. */
const MAX_PER_CALL = 25;

interface Incoming {
  id: string;
  from?: string;
  subject?: string;
  preview?: string;
}

/**
 * Categorises a batch of messages in a single model call.
 *
 * The instant heuristic already labelled these on arrival; this is the pass
 * that reads them properly. Anything the model returns that is not one of the
 * eight real categories is dropped rather than defaulted, because a silent
 * fallback to "fyi" looks exactly like a confident classification and is the
 * reason a model inventing category names could pass unnoticed.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const { emails } = (await req.json()) as { emails?: Incoming[] };

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "No emails to sort" }, { status: 400 });
    }
    if (emails.length > MAX_PER_CALL) {
      return NextResponse.json(
        { error: `Send at most ${MAX_PER_CALL} messages per request` },
        { status: 400 }
      );
    }

    const list = CATEGORIES.map((c) => `- ${c.id}: ${c.label} — ${c.description}`).join("\n");

    const system: ChatMsg = {
      role: "system",
      content: `You are InboxPilot's inbox classifier. You will be given several emails, each with an index.
Assign exactly ONE category to each.

Categories:
${list}

The category must be one of: ${VALID.join(", ")}.

Respond with strict JSON and nothing else:
{"results":[{"index":0,"category":"<id>","reason":"<max 10 words>"}]}
Return one entry for every index you were given.`,
    };

    const user: ChatMsg = {
      role: "user",
      content: emails
        .map((e, i) =>
          [
            `[${i}]`,
            `From: ${e.from ?? "(unknown)"}`,
            `Subject: ${e.subject ?? "(no subject)"}`,
            `Preview: ${(e.preview ?? "").slice(0, 300)}`,
          ].join("\n")
        )
        .join("\n\n"),
    };

    const parsed = await chatJSON<{
      results?: { index?: number; category?: string; reason?: string }[];
    }>([system, user], { temperature: 0.2, maxTokens: 2048 });

    const results = (parsed.results ?? []).flatMap((r) => {
      const email = typeof r.index === "number" ? emails[r.index] : undefined;
      const category = (r.category ?? "").trim().toLowerCase();
      if (!email || !VALID.includes(category as CategoryId)) return [];
      return [{ id: email.id, category: category as CategoryId, reason: r.reason ?? "" }];
    });

    return NextResponse.json({ results, requested: emails.length });
  } catch (err) {
    console.error("[categorize/batch] error:", err);
    const { status, message } = aiFailure(err);
    return NextResponse.json({ error: message }, { status });
  }
}
