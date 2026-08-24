import { chatStream, aiFailure, type ChatMsg } from "@/lib/ai";
import { requireAuth } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
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

    // Pull the first chunk before returning, so a bad key or unreachable
    // endpoint surfaces as a real status code instead of an error message
    // rendered inside the assistant's reply bubble.
    const chunks = chatStream(apiMessages, { temperature: 0.6, maxTokens: 900 });
    const first = await chunks.next();
    if (first.done) {
      return new Response(JSON.stringify({ error: "The model returned an empty response." }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          controller.enqueue(encoder.encode(first.value));
          for await (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          // The response has already begun, so the only channel left is the
          // body itself.
          console.error("[chat] stream interrupted:", err);
          controller.enqueue(encoder.encode("\n\n[the connection to the model dropped]"));
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
    const { status, message } = aiFailure(err);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }
}
