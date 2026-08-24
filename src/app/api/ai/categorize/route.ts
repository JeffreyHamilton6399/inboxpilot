import { NextResponse } from "next/server";
import { chatJSON, aiFailure, type ChatMsg } from "@/lib/ai";
import { requireAuth } from "@/lib/session";
import { CATEGORIES } from "@/lib/defaults";
import type { CategoryId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: CategoryId[] = CATEGORIES.map((c) => c.id);

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const { subject, from, preview, body } = (await req.json()) as {
      subject?: string;
      from?: string;
      preview?: string;
      body?: string;
    };

    if (!subject && !preview && !body) {
      return NextResponse.json(
        { error: "Missing email content" },
        { status: 400 }
      );
    }

    const list = CATEGORIES.map(
      (c) => `- ${c.id}: ${c.label} — ${c.description}`
    ).join("\n");

    const system: ChatMsg = {
      role: "system",
      content: `You are InboxPilot's inbox classifier. Read an email and assign exactly ONE category.
Categories:
${list}

Respond with strict JSON: {"category": "<id>", "reason": "<short reason, <= 12 words>"}
The category must be one of: ${VALID.join(", ")}.`,
    };

    const user: ChatMsg = {
      role: "user",
      content: `From: ${from ?? "(unknown)"}
Subject: ${subject ?? "(no subject)"}
Preview: ${preview ?? ""}
Body:
${(body ?? "").slice(0, 2000)}`,
    };

    const result = await chatJSON<{ category?: string; reason?: string }>(
      [system, user],
      { temperature: 0.2, maxTokens: 200 }
    );

    const category = (result.category ?? "").trim().toLowerCase();
    const valid = VALID.includes(category as CategoryId)
      ? (category as CategoryId)
      : "fyi";

    return NextResponse.json({
      category: valid,
      reason: result.reason ?? "Classified by AI",
    });
  } catch (err) {
    console.error("[categorize] error:", err);
    const { status, message } = aiFailure(err);
    return NextResponse.json({ error: message }, { status });
  }
}
