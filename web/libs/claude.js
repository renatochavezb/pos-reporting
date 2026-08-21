import Anthropic from "@anthropic-ai/sdk";
import { getRootsSystemPrompt } from "@/prompts/roots_system";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Send a streaming message to Claude with the full ROOTS system prompt.
 * @param {Array} messages - Conversation history in Anthropic format
 * @param {string} animationTool - Active animation tool ID (default: "kling")
 * @returns {AsyncIterable} Anthropic stream
 */
export const sendClaudeMessage = async (messages, animationTool = "kling") => {
  const systemPrompt = getRootsSystemPrompt(animationTool);

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-5",
    max_tokens: 16000,
    system: systemPrompt,
    messages,
  });

  return stream;
};

/**
 * Build a user message that may include text and/or images.
 * @param {string} text - User text message
 * @param {Array} images - Array of { base64: string, mediaType: string }
 * @returns {Object} Anthropic message object
 */
export const buildUserMessage = (text, images = []) => {
  const content = [];

  // Add images first (Anthropic recommends images before text)
  for (const img of images) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType || "image/jpeg",
        data: img.base64,
      },
    });
  }

  // Add text
  if (text) {
    content.push({ type: "text", text });
  }

  return {
    role: "user",
    content: content.length === 1 && content[0].type === "text"
      ? text
      : content,
  };
};
