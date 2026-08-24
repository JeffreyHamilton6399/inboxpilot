import { NextResponse } from "next/server";
import { chat, aiFailure, type ChatMsg } from "@/lib/ai";
import { requireAuth } from "@/lib/session";
import type { ToneProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const { email, tone, instruction } = (await req.json()) as {
      email?: {
        from?: string;
        subject?: string;
        body?: string;
        preview?: string;
      };
      tone?: ToneProfile;
      instruction?: string;
    };

    // Use body if available, otherwise fall back to preview (Gmail emails
    // load their body on demand — the body might not be fetched yet).
    const emailBody = email?.body?.trim() || email?.preview?.trim() || "";
    if (!emailBody && !email?.subject) {
      return NextResponse.json({ error: "Missing email content" }, { status: 400 });
    }

    const t = tone;
    const lengthHint =
      t?.length === "short"
        ? "2-4 sentences"
        : t?.length === "long"
          ? "a substantial reply (2 short paragraphs)"
          : "one short paragraph";

    const formalityHint =
      t?.formality === "casual"
        ? "casual and friendly"
        : t?.formality === "formal"
          ? "formal and polished"
          : "neutral professional";

    const phrases =
      t?.samplePhrases && t.samplePhrases.length
        ? `Phrases this person often uses (mirror where natural): ${t.samplePhrases.map((p) => `"${p}"`).join(", ")}.`
        : "";

    const avoid =
      t?.avoid && t.avoid.length
        ? `Avoid these phrases: ${t.avoid.map((p) => `"${p}"`).join(", ")}.`
        : "";

    const system: ChatMsg = {
      role: "system",
      content: `You are drafting an email reply in the personal voice of ${t?.name ?? "the user"}, a ${t?.role ?? "professional"}.
Write in a ${formalityHint} tone that is ${t?.tone ?? "clear and concise"}.
Length: ${lengthHint}.
${phrases}
${avoid}
Sign off as "${t?.signature ?? ""}" (just the name, no title line).

Output ONLY the reply body. No subject line, no "Dear ...", no preamble, no quotation of the original. Start directly with a greeting line if natural, then the body.`,
    };

    const user: ChatMsg = {
      role: "user",
      content: `Original email from ${email?.from ?? "(sender)"}:
Subject: ${email?.subject ?? "(no subject)"}

${emailBody}

---
${instruction ? `Extra instruction from the user: ${instruction}` : "Write the reply."}`,
    };

    const draft = await chat([system, user], {
      temperature: 0.7,
      maxTokens: 600,
    });

    return NextResponse.json({ draft: draft.trim() });
  } catch (err) {
    console.error("[draft] error:", err);
    const { status, message } = aiFailure(err);
    return NextResponse.json({ error: message }, { status });
  }
}
