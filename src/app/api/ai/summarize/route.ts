import { NextResponse } from "next/server";
import { chatJSON, aiFailure, type ChatMsg } from "@/lib/ai";
import { requireAuth } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  try {
    const { transcript, title } = (await req.json()) as {
      transcript?: { speaker: string; text: string }[];
      title?: string;
    };

    if (!transcript || transcript.length === 0) {
      return NextResponse.json(
        { error: "Missing transcript" },
        { status: 400 }
      );
    }

    const transcriptText = transcript
      .map((t) => `${t.speaker}: ${t.text}`)
      .join("\n");

    const system: ChatMsg = {
      role: "system",
      content: `You are InboxPilot's meeting notetaker. Given a meeting transcript, produce a tight summary and concrete action items.
Respond with strict JSON: {"summary": "<3-4 sentences>", "actionItems": ["<action 1>", "<action 2>", ...]}
Action items must be specific and start with a verb. 2-5 items max.`,
    };

    const user: ChatMsg = {
      role: "user",
      content: `Meeting: ${title ?? "(untitled)"}

Transcript:
${transcriptText}`,
    };

    const result = await chatJSON<{
      summary?: string;
      actionItems?: string[];
    }>([system, user], { temperature: 0.3, maxTokens: 1200 });

    return NextResponse.json({
      summary: result.summary ?? "",
      actionItems: Array.isArray(result.actionItems) ? result.actionItems : [],
    });
  } catch (err) {
    console.error("[summarize] error:", err);
    const { status, message } = aiFailure(err);
    return NextResponse.json({ error: message }, { status });
  }
}
