import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import { sendClaudeMessage, buildUserMessage } from "@/libs/claude";

export const dynamic = "force-dynamic";

/**
 * POST /api/engine/chat
 * Streams a Claude response using the full ROOTS system prompt.
 *
 * Body:
 * {
 *   messages: Array<{ role: "user"|"assistant", content: string|Array }>,
 *   animationTool: string,        // optional, default "kling"
 *   text: string,                 // current user message text
 *   images: Array<{ base64, mediaType }> // optional reference photos
 * }
 *
 * Returns: text/event-stream (SSE)
 * Events: data: { text: "..." }  |  data: [DONE]
 */
export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages = [], animationTool = "kling", text, images = [] } =
      await req.json();

    if (!text && images.length === 0) {
      return NextResponse.json(
        { error: "Message text or images required" },
        { status: 400 }
      );
    }

    // Build the new user message (may include images for Identity Lock)
    const userMessage = buildUserMessage(text, images);
    const fullMessages = [...messages, userMessage];

    // Get Claude stream with ROOTS system prompt
    const stream = await sendClaudeMessage(fullMessages, animationTool);

    // Stream via SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta?.type === "text_delta"
            ) {
              const payload = JSON.stringify({ text: chunk.delta.text });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (streamError) {
          console.error("Stream error:", streamError);
          const errPayload = JSON.stringify({ error: "Stream interrupted" });
          controller.enqueue(encoder.encode(`data: ${errPayload}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Engine chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
