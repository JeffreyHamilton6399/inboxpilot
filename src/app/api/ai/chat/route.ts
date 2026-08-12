import { chatStream, type ChatMsg } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { messages, context } = (await req.json()) as {
      messages?: { role: "user" | "assistant"; content: string }[];
      context?: string;
    };

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Missing messages" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const system: ChatMsg = {
      role: "system",
      content: `You are InboxPilot, an AI executive assistant that lives inside the user's inbox.
You help them triage, summarize, and draft replies. Be concise, specific, and action-oriented.
When referencing emails, cite the sender and subject. Never invent emails that aren't in the context.
If asked to draft a reply, write it directly (no preamble) in the user's voice.

${
  context
    ? `Current inbox context (most relevant emails):\n${context}`
    : "No inbox context provided for this turn."
}`,
    };

    const apiMessages: ChatMsg[] = [
      system,
      ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatMsg),
    ];

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of chatStream(apiMessages, {
            temperature: 0.6,
            maxTokens: 900,
          })) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `\n\n[error: assistant unavailable — ${String(err)}]`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
  } catch (err) {
    console.error("[chat] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
